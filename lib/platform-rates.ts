import { rentForAge } from "@/lib/rent-age";

/**
 * What rental businesses using RoveHQ actually charge for a model.
 *
 * Small operators rent through marketplaces, walk-ins and partners, so their
 * prices are rarely published anywhere a web search can find. The prices they
 * set in RoveHQ are the real ones. Only a combined middle figure is ever
 * returned, and only when enough different businesses have the model that no
 * single business's price can be worked out from it.
 *
 * Like for like (Rory, 2 Nov 2026): each vehicle's rent is moved to the age and mileage asked about before it is
 * combined, vehicles more than 6 years apart are left out, and the same trim is used on its own when enough
 * businesses have it.
 */

/** Fewest other businesses with the model before a combined figure is shown. */
export const MIN_BUSINESSES = 3;
/** Vehicles further apart in age than this say little about each other's rent. */
const MAX_YEARS_APART = 6;

export type PlatformRates = {
  businesses: number;
  /** "area" when every business counted is in the same region, else "country". */
  scope: "area" | "country";
  /** True when only the same trim was counted. */
  sameTrim?: boolean;
  month?: { low: number; typical: number; high: number };
  day?: { low: number; typical: number; high: number };
};

const same = (a: unknown, b: unknown) => String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();

function spread(values: number[]) {
  const sorted = values.filter((value) => value > 0).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const at = (share: number) => sorted[Math.min(sorted.length - 1, Math.floor(share * (sorted.length - 1) + 0.5))];
  return { low: at(0.25), typical: at(0.5), high: at(0.75) };
}

export async function platformRates(
  admin: any,
  input: { make: string; model: string; country: string; region: string; excludeOrganizationId: string; year?: number | null; mileage?: number | null; trim?: string | null }
): Promise<PlatformRates | null> {
  const { data } = await admin
    .from("vehicles")
    .select("organization_id, monthly_rate, daily_rate, year, mileage, trim, organizations!inner(settings, deleted_at)")
    .ilike("make", input.make)
    .ilike("model", input.model)
    .is("deleted_at", null)
    .neq("organization_id", input.excludeOrganizationId)
    .limit(2000);

  const target = { year: input.year || null, mileage: input.mileage || null };
  const rows = ((data || []) as any[]).filter((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!organization || organization.deleted_at) return false;
    if (target.year && row.year && Math.abs(Number(row.year) - target.year) > MAX_YEARS_APART) return false;
    const place = organization.settings?.main_location || {};
    row.country = place.country || organization.settings?.country;
    row.region = place.region;
    return same(row.country, input.country);
  });

  const count = (list: any[]) => new Set(list.map((row) => row.organization_id)).size;
  // The narrowest set with enough businesses: same trim in the area, same trim in the country, then any trim.
  const nearby = (list: any[]) => list.filter((row) => input.region && same(row.region, input.region));
  const trimmed = input.trim ? rows.filter((row) => same(row.trim, input.trim)) : [];
  const choices: Array<{ list: any[]; scope: "area" | "country"; sameTrim: boolean }> = [
    { list: nearby(trimmed), scope: "area", sameTrim: true },
    { list: trimmed, scope: "country", sameTrim: true },
    { list: nearby(rows), scope: "area", sameTrim: false },
    { list: rows, scope: "country", sameTrim: false }
  ];
  const chosen = choices.find((choice) => count(choice.list) >= MIN_BUSINESSES);
  if (!chosen) return null;
  const used = chosen.list;

  // One figure per business, so a business with twenty of a model does not outweigh the rest; each vehicle's rent is
  // first moved to the age and mileage asked about.
  const perBusiness = (field: "monthly_rate" | "daily_rate") => {
    const byBusiness = new Map<string, number[]>();
    for (const row of used) {
      const value = rentForAge(Number(row[field]) || 0, { year: Number(row.year) || null, mileage: Number(row.mileage) || null }, target, field === "daily_rate" ? 10 : 100);
      if (value > 0) byBusiness.set(row.organization_id, [...(byBusiness.get(row.organization_id) || []), value]);
    }
    if (byBusiness.size < MIN_BUSINESSES) return undefined;
    return spread(Array.from(byBusiness.values()).map((values) => values.reduce((sum, value) => sum + value, 0) / values.length));
  };

  const month = perBusiness("monthly_rate");
  const day = perBusiness("daily_rate");
  if (!month && !day) return null;
  return { businesses: count(used), scope: chosen.scope, sameTrim: chosen.sameTrim, month, day };
}
