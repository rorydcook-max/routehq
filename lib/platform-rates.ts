/**
 * What rental businesses using RouteHQ actually charge for a model.
 *
 * Small operators rent through marketplaces, walk-ins and partners, so their
 * prices are rarely published anywhere a web search can find. The prices they
 * set in RouteHQ are the real ones. Only a combined middle figure is ever
 * returned, and only when enough different businesses have the model that no
 * single business's price can be worked out from it.
 */

/** Fewest other businesses with the model before a combined figure is shown. */
export const MIN_BUSINESSES = 3;

export type PlatformRates = {
  businesses: number;
  /** "area" when every business counted is in the same region, else "country". */
  scope: "area" | "country";
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
  input: { make: string; model: string; country: string; region: string; excludeOrganizationId: string }
): Promise<PlatformRates | null> {
  const { data } = await admin
    .from("vehicles")
    .select("organization_id, monthly_rate, daily_rate, organizations!inner(settings, deleted_at)")
    .ilike("make", input.make)
    .ilike("model", input.model)
    .is("deleted_at", null)
    .neq("organization_id", input.excludeOrganizationId)
    .limit(2000);

  const rows = ((data || []) as any[]).filter((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!organization || organization.deleted_at) return false;
    const place = organization.settings?.main_location || {};
    row.country = place.country || organization.settings?.country;
    row.region = place.region;
    return same(row.country, input.country);
  });

  const count = (list: any[]) => new Set(list.map((row) => row.organization_id)).size;
  const nearby = rows.filter((row) => input.region && same(row.region, input.region));
  const scope = count(nearby) >= MIN_BUSINESSES ? "area" : "country";
  const used = scope === "area" ? nearby : rows;
  const businesses = count(used);
  if (businesses < MIN_BUSINESSES) return null;

  // One figure per business, so a business with twenty of a model does not outweigh the rest.
  const perBusiness = (field: "monthly_rate" | "daily_rate") => {
    const byBusiness = new Map<string, number[]>();
    for (const row of used) {
      const value = Number(row[field]) || 0;
      if (value > 0) byBusiness.set(row.organization_id, [...(byBusiness.get(row.organization_id) || []), value]);
    }
    if (byBusiness.size < MIN_BUSINESSES) return undefined;
    return spread(Array.from(byBusiness.values()).map((values) => values.reduce((sum, value) => sum + value, 0) / values.length));
  };

  const month = perBusiness("monthly_rate");
  const day = perBusiness("daily_rate");
  if (!month && !day) return null;
  return { businesses, scope, month, day };
}
