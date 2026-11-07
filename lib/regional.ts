/**
 * What changes with the business's country (Rory, 3 Nov 2026): distance unit, time zone, currency, VAT.
 * One table, sensible defaults from the country, a few settings the owner can change (Settings › Rentals,
 * "Country and units"). Plain functions, safe in server and client code.
 *
 * Saved in organizations.country_code / timezone / currency (columns) and organizations.settings:
 *   distance_unit "km" | "mi"   (none saved: miles in the UK, km everywhere else)
 *   vat { registered, number, rate, included }
 * Distances are stored as typed, in the business's unit: nothing is converted when the unit changes.
 */

export type DistanceUnit = "km" | "mi";

export type CountryInfo = {
  code: string;
  name: string;
  currency: string;
  /** Time zones a business there can pick; the first is the default. */
  zones: string[];
  unit: DistanceUnit;
  /** The usual VAT / sales tax rate on vehicle hire, percent; a note where it differs by region or length of hire. */
  vat: number;
  vatNote?: string;
  /** The name of the tax on receipts. */
  vatName?: string;
};

// VAT rates checked 3 Nov 2026: European Commission "VAT rates" table (taxation-customs.ec.europa.eu), GOV.UK
// (20%), Revenue.ie (short-term car hire, under 5 weeks in 12 months: reduced rate 13.5%; long-term: 23%), Thailand RD (7%).
// Spain's Canary Islands charge IGIC (7%) instead of IVA; Madeira 22% and the Azores 16% instead of 23%; some Greek islands
// (Leros, Lesvos, Kos, Samos, Chios) have had a reduced 17% rate - check: the owner changes the rate. Other Asian rates are a starting point only.
export const COUNTRIES: CountryInfo[] = [
  { code: "TH", name: "Thailand", currency: "THB", zones: ["Asia/Bangkok"], unit: "km", vat: 7, vatName: "VAT" },
  { code: "MY", name: "Malaysia", currency: "MYR", zones: ["Asia/Kuala_Lumpur"], unit: "km", vat: 8, vatName: "SST" },
  { code: "ID", name: "Indonesia", currency: "IDR", zones: ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"], unit: "km", vat: 12, vatName: "PPN" },
  { code: "PH", name: "Philippines", currency: "PHP", zones: ["Asia/Manila"], unit: "km", vat: 12 },
  { code: "VN", name: "Vietnam", currency: "VND", zones: ["Asia/Ho_Chi_Minh"], unit: "km", vat: 10 },
  { code: "KH", name: "Cambodia", currency: "USD", zones: ["Asia/Phnom_Penh"], unit: "km", vat: 10 },
  { code: "LA", name: "Laos", currency: "LAK", zones: ["Asia/Vientiane"], unit: "km", vat: 10 },
  { code: "SG", name: "Singapore", currency: "SGD", zones: ["Asia/Singapore"], unit: "km", vat: 9, vatName: "GST" },
  { code: "GB", name: "United Kingdom", currency: "GBP", zones: ["Europe/London"], unit: "mi", vat: 20 },
  { code: "IE", name: "Ireland", currency: "EUR", zones: ["Europe/Dublin"], unit: "km", vat: 13.5, vatNote: "ie" },
  { code: "ES", name: "Spain", currency: "EUR", zones: ["Europe/Madrid", "Atlantic/Canary"], unit: "km", vat: 21, vatName: "IVA", vatNote: "es" },
  { code: "PT", name: "Portugal", currency: "EUR", zones: ["Europe/Lisbon", "Atlantic/Madeira", "Atlantic/Azores"], unit: "km", vat: 23, vatName: "IVA", vatNote: "pt" },
  { code: "IT", name: "Italy", currency: "EUR", zones: ["Europe/Rome"], unit: "km", vat: 22, vatName: "IVA" },
  { code: "GR", name: "Greece", currency: "EUR", zones: ["Europe/Athens"], unit: "km", vat: 24, vatName: "ΦΠΑ", vatNote: "gr" },
  { code: "HR", name: "Croatia", currency: "EUR", zones: ["Europe/Zagreb"], unit: "km", vat: 25, vatName: "PDV" },
  { code: "CY", name: "Cyprus", currency: "EUR", zones: ["Asia/Nicosia"], unit: "km", vat: 19, vatName: "ΦΠΑ" },
  { code: "MT", name: "Malta", currency: "EUR", zones: ["Europe/Malta"], unit: "km", vat: 18 },
  { code: "FR", name: "France", currency: "EUR", zones: ["Europe/Paris"], unit: "km", vat: 20, vatName: "TVA" },
  { code: "DE", name: "Germany", currency: "EUR", zones: ["Europe/Berlin"], unit: "km", vat: 19, vatName: "MwSt." },
  // Türkiye (4 Nov 2026): KDV general rate 20% since 10 July 2023 (Presidential Decision 7346, Resmî Gazete 7 Jul 2023);
  // vehicle rental is not on the reduced-rate lists (accommodation is 10%). Prices to the public normally include KDV.
  // One time zone (Europe/Istanbul, UTC+3 all year). The name is the one Intl and the customer lists use ("Türkiye").
  { code: "TR", name: "Türkiye", currency: "TRY", zones: ["Europe/Istanbul"], unit: "km", vat: 20, vatName: "KDV" }
];

const BY_CODE = new Map(COUNTRIES.map((country) => [country.code, country]));
const BY_NAME: Record<string, string> = {
  ...Object.fromEntries(COUNTRIES.map((country) => [country.name.toLowerCase(), country.code])),
  uk: "GB", "great britain": "GB", britain: "GB", england: "GB", scotland: "GB", wales: "GB", "northern ireland": "GB",
  "united kingdom of great britain and northern ireland": "GB", "republic of ireland": "IE", eire: "IE", éire: "IE",
  españa: "ES", espana: "ES", "canary islands": "ES", canarias: "ES", "balearic islands": "ES", mallorca: "ES",
  italia: "IT", "ελλάδα": "GR", hellas: "GR", hrvatska: "HR", "κύπρος": "CY", deutschland: "DE", "viet nam": "VN",
  madeira: "PT", azores: "PT", açores: "PT", "lao pdr": "LA", "kingdom of thailand": "TH", "ประเทศไทย": "TH", "ไทย": "TH",
  turkey: "TR", turkiye: "TR", "türkiye": "TR", "republic of türkiye": "TR", "republic of turkey": "TR", "türkiye cumhuriyeti": "TR"
};

/** A two-letter country code from a code ("gb", "UK") or a name ("United Kingdom", "España"); "" when unknown. */
export function toCountryCode(value: unknown): string {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^uk$/i.test(text)) return "GB";
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  return BY_NAME[text.toLowerCase()] || "";
}

