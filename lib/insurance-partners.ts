/**
 * Insurance quotes inside RouteHQ, from a licensed broker partner (Rory, 25 Oct 2026: embedded quotes for voluntary
 * insurance, and Por Ror Bor). Off until a partner is signed: nothing shows unless its settings are in the hosting
 * environment.
 *
 * Why it is set up this way (OIC good-practice guidelines, in force 24 Jul 2026): RouteHQ isn't licensed as an agent
 * or broker, so the quote and the sale are the partner's, under the partner's licence, and RouteHQ is paid a fixed
 * platform fee, never per policy. Every place the partner appears says so.
 *
 * Settings, per product (INSURANCE_ for voluntary insurance, PORBOR_ for compulsory):
 *   <P>_PARTNER_NAME     the broker's name as customers know it ("Roojai")
 *   <P>_PARTNER_LICENCE  their OIC broker licence number, shown next to their name
 *   <P>_PARTNER_URL      the quote page; {plate} {province} {make} {model} {year} {vin} {cc} {use} are filled in
 *   <P>_PARTNER_EMBED    "1" when the partner allows their page inside RouteHQ; otherwise it opens in a new tab
 */

export type InsuranceProduct = "insurance" | "porbor";
export type InsurancePartner = { product: InsuranceProduct; name: string; licence: string | null; url: string; embed: boolean };
export type QuoteVehicle = { plate?: string | null; province?: string | null; make?: string | null; model?: string | null; year?: number | string | null; vin?: string | null; cc?: number | string | null };

export function insurancePartner(product: InsuranceProduct): Omit<InsurancePartner, "url"> & { urlTemplate: string } | null {
  const prefix = product === "porbor" ? "PORBOR" : "INSURANCE";
  const name = process.env[`${prefix}_PARTNER_NAME`]?.trim();
  const urlTemplate = process.env[`${prefix}_PARTNER_URL`]?.trim();
  if (!name || !urlTemplate || !/^https:\/\//.test(urlTemplate)) return null;
  return { product, name, licence: process.env[`${prefix}_PARTNER_LICENCE`]?.trim() || null, urlTemplate, embed: process.env[`${prefix}_PARTNER_EMBED`] === "1" };
}

/** The partner's quote page for this vehicle, with what they need already filled in. Vehicle details only, never the renter's. */
export function partnerQuote(product: InsuranceProduct, vehicle: QuoteVehicle): InsurancePartner | null {
  const partner = insurancePartner(product);
  if (!partner) return null;
  const values: Record<string, string> = {
    plate: String(vehicle.plate || ""),
    province: String(vehicle.province || ""),
    make: String(vehicle.make || ""),
    model: String(vehicle.model || ""),
    year: String(vehicle.year || ""),
    vin: String(vehicle.vin || ""),
    cc: String(vehicle.cc || ""),
    // A rental car: quoted for commercial (rental) use, not private.
    use: "rental"
  };
  const url = partner.urlTemplate.replace(/\{(plate|province|make|model|year|vin|cc|use)\}/g, (_, key: string) => encodeURIComponent(values[key] || ""));
  return { product, name: partner.name, licence: partner.licence, url, embed: partner.embed };
}
