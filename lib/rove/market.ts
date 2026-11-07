import "server-only";
import { cache } from "react";
import { clashes } from "@/lib/booking-rules";
import { businessToday } from "@/lib/business-time";
import { directorySettings, canBeListed } from "@/lib/directory";
import { billingPeriodAmounts } from "@/lib/payment-schedule";
import { distanceKm } from "@/lib/place-coords";
import { extrasFor, seasonalRate, type Extra, type Season } from "@/lib/price-rules";
import { getPublicCatalog, publicBookingSettings, type BookingOffer, type CatalogVehicle } from "@/lib/public-catalog";
import { daysBetween, headlineRate, planFor } from "@/lib/rental-estimate";
import { PICKUP_REACH_KM, serviceAreasFor, type ServiceArea } from "@/lib/service-area";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { carSizeOf, engineCcOf, gearboxOf, passesVehicleFilter, seatsOf, type CarSize, type Gearbox, type VehicleFilter } from "@/lib/vehicle-filters";
import { isTwoWheeler, type VehicleKind } from "@/lib/vehicle-groups";
import type { Destination } from "@/lib/rove/destinations";

/**
 * rove.rent's marketplace data (task "roverent", 7 Nov 2026): every vehicle a renter can book from businesses listed
 * on Rove, with availability and prices from the same code as each business's own booking page (getPublicCatalog:
 * expired holds released, booked and held dates, gap days, lead time, high seasons, VAT; the price for a stay worked
 * out exactly as the booking page charges it). So a price shown on Rove is the price the booking page then asks.
 *
 * Listed = directory on (settings.directory.enabled, on by default; test accounts are switched off) AND the online
 * booking page on, with at least one priced vehicle. Nothing here is invented: no listings, prices or ratings that
 * don't come from a listed business.
 */

export type RoveBusiness = {
  organizationId: string;
  slug: string;
  name: string;
  town: string;
  region: string;
  country: string;
  logoUrl: string | null;
  currency: string;
  offer: BookingOffer;
  /** First day a booking may start (the business's lead time). */
  minStart: string;
  gapDays: number;
  seasons: Season[];
  /** Paid (or free) extras from Settings, VAT included; which ones a vehicle offers: extrasForVehicle. */
  extras: Extra[];
  /** Their delivery radius at their main location, in km (0: collect only). */
  deliveryKm: number;
};

export type RoveVehicle = {
  id: string;
  business: RoveBusiness;
  name: string;
  year: number | null;
  color: string | null;
  kind: VehicleKind;
  seats: number | null;
  gearbox: Gearbox | null;
  size: CarSize | null;
  engineCc: number | null;
  fuel: string | null;
  photoCount: number;
  dailyRate: number;
  weeklyRate: number;
  monthlyRate: number;
  deposit: number;
  busy: CatalogVehicle["busy"];
  /** Where it is based (its branch, else the business's main location) and that branch's delivery radius. */
  area: ServiceArea | null;
  specs: Record<string, unknown>;
};

/** What the renter asked for: set dates, a monthly rental with no end date, or just browsing. */
export type Stay = { mode: "dates"; start: string; end: string } | { mode: "monthly"; start: string } | { mode: "any"; start: string };

export type Quote = {
  /** The billing period the booking would use. */
  model: "daily" | "weekly" | "monthly";
  rate: number;
  /** The exact total for set dates; null when open-ended or browsing. */
  total: number | null;
  days: number | null;
  /** For sorting and the budget filter: what it works out at per day. */
  perDay: number;
  /** High-season price applied for these dates. */
  seasonal: boolean;
};

const record = (value: unknown): Record<string, unknown> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {});
const round2 = (value: number) => Math.round(value * 100) / 100;