export function countryInfo(value: unknown): CountryInfo | null {
  return BY_CODE.get(toCountryCode(value)) || null;
}

/** The business's country code: the saved column, else the setup answer, else Thailand. */
export function orgCountry(organization: any): string {
  return toCountryCode(organization?.country_code) || toCountryCode(organization?.settings?.main_location?.country) || "TH";
}

const settingsOf = (organization: any): Record<string, any> =>
  organization?.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings) ? organization.settings : {};

/** Miles or kilometres for this business: the saved choice, else miles in the UK and km everywhere else. */
export function distanceUnitFor(organization: any): DistanceUnit {
  const saved = settingsOf(organization).distance_unit;
  if (saved === "mi" || saved === "km") return saved;
  return countryInfo(orgCountry(organization))?.unit || "km";
}

/** The time zone a business in this country (and, for Spain and Portugal, region) normally uses. */
export function defaultTimeZone(country: unknown): string {
  return countryInfo(country)?.zones[0] || "Asia/Bangkok";
}

export function defaultCurrency(country: unknown): string {
  return countryInfo(country)?.currency || "USD";
}

/** A time zone name Intl understands; anything else falls back to the country's default. */
export function validTimeZone(zone: unknown, country?: unknown): string {
  const text = String(zone || "").trim();
  if (text) {
    try {
      new Intl.DateTimeFormat("en", { timeZone: text });
      return text;
    } catch {
      // fall through
    }
  }
  return defaultTimeZone(country);
}

export type VatSettings = {
  /** Registered for VAT / sales tax: off unless the owner switches it on. */
  on: boolean;
  number: string;
  /** Percent, e.g. 20. */
  rate: number;
  /** Prices typed in RoveHQ already include the tax (usual for renting to the public in Europe). */
  included: boolean;
  /** "VAT", "IVA", "TVA"... for receipts. */
  name: string;
};

export function vatSettings(organization: any): VatSettings {
  const saved = settingsOf(organization).vat || {};
  const country = countryInfo(orgCountry(organization));
  const rate = Number(saved.rate);
  return {
    on: saved.registered === true,
    number: String(saved.number || organization?.registration_or_tax_number || "").trim().slice(0, 40),
    rate: Number.isFinite(rate) && rate >= 0 && rate <= 50 ? rate : country?.vat ?? 0,
    included: saved.included !== false,
    name: country?.vatName || "VAT"
  };
}

const cents = (value: number) => Math.round(value * 100) / 100;

/**
 * The tax in a price. Amounts RoveHQ records are what the customer pays, so with prices that include VAT the tax is
 * the share inside it; with prices that don't, it is added on top (net is the price, gross what is paid).
 * Null when the business doesn't charge VAT.
 */
