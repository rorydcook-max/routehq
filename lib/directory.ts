/**
 * The public directory at /rent: one search across every listed business's
 * live availability and prices. A booking goes to that business's own online
 * booking page, so from the first tap the customer is theirs.
 */
import { businessToday } from "@/lib/business-time";
import { planById } from "@/lib/plans";
import { publicBookingSettings } from "@/lib/public-catalog";
import { billingPeriodAmounts } from "@/lib/payment-schedule";
import { seasonsFrom, seasonalRate } from "@/lib/price-rules";
import { planFor } from "@/lib/rental-estimate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type DirectorySettings = { enabled: boolean };

export function directorySettings(settings: unknown): DirectorySettings {
  const raw = (settings && typeof settings === "object" ? (settings as Record<string, any>).directory : null) || {};
  return { enabled: raw.enabled === true };
}

/** Listed when the plan includes it or the add-on is paid (everything is on during the trial), and the business switched it on. */
export function canBeListed(organization: { subscription_tier: string | null; subscription_status: string | null; directory_addon?: boolean | null }) {
  const onTrial = String(organization.subscription_status || "trial") === "trial";
  return onTrial || planById(organization.subscription_tier).directoryIncluded || organization.directory_addon === true;
}

export type DirectoryVehicle = {
  id: string;
  make: string;
  model: string;
  year: number | null;
  kind: string;
  seats: number | null;
  transmission: string;
  color: string;
  /** The vehicle's first photo, when one has been uploaded. */
  photoUrl: string | null;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  /** For the dates asked: the rate per period and the total, or the monthly rate when open-ended. */
  quote: { model: "daily" | "weekly" | "monthly"; rate: number; total: number | null };
  deposit: number;
};

export type DirectoryBusiness = {
  slug: string;
  name: string;
  town: string;
  region: string;
  logoUrl: string | null;
  currency: string;
  vehicles: DirectoryVehicle[];
};

export type DirectorySearch = { place: string; startDate: string; endDate: string | null; kind: string | null };

const BUSY = ["booked", "active", "due_soon", "overdue", "extended"];

/**
 * The price for these dates, worked out exactly as the business's own booking page does (same plan rule, same
 * season prices, same period billing), so the directory never promises a price the booking page then refuses.
 * Null when the vehicle can't be booked for the stay (a monthly-only car for a weekend).
 */
function quoteFor(vehicle: { dailyRate: number; weeklyRate: number; monthlyRate: number }, days: number | null, seasons: ReturnType<typeof seasonsFrom>, startDate: string, endDate: string | null): DirectoryVehicle["quote"] | null {
  const plan = planFor(vehicle, days);
  if (!plan) return null;
  const rate = seasonalRate(plan.rate, plan.pricingModel, seasons, startDate, endDate).rate;
  if (days === null || !endDate) return { model: plan.pricingModel, rate, total: null };
  const amounts = plan.pricingModel === "daily" ? [days * rate] : billingPeriodAmounts(startDate, endDate, plan.pricingModel, rate, 52);
  return { model: plan.pricingModel, rate, total: amounts.reduce((sum, amount) => sum + amount, 0) };
}