async function loadMarketUncached(): Promise<{ businesses: RoveBusiness[]; vehicles: RoveVehicle[] }> {
  const admin = createSupabaseAdminClient() as any;
  const { data: organizations } = await admin
    .from("organizations")
    .select("id, slug, name, trading_name, settings, currency, subscription_tier, subscription_status, directory_addon")
    .is("deleted_at", null);
  const listed = ((organizations || []) as any[]).filter(
    (organization) => organization.slug && canBeListed(organization) && directorySettings(organization.settings).enabled && publicBookingSettings(organization.settings).enabled
  );
  if (!listed.length) return { businesses: [], vehicles: [] };
  const ids = listed.map((organization) => organization.id);
  const [{ data: branchRows }, { data: vehicleRows }] = await Promise.all([
    admin.from("branches").select("id, organization_id, name, address, latitude, longitude, service_radius_km, is_active, created_at").in("organization_id", ids).order("created_at", { ascending: true }),
    admin.from("vehicles").select("id, home_branch_id, specifications").in("organization_id", ids).is("deleted_at", null)
  ]);
  const vehicleInfo = new Map<string, { branchId: string | null; specs: Record<string, unknown> }>();
  for (const row of (vehicleRows || []) as any[]) vehicleInfo.set(row.id, { branchId: row.home_branch_id || null, specs: record(row.specifications) });

  const businesses: RoveBusiness[] = [];
  const vehicles: RoveVehicle[] = [];
  // One business at a time: getPublicCatalog sets the business clock for the request.
  for (const organization of listed) {
    const catalog = await getPublicCatalog(String(organization.slug)).catch(() => null);
    if (!catalog || !catalog.enabled || catalog.pageOff || !catalog.vehicles.length) continue;
    const areas = serviceAreasFor(organization, ((branchRows || []) as any[]).filter((row) => row.organization_id === organization.id));
    const main = record(record(organization.settings).main_location);
    const business: RoveBusiness = {
      organizationId: String(organization.id),
      slug: String(organization.slug),
      name: String(organization.trading_name || organization.name || catalog.name),
      town: String(main.town || "").trim(),
      region: String(main.region || "").trim(),
      country: String(main.country || "").trim(),
      logoUrl: catalog.logoUrl && /^https?:\/\//.test(catalog.logoUrl) ? catalog.logoUrl : null,
      currency: catalog.currency,
      offer: catalog.offer,
      minStart: catalog.minStart,
      gapDays: catalog.gapDays,
      seasons: catalog.seasons,
      extras: catalog.extras as Extra[],
      deliveryKm: areas[0]?.radiusKm || 0
    };
    businesses.push(business);
    for (const vehicle of catalog.vehicles) {
      const info = vehicleInfo.get(vehicle.id);
      const specs = info?.specs || {};
      const area = (info?.branchId ? areas.find((candidate) => candidate.branchId === info.branchId) : null) || areas[0] || null;
      vehicles.push({
        id: vehicle.id,
        business,
        name: vehicle.name,
        year: vehicle.year,
        color: vehicle.color,
        kind: vehicle.kind,
        seats: seatsOf(specs),
        gearbox: gearboxOf(specs, vehicle.kind),
        size: vehicle.kind === "car" ? carSizeOf(specs) : null,
        engineCc: engineCcOf(specs),
        fuel: specs.fuel_type ? String(specs.fuel_type) : null,
        photoCount: vehicle.photoUrls.length,
        dailyRate: vehicle.dailyRate,
        weeklyRate: vehicle.weeklyRate,
        monthlyRate: vehicle.monthlyRate,
        deposit: vehicle.deposit,
        busy: vehicle.busy,
        area,
        specs
      });
    }
  }
  return { businesses, vehicles };
}

/** Every listed business and its bookable vehicles, loaded once per request (or per cached page render). */
export const loadMarket = cache(async () => {
  try {
    return await loadMarketUncached();
  } catch {
    return { businesses: [] as RoveBusiness[], vehicles: [] as RoveVehicle[] };
  }
});

/** Cheapest equivalent price per day across a vehicle's own rates (for browsing without dates). */
function cheapestPerDay(vehicle: Pick<RoveVehicle, "dailyRate" | "weeklyRate" | "monthlyRate">) {
  const options = [vehicle.dailyRate, vehicle.weeklyRate / 7, vehicle.monthlyRate / 30].filter((value) => value > 0);
  return options.length ? Math.min(...options) : 0;
}

/**
 * The price for a stay, worked out as the business's booking page does (app/(app)/rent/[slug]/catalog.tsx): the
 * plan rule (planFor), high-season prices, then a day price for each day or one payment per week or month started.
 * Null when the vehicle can't be booked for it (taken, too short for its prices, before the lead time, or a stay the
 * business doesn't offer online).
 */
