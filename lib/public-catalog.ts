import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { releaseExpiredHolds } from "@/lib/booking-holds";
import { bookingRules, earliestStart } from "@/lib/booking-rules";
import { businessToday } from "@/lib/business-time";
import { kindFromCategory, type VehicleKind } from "@/lib/vehicle-groups";

/**
 * The public booking page: anyone with the link sees a business's vehicles,
 * what is free for their dates, and can book one. Nothing here exposes
 * customer names or plates - only "busy from / to".
 */

/** What the booking page offers: monthly rentals with no end date, rentals with set dates, or both (and which one it opens on). */
export type BookingOffer = "both_monthly" | "both_dates" | "monthly" | "dates";
export const BOOKING_OFFERS: BookingOffer[] = ["both_monthly", "both_dates", "monthly", "dates"];
export type PublicBookingSettings = { enabled: boolean; holdHours: number; deposit: number; offer: BookingOffer };

export type CatalogVehicle = {
  id: string;
  name: string;
  year: number | null;
  color: string | null;
  kind: VehicleKind;
  /** The vehicle's first photo, when one has been uploaded. */
  photoUrl: string | null;
  details: string[];
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  /** The deposit for this vehicle: its own, or the business's usual one. */
  deposit: number;
  /** Dates the vehicle is taken (end is exclusive; null = no end date yet). */
  busy: Array<{ startDate: string; endDate: string | null }>;
};

export function publicBookingSettings(settings: any): PublicBookingSettings {
  const raw = settings && typeof settings === "object" ? settings.public_booking : null;
  const hours = Number(raw?.hold_hours);
  const deposit = Number(raw?.deposit);
  return {
    enabled: raw?.enabled === true,
    holdHours: Number.isFinite(hours) && hours > 0 ? Math.min(hours, 168) : 24,
    deposit: Number.isFinite(deposit) && deposit > 0 ? deposit : 0,
    offer: BOOKING_OFFERS.includes(raw?.offer) ? raw.offer : "both_monthly"
  };
}

const HIDDEN_STATUS = /sold|retired|inactive|archived|written|maintenance/i;

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
  await releaseExpiredHolds(admin, organization.id).catch(() => null);
  const rules = bookingRules(organization.settings);

  const [vehiclesResult, rentalsResult, photosResult, branding] = await Promise.all([
    admin
      .from("vehicles")
      .select("id, make, model, trim, year, color, status, daily_rate, weekly_rate, monthly_rate, deposit_amount, specifications, vehicle_categories(code, name)")
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
      .from("documents")
      .select("owner_id, storage_path, extracted_data, created_at")
      .eq("organization_id", organization.id)
      .eq("owner_type", "vehicle")
      .eq("category", "vehicle_photo")
      .order("created_at", { ascending: true }),
    resolveOrganizationBrandingDisplayUrls(admin, organization, { allowExternalUrl: true, expiresIn: 60 * 60 }).catch(() => null)
  ]);

  const busy = new Map<string, CatalogVehicle["busy"]>();
  for (const row of rentalsResult.data || []) {
    if (!row.vehicle_id || !row.start_date) continue;
    const list = busy.get(row.vehicle_id) || [];
    list.push({ startDate: String(row.start_date).slice(0, 10), endDate: row.end_date ? String(row.end_date).slice(0, 10) : null });
    busy.set(row.vehicle_id, list);
  }

  // Each vehicle's lead photo: the first in the order set on the vehicle page.
  const leadPhoto = new Map<string, { path: string; order: number }>();
  for (const row of (photosResult.data || []) as any[]) {
    if (!row.owner_id || !row.storage_path) continue;
    const order = Number(row.extracted_data?.vehicle_photo_order ?? 9999);
    const current = leadPhoto.get(row.owner_id);
    if (!current || order < current.order) leadPhoto.set(row.owner_id, { path: row.storage_path, order });
  }
  const photoPaths = [...leadPhoto.values()].map((photo) => photo.path);
  const photoUrls = new Map<string, string>();
  if (photoPaths.length) {
    const { data: signed } = await admin.storage.from("documents").createSignedUrls(photoPaths, 6 * 3600);
    for (const row of signed || []) if (row?.path && row?.signedUrl) photoUrls.set(row.path, row.signedUrl);
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
        photoUrl: photoUrls.get(leadPhoto.get(vehicle.id)?.path || "") || null,
        details: [specs.transmission, specs.fuel_type, seats > 0 ? `${seats} seats` : null].filter(Boolean).map(String),
        dailyRate: Number(vehicle.daily_rate || 0),
        weeklyRate: Number(vehicle.weekly_rate || 0),
        monthlyRate: Number(vehicle.monthly_rate || 0),
        deposit: vehicle.deposit_amount === null || vehicle.deposit_amount === undefined ? settings.deposit : Math.max(0, Number(vehicle.deposit_amount) || 0),
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
    holdHours: rules.holdHours,
    /** First date a booking may start, from the lead-time rule. */
    minStart: earliestStart(businessToday(), rules.leadHours),
    /** Days kept free around other bookings. */
    gapDays: rules.gapDays,
    deposit: settings.deposit,
    offer: settings.offer,
    vehicles
  };
}