export async function searchDirectory(input: DirectorySearch): Promise<DirectoryBusiness[]> {
  const admin = createSupabaseAdminClient() as any;
  const { data: organizations } = await admin
    .from("organizations")
    .select("id, slug, name, trading_name, settings, currency, subscription_tier, subscription_status, directory_addon, logo_url, business_logo_storage_bucket, business_logo_storage_path")
    .is("deleted_at", null)
    .eq("settings->directory->>enabled", "true")
    .eq("settings->public_booking->>enabled", "true");
  const place = input.place.trim().toLowerCase();
  const listed = ((organizations || []) as any[]).filter((organization) => {
    if (!organization.slug || !canBeListed(organization)) return false;
    if (!place) return true;
    const location = organization.settings?.main_location || {};
    const haystack = [location.town, location.region, location.label, location.country].map((part) => String(part || "").toLowerCase());
    return haystack.some((part) => part.includes(place));
  });
  if (!listed.length) return [];

  const { data: vehicles } = await admin
    .from("vehicles")
    .select("id, organization_id, make, model, year, color, status, daily_rate, weekly_rate, monthly_rate, deposit_amount, specifications, vehicle_categories(code)")
    .in("organization_id", listed.map((organization) => organization.id))
    .is("deleted_at", null)
    .not("status", "in", "(maintenance,inactive,retired)");
  const priced = ((vehicles || []) as any[]).filter((vehicle) => Number(vehicle.daily_rate) > 0 || Number(vehicle.weekly_rate) > 0 || Number(vehicle.monthly_rate) > 0);
  const wanted = input.kind && input.kind !== "any" ? priced.filter((vehicle) => String(vehicle.vehicle_categories?.code || "") === input.kind) : priced;
  if (!wanted.length) return [];

  const startDate = input.startDate;
  const days = input.endDate ? Math.max(1, Math.round((new Date(`${input.endDate}T00:00:00Z`).getTime() - new Date(`${startDate}T00:00:00Z`).getTime()) / 86_400_000)) : null;
  const end = input.endDate || businessToday(30 + Math.max(0, Math.round((new Date(`${startDate}T00:00:00Z`).getTime() - new Date(`${businessToday()}T00:00:00Z`).getTime()) / 86_400_000)));
  const { data: busy } = await admin
    .from("rentals")
    .select("vehicle_id")
    .in("vehicle_id", wanted.map((vehicle) => vehicle.id))
    .in("status", BUSY)
    .is("deleted_at", null)
    .lte("start_date", end)
    .or(`end_date.is.null,end_date.gte.${startDate}`);
  const taken = new Set(((busy || []) as any[]).map((rental) => rental.vehicle_id));

  // Each vehicle's lead photo (the first in the order set on the vehicle page), as on the business's own page.
  const { data: photos } = await admin
    .from("documents")
    .select("owner_id, storage_path, extracted_data")
    .in("owner_id", wanted.map((vehicle) => vehicle.id))
    .eq("owner_type", "vehicle")
    .eq("category", "vehicle_photo")
    .order("created_at", { ascending: true });
  const leadPhoto = new Map<string, { path: string; order: number }>();
  for (const row of (photos || []) as any[]) {
    if (!row.owner_id || !row.storage_path) continue;
    const order = Number(row.extracted_data?.vehicle_photo_order ?? 9999);
    const current = leadPhoto.get(row.owner_id);
    if (!current || order < current.order) leadPhoto.set(row.owner_id, { path: row.storage_path, order });
  }
  const photoUrls = new Map<string, string>();
  const photoPaths = [...leadPhoto.values()].map((photo) => photo.path);
  if (photoPaths.length) {
    const { data: signed } = await admin.storage.from("documents").createSignedUrls(photoPaths, 6 * 3600);
    for (const row of signed || []) if (row?.path && row?.signedUrl) photoUrls.set(row.path, row.signedUrl);
  }

  const { resolveOrganizationBrandingDisplayUrls } = await import("@/lib/branding-assets");
  const businesses: DirectoryBusiness[] = [];
  for (const organization of listed) {
    const own = wanted.filter((vehicle) => vehicle.organization_id === organization.id && !taken.has(vehicle.id));
    if (!own.length) continue;
    const usualDeposit = publicBookingSettings(organization.settings).deposit;
    const seasons = seasonsFrom(organization.settings);
    const location = organization.settings?.main_location || {};
    let logoUrl: string | null = null;
    try {
      logoUrl = (await resolveOrganizationBrandingDisplayUrls(admin, organization)).logoUrl || null;
    } catch {
      logoUrl = null;
    }
    businesses.push({
      slug: organization.slug,
      name: String(organization.trading_name || organization.name || ""),
      town: String(location.town || ""),
      region: String(location.region || ""),
      logoUrl,
      currency: String(organization.currency || "THB"),
      vehicles: own
        .flatMap((vehicle): DirectoryVehicle[] => {
          const rates = { dailyRate: Number(vehicle.daily_rate || 0), weeklyRate: Number(vehicle.weekly_rate || 0), monthlyRate: Number(vehicle.monthly_rate || 0) };
          const quote = quoteFor(rates, days, seasons, startDate, input.endDate);
          // Not priced for a stay this short (or no monthly price for an open-ended one): not offered.
          if (!quote) return [];
          return [{
            id: vehicle.id,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            kind: String(vehicle.vehicle_categories?.code || ""),
            seats: vehicle.specifications?.seating_capacity ? Number(vehicle.specifications.seating_capacity) : null,
            transmission: String(vehicle.specifications?.transmission || ""),
            color: String(vehicle.color || ""),
            photoUrl: photoUrls.get(leadPhoto.get(vehicle.id)?.path || "") || null,
            ...rates,
            quote,
            deposit: vehicle.deposit_amount != null ? Number(vehicle.deposit_amount) : usualDeposit
          }];
        })
        .sort((a, b) => (a.quote.total ?? a.quote.rate) - (b.quote.total ?? b.quote.rate))
    });
  }
  return businesses.filter((business) => business.vehicles.length > 0).sort((a, b) => a.name.localeCompare(b.name));
}