export function quoteFor(vehicle: RoveVehicle, stay: Stay): Quote | null {
  const business = vehicle.business;
  const start = stay.start < business.minStart ? business.minStart : stay.start;
  if (stay.mode === "dates") {
    if (stay.start < business.minStart || business.offer === "monthly") return null;
    if (vehicle.busy.some((period) => clashes(stay.start, stay.end, period, business.gapDays))) return null;
    const days = daysBetween(stay.start, stay.end);
    const base = planFor(vehicle, days);
    if (!base) return null;
    const season = seasonalRate(base.rate, base.pricingModel, business.seasons, stay.start, stay.end);
    const amounts = base.pricingModel === "daily" ? [days * season.rate] : billingPeriodAmounts(stay.start, stay.end, base.pricingModel, season.rate, 52);
    const total = round2(amounts.reduce((sum, amount) => sum + amount, 0));
    return { model: base.pricingModel, rate: season.rate, total, days, perDay: round2(total / Math.max(1, days)), seasonal: season.pct !== 0 };
  }
  if (stay.mode === "monthly") {
    if (business.offer === "dates") return null;
    if (vehicle.busy.some((period) => clashes(start, null, period, business.gapDays))) return null;
    const base = planFor(vehicle, null);
    if (!base) return null;
    const season = seasonalRate(base.rate, base.pricingModel, business.seasons, start, null);
    return { model: "monthly", rate: season.rate, total: null, days: null, perDay: round2(season.rate / 30), seasonal: season.pct !== 0 };
  }
  // Browsing: the price the business leads with (as on its own page), and whether it's free to start then.
  const headline = headlineRate(vehicle);
  if (!headline) return null;
  const model = headline.per === "day" ? "daily" : headline.per === "week" ? "weekly" : "monthly";
  return { model, rate: headline.amount, total: null, days: null, perDay: round2(cheapestPerDay(vehicle)), seasonal: false };
}

/** When a vehicle that's taken on a date next comes free (null: free then, or taken with no end date yet). */
export function nextFree(vehicle: RoveVehicle, start: string): string | null | "open" {
  // Taken on that day: a booking (or hold) that has started by then and hasn't ended.
  const clash = vehicle.busy.find((period) => period.startDate <= start && (!period.endDate || period.endDate > start));
  if (!clash) return null;
  return clash.endDate || "open";
}

/** Distance from a searched point to where the vehicle is based, and whether it's delivered there. Null: out of reach. */
export function reachFrom(vehicle: RoveVehicle, point: { lat: number; lng: number } | null): { km: number | null; delivers: boolean } | null {
  const area = vehicle.area;
  if (!point) return { km: null, delivers: Boolean(area && area.radiusKm > 0) };
  if (!area) return null;
  const km = distanceKm(point, area);
  if (km > area.radiusKm + PICKUP_REACH_KM) return null;
  return { km: Math.round(km * 10) / 10, delivers: area.radiusKm > 0 && km <= area.radiusKm };
}

export type SearchSort = "price" | "price_desc" | "deposit" | "nearest";
export type MarketSearch = {
  point: { lat: number; lng: number } | null;
  /** A whole destination: vehicles based anywhere in it count (a big island like Crete is more than one town). */
  within?: { center: { lat: number; lng: number }; radiusKm: number } | null;
  stay: Stay;
  filter: VehicleFilter;
  /** Most per day, in the vehicle's own currency; null for no limit. */
  maxPerDay: number | null;
  deliveryOnly: boolean;
  sort: SearchSort;
};

export type SearchResult = { vehicle: RoveVehicle; quote: Quote; km: number | null; delivers: boolean; freeFrom: string | null };

