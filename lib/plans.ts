/**
 * RouteHQ's plans (Rory, 11 Oct 2026; four plans from 26 Oct). Charged by fleet size,
 * with cars and motorbikes counted separately (a motorbike is not "half a car"):
 * a shop with 40 scooters and no cars still fits a small plan. Everything that
 * runs a rental is in every plan, owner tools included. Limits are nudges, never
 * blocks: an operator is never stopped from adding a vehicle or a booking.
 *
 * Prices are set in THB here and shown and charged in the business's own
 * currency (lib/plan-currency.ts), converted and rounded up.
 */

import { isTwoWheeler, kindFromCategory, type VehicleKind } from "@/lib/vehicle-groups";

export type PlanId = "free" | "starter" | "pro" | "business";

export type Plan = {
  id: PlanId;
  /**
   * THB a month. On Business this is the base, which covers the Pro allowance; it is
   * above Pro's price so Pro stays the better buy for a fleet that fits it.
   */
  monthly: number;
  /** Cars (and vans, pickups, anything on four wheels except ATVs) included; null = no limit. */
  cars: number | null;
  /** Motorbikes, scooters, e-bikes and ATVs included; null = no limit. */
  motorbikes: number | null;
  /** Business: THB a month for each car over the included cars. */
  extraCar: number;
  /** Business: THB a month for each motorbike over the included motorbikes. */
  extraMotorbike: number;
  /** Team logins; null = unlimited. */
  team: number | null;
  /** Passport and licence reads a month. */
  documentReads: number;
  /** Rental Vehicle Comparison Calculator lookups a month. */
  comparisonLookups: number;
  accountingExport: boolean;
  severalLocations: boolean;
  /** Logo in the app itself, "Powered by RouteHQ" removable, booking address theirshop.routehq.app. */
  whiteLabel: boolean;
  /** Booking page on the business's own domain (book.theirshop.com). */
  customDomain: boolean;
  /** Import and setup done by RouteHQ, on the yearly plan. */
  setupService: boolean;
  prioritySupport: boolean;
};

/** Yearly costs 11 months. */
export const YEARLY_MONTHS = 11;
/** Partner network finder's fee: share of the first rental payment, one time. */
export const FINDERS_FEE_PCT = 10;
export const TRIAL_DAYS = 30;
export const OVER_LIMIT_GRACE_DAYS = 14;

export const PLANS: Plan[] = [
  { id: "free", monthly: 0, cars: 2, motorbikes: 5, extraCar: 0, extraMotorbike: 0, team: 1, documentReads: 10, comparisonLookups: 2, accountingExport: false, severalLocations: false, whiteLabel: false, customDomain: false, setupService: false, prioritySupport: false },
  { id: "starter", monthly: 490, cars: 8, motorbikes: 20, extraCar: 0, extraMotorbike: 0, team: 2, documentReads: 50, comparisonLookups: 10, accountingExport: true, severalLocations: false, whiteLabel: false, customDomain: false, setupService: false, prioritySupport: false },
  { id: "pro", monthly: 990, cars: 20, motorbikes: 40, extraCar: 0, extraMotorbike: 0, team: null, documentReads: 300, comparisonLookups: 50, accountingExport: true, severalLocations: true, whiteLabel: true, customDomain: false, setupService: true, prioritySupport: false },
  { id: "business", monthly: 1490, cars: null, motorbikes: null, extraCar: 40, extraMotorbike: 15, team: null, documentReads: 1000, comparisonLookups: 200, accountingExport: true, severalLocations: true, whiteLabel: true, customDomain: true, setupService: true, prioritySupport: true }
];

const PRO = PLANS[2];
/** What Business's base price covers before the per-vehicle charges start. */
export const BUSINESS_INCLUDED = { cars: PRO.cars!, motorbikes: PRO.motorbikes! };

export function planById(id: string | null | undefined): Plan {
  // "growth" was folded into Pro on 26 Oct 2026; anything saved with it reads as Pro.
  const wanted = String(id || "").toLowerCase() === "growth" ? "pro" : String(id || "").toLowerCase();
  return PLANS.find((plan) => plan.id === wanted) || PRO;
}

/** A fleet as the plans count it. */
export type FleetMix = { cars: number; motorbikes: number };

/** ATVs rent like bikes (by the hour or day, small and cheap), so they count with motorbikes. */
export function countsAsMotorbike(kind: VehicleKind) {
  return isTwoWheeler(kind) || kind === "atv";
}

type Say = (key: string, values?: Record<string, string | number>) => string;

/** "8 cars and 20 motorbikes" in the reader's language (settingsPage keys). */
export function fleetText(fleet: FleetMix, say: Say) {
  if (!fleet.motorbikes) return say("pl_nCars", { count: fleet.cars });
  if (!fleet.cars) return say("pl_nMotorbikes", { count: fleet.motorbikes });
  return say("pl_both", { cars: say("pl_nCars", { count: fleet.cars }), motorbikes: say("pl_nMotorbikes", { count: fleet.motorbikes }) });
}

type CategoryLike = { id: string; code: string; name: string };

/** Count a fleet into cars and motorbikes from each vehicle's category. */
export function fleetMix(vehicles: Array<{ categoryId?: string | null; category_id?: string | null }>, categories: CategoryLike[]): FleetMix {
  const byId = new Map(categories.map((category) => [category.id, category]));
  let motorbikes = 0;
  for (const vehicle of vehicles) {
    const id = vehicle.categoryId ?? vehicle.category_id ?? null;
    if (countsAsMotorbike(kindFromCategory(id ? byId.get(id) : null))) motorbikes += 1;
  }
  return { cars: vehicles.length - motorbikes, motorbikes };
}

function fits(plan: Plan, fleet: FleetMix) {
  return (plan.cars === null || fleet.cars <= plan.cars) && (plan.motorbikes === null || fleet.motorbikes <= plan.motorbikes);
}

/** Cars and motorbikes over the plan's allowance (Business has none: it charges for them instead). */
export function overBy(plan: Plan, fleet: FleetMix): FleetMix {
  return {
    cars: plan.cars === null ? 0 : Math.max(0, fleet.cars - plan.cars),
    motorbikes: plan.motorbikes === null ? 0 : Math.max(0, fleet.motorbikes - plan.motorbikes)
  };
}

/** Business's extra vehicles: those over the base allowance, which are charged per vehicle. */
export function businessExtras(fleet: FleetMix): FleetMix {
  return {
    cars: Math.max(0, fleet.cars - BUSINESS_INCLUDED.cars),
    motorbikes: Math.max(0, fleet.motorbikes - BUSINESS_INCLUDED.motorbikes)
  };
}

/** The cheapest plan that fits a fleet. */
export function planForFleet(fleet: FleetMix): Plan {
  return PLANS.find((plan) => fits(plan, fleet)) || PLANS[PLANS.length - 1];
}

/**
 * During the trial everything is on, so limits only bite on a paid plan. The
 * "over" counts are what the plans page and the fleet nudge show.
 */
export function vehiclesOverLimit(plan: Plan, fleet: FleetMix, subscriptionStatus: string | null | undefined): FleetMix {
  if (String(subscriptionStatus || "trial") === "trial") return { cars: 0, motorbikes: 0 };
  return overBy(plan, fleet);
}