export function vatBreakdown(amount: number, vat: Pick<VatSettings, "on" | "rate" | "included">): { net: number; vat: number; gross: number } | null {
  const value = Number(amount) || 0;
  if (!vat.on || !(vat.rate > 0)) return null;
  const rate = vat.rate / 100;
  if (vat.included) {
    const net = cents(value / (1 + rate));
    return { net, vat: cents(value - net), gross: cents(value) };
  }
  const tax = cents(value * rate);
  return { net: cents(value), vat: tax, gross: cents(value + tax) };
}

/** What the customer pays for a price typed in RoveHQ: the price itself, or price plus VAT when prices exclude it. */
export function withVat(amount: number, vat: Pick<VatSettings, "on" | "rate" | "included">): number {
  const parts = vatBreakdown(amount, vat);
  return parts ? parts.gross : Number(amount) || 0;
}

/** A Intl locale for money and numbers: the reader's language with the business's country ("en-GB", "es-ES"). */
export function moneyLocale(language: string | null | undefined, country?: unknown): string {
  const lang = String(language || "en").split("-")[0] || "en";
  const code = toCountryCode(country);
  if (!code) return lang === "en" ? "en-GB" : `${lang}-u-nu-latn`;
  const candidate = `${lang}-${code}`;
  try {
    return Intl.NumberFormat.supportedLocalesOf([candidate]).length ? candidate : lang === "en" ? "en-GB" : lang;
  } catch {
    return "en-GB";
  }
}

/** 1234.5 -> "£1,234.50" / "1234,50 €" / "฿1,235": whole amounts without decimals, others with two. */
export function formatMoney(amount: unknown, currency: string | null | undefined, locale = "en-GB"): string {
  const value = Number(amount) || 0;
  const code = String(currency || "THB").toUpperCase();
  const whole = Math.abs(value - Math.round(value)) < 0.005 || code === "THB" || code === "IDR" || code === "VND" || code === "LAK";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code, currencyDisplay: "narrowSymbol", minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: whole ? 0 : 2 }).format(whole ? Math.round(value) : value);
  } catch {
    return `${code} ${value.toLocaleString("en-GB")}`;
  }
}

/** 12345 + "mi" -> "12,345 mi". */
export function formatDistance(value: unknown, unit: DistanceUnit, locale = "en-GB"): string {
  const number = Math.round(Number(value) || 0);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(number)} ${unit}`;
}

/** Miles and kilometres, for maths that is done in one unit (the buying calculator's per-km costs). */
export const KM_PER_MILE = 1.609344;
export function toKm(value: number, unit: DistanceUnit) {
  return unit === "mi" ? value * KM_PER_MILE : value;
}
export function fromKm(km: number, unit: DistanceUnit) {
  return unit === "mi" ? km / KM_PER_MILE : km;
}

/** ["Lisbon", "Lisbon", "Portugal"] -> "Lisbon, Portugal": the parts of a place, empty and repeated ones left out. */
export function placeLabel(parts: unknown[]): string {
  const seen = new Set<string>();
  return parts
    .map((part) => String(part || "").trim())
    .filter((part) => {
      const key = part.toLowerCase();
      if (!part || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .join(", ");
}

// Places a time zone name doesn't say plainly.
const ZONE_NAMES: Record<string, string> = { "Atlantic/Canary": "Canary Islands", "Atlantic/Madeira": "Madeira", "Atlantic/Azores": "Azores", "Asia/Nicosia": "Cyprus" };

/** "Europe/Lisbon" -> "Lisbon". */
export function zoneName(zone: string): string {
  return ZONE_NAMES[zone] || (zone.split("/").pop() || zone).replace(/_/g, " ");
}

/** "(UTC+7)", "(UTC+0)": so the owner can see the zone is right at a glance. Empty when the zone is unknown. */
export function zoneOffset(zone: string): string {
  try {
    const part = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "shortOffset" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName");
    if (!part) return "";
    const value = part.value === "GMT" ? "UTC+0" : part.value.replace("GMT", "UTC");
    return `(${value})`;
  } catch {
    return "";
  }
}

/** "Europe/Lisbon" -> "Lisbon (UTC+0)". */
export function zoneLabel(zone: string): string {
  return `${zoneName(zone)} ${zoneOffset(zone)}`.trim();
}

/** The time zone for a place: the Canaries, Madeira and the Azores keep their own clocks; elsewhere the country's. */
export function timeZoneForPlace(country: unknown, region?: unknown, town?: unknown): string {
  const code = toCountryCode(country);
  const place = `${String(region || "")} ${String(town || "")}`.toLowerCase();
  if (code === "ES" && /canar|tenerife|gran canaria|lanzarote|fuerteventura|la palma|gomera|hierro/.test(place)) return "Atlantic/Canary";
  if (code === "PT" && /madeira|funchal|porto santo/.test(place)) return "Atlantic/Madeira";
  if (code === "PT" && /azores|açores|ponta delgada|terceira/.test(place)) return "Atlantic/Azores";
  return defaultTimeZone(code);
}