export async function searchMarket(input: MarketSearch): Promise<SearchResult[]> {
  const { vehicles } = await loadMarket();
  const results: SearchResult[] = [];
  for (const vehicle of vehicles) {
    if (!passesVehicleFilter(input.filter, vehicle.kind, vehicle.specs)) continue;
    const inside = input.within && vehicle.area ? distanceKm(input.within.center, vehicle.area) <= input.within.radiusKm : false;
    const reach = reachFrom(vehicle, input.point) || (inside ? { km: null, delivers: Boolean(vehicle.area && vehicle.area.radiusKm > 0) } : null);
    if (!reach) continue;
    if (input.deliveryOnly && !reach.delivers) continue;
    const quote = quoteFor(vehicle, input.stay);
    if (!quote) continue;
    if (input.maxPerDay !== null && quote.perDay > input.maxPerDay) continue;
    let freeFrom: string | null = null;
    if (input.stay.mode === "any") {
      const next = nextFree(vehicle, input.stay.start);
      // Taken with no end date: it can't be booked from Rove at all for now.
      if (next === "open") continue;
      freeFrom = next;
    }
    results.push({ vehicle, quote, km: reach.km, delivers: reach.delivers, freeFrom });
  }
  const byPrice = (a: SearchResult, b: SearchResult) => a.quote.perDay - b.quote.perDay;
  results.sort((a, b) => {
    if (input.sort === "price_desc") return -byPrice(a, b);
    if (input.sort === "deposit") return a.vehicle.deposit - b.vehicle.deposit || byPrice(a, b);
    if (input.sort === "nearest" && input.point) return Math.round(a.km ?? 0) - Math.round(b.km ?? 0) || byPrice(a, b);
    // Free now before "free from", then cheapest.
    return Number(Boolean(a.freeFrom)) - Number(Boolean(b.freeFrom)) || byPrice(a, b);
  });
  return results;
}

/** The vehicles based in a destination (their home location within its radius). */
export async function vehiclesIn(destination: Pick<Destination, "center" | "radiusKm">): Promise<RoveVehicle[]> {
  const { vehicles } = await loadMarket();
  return vehicles.filter((vehicle) => vehicle.area && distanceKm(destination.center, vehicle.area) <= destination.radiusKm);
}

export type PriceRange = { min: number; max: number; count: number };
export type DestinationStats = {
  vehicleCount: number;
  businesses: RoveBusiness[];
  currency: string | null;
  /** Real price ranges from the listed vehicles, by kind and billing period. */
  ranges: Array<{ kind: VehicleKind; daily: PriceRange | null; monthly: PriceRange | null }>;
  deposits: PriceRange | null;
  /** The best monthly saving on a single vehicle that has both a daily and a monthly price. */
  monthlyExample: { vehicle: string; daily: number; monthlyPerDay: number } | null;
};

function range(values: number[]): PriceRange | null {
  const clean = values.filter((value) => value > 0);
  return clean.length ? { min: Math.min(...clean), max: Math.max(...clean), count: clean.length } : null;
}

export function statsFor(vehicles: RoveVehicle[]): DestinationStats {
  const businesses = [...new Map(vehicles.map((vehicle) => [vehicle.business.organizationId, vehicle.business])).values()];
  const kinds = [...new Set(vehicles.map((vehicle) => vehicle.kind))];
  const example = vehicles
    .filter((vehicle) => vehicle.dailyRate > 0 && vehicle.monthlyRate > 0)
    .map((vehicle) => ({ vehicle: vehicle.name, daily: vehicle.dailyRate, monthlyPerDay: Math.round(vehicle.monthlyRate / 30) }))
    .sort((a, b) => b.daily - b.monthlyPerDay - (a.daily - a.monthlyPerDay))[0];
  return {
    vehicleCount: vehicles.length,
    businesses,
    currency: vehicles[0]?.business.currency || null,
    ranges: kinds.map((kind) => {
      const own = vehicles.filter((vehicle) => vehicle.kind === kind);
      return { kind, daily: range(own.map((vehicle) => vehicle.dailyRate)), monthly: range(own.map((vehicle) => vehicle.monthlyRate)) };
    }),
    deposits: range(vehicles.map((vehicle) => vehicle.deposit)),
    monthlyExample: example && example.monthlyPerDay < example.daily ? example : null
  };
}

/** The extras offered with this vehicle, as its booking page offers them. */
export function extrasForVehicle(vehicle: RoveVehicle): Extra[] {
  return extrasFor(vehicle.business.extras, isTwoWheeler(vehicle.kind), vehicle.id);
}

export async function findVehicle(id: string): Promise<RoveVehicle | null> {
  const { vehicles } = await loadMarket();
  return vehicles.find((vehicle) => vehicle.id === id) || null;
}

/** Today on the renter site's clock (Thailand's, where every listed business is today). */
export function roveToday() {
  return businessToday();
}
