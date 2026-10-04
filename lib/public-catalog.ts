import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kindFromCategory, type VehicleKind } from "@/lib/vehicle-groups";

/**
 * The public booking page: anyone with the link sees a business's vehicles,
 * what is free for their dates, and can send a request. Nothing here exposes
 * customer names or plates - only "busy from / to".
 */

export type PublicBookingSettings = { enabled: boolean; holdHours: number };

export type CatalogVehicle = {
  id: string;
  name: string;
  year: number | null;
  color: string | null;
  kind: VehicleKind;
  details: string[];
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  /** Dates the vehicle is taken (end is exclusive; null = no end date yet). */
  busy: Array<{ startDate: string; endDate: string | null }>;
};

export type BookingRequestRow = {
  id: string;
  vehicleId: string;
  vehicleName: string;
  startDate: string;
  endDate: string | null;
  customerName: string;
  phone: string;
  message: string | null;
  estimatedTotal: number | null;
  holdUntil: string;
  createdAt: string;
};

export function publicBookingSettings(settings: any): PublicBookingSettings {
  const raw = settings && typeof settings === "object" ? settings.public_booking : null;
  const hours = Number(raw?.hold_hours);
  return { enabled: raw?.enabled === true, holdHours: Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 24 };
}

const HIDDEN_STATUS = /sold|retired|inactive|archived|written/i;

export async function getPublicCatalog(slug: string) {
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin
    .from("organizations")
    .select("*")
    .eq("slug", slug)
    .is("deleted_at", null)
    .maybeSingle();
  if (!organization) return null;

  const settings = publicBookingSettings(organization.settings);
  if (!settings.enabled) return { enabled: false as const, name: String(organization.name || "") };

  const [vehiclesResult, rentalsResult, holdsResult, branding] = await Promise.all([
    admin
      .from("vehicles")
      .select("id, make, model, trim, year, color, status, daily_rate, weekly_rate, monthly_rate, specifications, vehicle_categories(code, name)")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("monthly_rate", { ascending: true }),
    admin
      .from("rentals")
      .select("vehicle_id, start_date, end_date")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[]),
    admin
      .from("booking_requests")
      .select("vehicle_id, start_date, end_date")
      .eq("organization_id", organization.id)
      .eq("status", "pending")
      .gt("hold_until", new Date().toISOString()),
    resolveOrganizationBrandingDisplayUrls(admin, organization, { allowExternalUrl: true, expiresIn: 60 * 60 }).catch(() => null)
  ]);

  const busy = new Map<string, CatalogVehicle["busy"]>();
  for (const row of [...(rentalsResult.data || []), ...(holdsResult.data || [])]) {
    if (!row.vehicle_id || !row.start_date) continue;
    const list = busy.get(row.vehicle_id) || [];
    list.push({ startDate: String(row.start_date).slice(0, 10), endDate: row.end_date ? String(row.end_date).slice(0, 10) : null });
    busy.set(row.vehicle_id, list);
  }

  const vehicles: CatalogVehicle[] = ((vehiclesResult.data || []) as any[])
    .filter((vehicle) => !HIDDEN_STATUS.test(String(vehicle.status || "")))
    .map((vehicle) => {
      const specs = vehicle.specifications && typeof vehicle.specifications === "object" ? vehicle.specifications : {};
      const seats = Number(specs.seating_capacity || 0);
      return {
        id: vehicle.id,
        name: [vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" "),
        year: vehicle.year ? Number(vehicle.year) : null,
        color: vehicle.color || null,
        kind: kindFromCategory(vehicle.vehicle_categories),
        details: [specs.transmission, specs.fuel_type, seats > 0 ? `${seats} seats` : null].filter(Boolean).map(String),
        dailyRate: Number(vehicle.daily_rate || 0),
        weeklyRate: Number(vehicle.weekly_rate || 0),
        monthlyRate: Number(vehicle.monthly_rate || 0),
        busy: busy.get(vehicle.id) || []
      };
    })
    // A vehicle with no price can't be offered to the public.
    .filter((vehicle) => vehicle.dailyRate > 0 || vehicle.weeklyRate > 0 || vehicle.monthlyRate > 0);

  const orgSettings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  return {
    enabled: true as const,
    organizationId: String(organization.id),
    name: String(organization.name || "Vehicle rental"),
    logoUrl: (branding as any)?.logoUrl || null,
    location: String(orgSettings.main_location?.label || orgSettings.location || ""),
    phone: String(orgSettings.business_phone || orgSettings.phone || ""),
    currency: String(organization.currency || "THB"),
    holdHours: settings.holdHours,
    vehicles
  };
}

/** Requests waiting for an answer, for the signed-in member's business. */
export async function getPendingBookingRequests(organizationId: string): Promise<BookingRequestRow[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("booking_requests")
    .select("id, vehicle_id, start_date, end_date, customer_name, phone, message, estimated_total, hold_until, created_at, vehicles(make, model)")
    .eq("organization_id", organizationId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("getPendingBookingRequests", error.message);
    return [];
  }
  return ((data || []) as any[]).map((row) => ({
    id: row.id,
    vehicleId: row.vehicle_id,
    vehicleName: [row.vehicles?.make, row.vehicles?.model].filter(Boolean).join(" ") || "Vehicle",
    startDate: String(row.start_date).slice(0, 10),
    endDate: row.end_date ? String(row.end_date).slice(0, 10) : null,
    customerName: row.customer_name,
    phone: row.phone,
    message: row.message || null,
    estimatedTotal: row.estimated_total != null ? Number(row.estimated_total) : null,
    holdUntil: row.hold_until,
    createdAt: row.created_at
  }));
}
