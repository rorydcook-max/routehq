/**
 * Parked vehicles (Stripe Billing, 7 Nov 2026). Moving to a plan with room for fewer vehicles than the fleet,
 * the owner picks which stay active up to the new limit; the rest are parked: still visible, read-only, no new
 * bookings (database trigger rentals_block_parked_vehicle), not listed on the booking page, rove.rent or the
 * partner network. Rentals already running finish normally. A bigger plan un-parks them.
 */

import { countsAsMotorbike, effectiveLimits, type Plan } from "@/lib/plans";
import { kindFromCategory } from "@/lib/vehicle-groups";

export type FleetVehicle = {
  id: string;
  label: string;
  registration: string | null;
  motorbike: boolean;
  parked: boolean;
  /** On a rental right now (rented or reserved): kept first when the owner doesn't choose. */
  busy: boolean;
  createdAt: string;
};

/** Every vehicle of a business (not deleted), counted as a car or a motorbike the way the plans count them. */
export async function loadFleet(admin: any, organizationId: string): Promise<FleetVehicle[]> {
  const [{ data: rows }, { data: categories }] = await Promise.all([
    admin
      .from("vehicles")
      .select("id, make, model, year, registration_number, category_id, status, parked_at, created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin.from("vehicle_categories").select("id, code, name").or(`organization_id.is.null,organization_id.eq.${organizationId}`)
  ]);
  const byId = new Map(((categories || []) as Array<{ id: string; code: string; name: string }>).map((category) => [category.id, category]));
  return ((rows || []) as any[]).map((row) => ({
    id: row.id,
    label: [row.make, row.model, row.year].filter(Boolean).join(" ") || String(row.registration_number || ""),
    registration: row.registration_number || null,
    motorbike: countsAsMotorbike(kindFromCategory(row.category_id ? byId.get(row.category_id) : null)),
    parked: Boolean(row.parked_at),
    busy: row.status === "rented" || row.status === "reserved",
    createdAt: String(row.created_at || "")
  }));
}

/** Cars and motorbikes that would have to be parked on this plan (counting every vehicle, parked or not). */
export function excessFor(plan: Pick<Plan, "cars" | "motorbikes">, fleet: FleetVehicle[]) {
  const cars = fleet.filter((vehicle) => !vehicle.motorbike).length;
  const motorbikes = fleet.length - cars;
  return {
    cars: plan.cars === null ? 0 : Math.max(0, cars - plan.cars),
    motorbikes: plan.motorbikes === null ? 0 : Math.max(0, motorbikes - plan.motorbikes)
  };
}

/**
 * Which vehicles stay active on a plan: the owner's picks first (within the limit), then vehicles out on a
 * rental, then the longest-held. Everything else is parked.
 */
export function chooseActive(plan: Pick<Plan, "cars" | "motorbikes">, fleet: FleetVehicle[], keep: string[] | null | undefined) {
  const wanted = new Set(keep || []);
  const active = new Set<string>();
  for (const motorbike of [false, true]) {
    const limit = motorbike ? plan.motorbikes : plan.cars;
    const group = fleet.filter((vehicle) => vehicle.motorbike === motorbike);
    if (limit === null || group.length <= limit) {
      group.forEach((vehicle) => active.add(vehicle.id));
      continue;
    }
    const ranked = [...group].sort((a, b) => {
      const score = (vehicle: FleetVehicle) => (wanted.has(vehicle.id) ? 0 : vehicle.busy ? 1 : vehicle.parked ? 3 : 2);
      return score(a) - score(b) || a.createdAt.localeCompare(b.createdAt);
    });
    ranked.slice(0, limit).forEach((vehicle) => active.add(vehicle.id));
  }
  return active;
}

/**
 * Brings a business's parked vehicles in line with its current plan: un-parks what now fits and, only when it
 * just moved to a smaller plan (`park`), parks what is over the limit, keeping the owner's picks. A business
 * already over its limit without a downgrade is never parked: limits stay nudges (lib/plans.ts).
 */
export async function applyPlanToFleet(admin: any, organizationId: string, options: { park: boolean; keep?: string[] | null }) {
  const keep = options.keep;
  const [{ data: organization }, { data: custom }] = await Promise.all([
    admin.from("organizations").select("subscription_tier, subscription_status, plan_keep_vehicle_ids").eq("id", organizationId).maybeSingle(),
    // Read separately, as everywhere else, so a missing column can't stop the rest.
    admin.from("organizations").select("custom_limits").eq("id", organizationId).maybeSingle()
  ]);
  if (!organization) return { parked: 0, unparked: 0 };
  // During the trial everything is on: nothing is parked.
  const trial = String(organization.subscription_status || "trial") === "trial";
  const limits = effectiveLimits({ subscription_tier: organization.subscription_tier, custom_limits: custom?.custom_limits });
  const fleet = await loadFleet(admin, organizationId);
  const active = trial ? new Set(fleet.map((vehicle) => vehicle.id)) : chooseActive(limits, fleet, keep ?? organization.plan_keep_vehicle_ids);
  const toPark = options.park ? fleet.filter((vehicle) => !vehicle.parked && !active.has(vehicle.id)).map((vehicle) => vehicle.id) : [];
  const toUnpark = fleet.filter((vehicle) => vehicle.parked && active.has(vehicle.id)).map((vehicle) => vehicle.id);
  const now = new Date().toISOString();
  if (toPark.length) await admin.from("vehicles").update({ parked_at: now }).in("id", toPark).eq("organization_id", organizationId);
  if (toUnpark.length) await admin.from("vehicles").update({ parked_at: null }).in("id", toUnpark).eq("organization_id", organizationId);
  return { parked: toPark.length, unparked: toUnpark.length };
}
