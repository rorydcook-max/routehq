import { COUNTRY_NAMES, countryCodeOf, detectIsland, islandById, placeKind, placeName, placesFor } from "@/lib/travel-places";

export type HomeTerritoryType = "island" | "mainland";
export type IslandTravelPolicy = "deposit_required" | "notice_only" | "not_permitted";

export type TravelPolicySettings = {
  home_territory: string;
  home_territory_type: HomeTerritoryType;
  island_travel_policy: IslandTravelPolicy;
  secondary_deposit_amount: number;
  geofence_monitoring_enabled: boolean;
  country: string;
  jurisdiction: string;
  mileage_limit: number;
  fuel_charge_per_increment: number;
  late_fee_percentage: number;
  cleaning_fee_minimum: number;
  smoking_fee_maximum: number;
  emergency_repair_limit: number;
  deposit_return_days: number;
  /** Fees and limits the business has switched off (Rory, 27 Oct): left out of the agreement; distance off = unlimited. */
  fees_off: FeeKey[];
  owner_line_id: string;
  owner_whatsapp: string;
  promptpay_id: string;
};

/** The fees and limits in Settings, each of which can be switched off. */
export const FEE_KEYS = [
  "mileage_limit",
  "fuel_charge_per_increment",
  "late_fee_percentage",
  "cleaning_fee_minimum",
  "smoking_fee_maximum",
  "emergency_repair_limit",
  "deposit_return_days"
] as const;
export type FeeKey = (typeof FEE_KEYS)[number];

export function feeOn(settings: Pick<TravelPolicySettings, "fees_off">, key: FeeKey) {
  return !settings.fees_off.includes(key);
}

export const jurisdictionByCountry: Record<string, string> = {
  Thailand: "the Kingdom of Thailand",
  Indonesia: "the Republic of Indonesia",
  Philippines: "the Republic of the Philippines",
  Malaysia: "Malaysia",
  Singapore: "the Republic of Singapore",
  Vietnam: "the Socialist Republic of Vietnam",
  Australia: "Australia",
  Laos: "the Lao People's Democratic Republic",
  Cambodia: "the Kingdom of Cambodia",
  "United Kingdom": "England and Wales",
  // The business location stores a country code, so codes are listed too (an Indonesian business with only a
  // location set was getting Thailand's governing law).
  TH: "the Kingdom of Thailand",
  ID: "the Republic of Indonesia",
  PH: "the Republic of the Philippines",
  MY: "Malaysia",
  SG: "the Republic of Singapore",
  VN: "the Socialist Republic of Vietnam",
  LA: "the Lao People's Democratic Republic",
  KH: "the Kingdom of Cambodia",
  AU: "Australia",
  // Europe (3 Nov 2026).
  Ireland: "Ireland",
  Malta: "Malta",
  Cyprus: "the Republic of Cyprus",
  Greece: "Greece",
  Spain: "Spain",
  Portugal: "Portugal",
  Italy: "Italy",
  Croatia: "the Republic of Croatia",
  France: "France",
  Germany: "the Federal Republic of Germany",
  GB: "England and Wales",
  IE: "Ireland",
  MT: "Malta",
  CY: "the Republic of Cyprus",
  GR: "Greece",
  ES: "Spain",
  PT: "Portugal",
  IT: "Italy",
  HR: "the Republic of Croatia",
  FR: "France",
  DE: "the Federal Republic of Germany",
  // Türkiye (4 Nov 2026): the official English name since 2022 (UN registration); "Turkey" kept for older settings.
  "Türkiye": "the Republic of Türkiye",
  Turkey: "the Republic of Türkiye",
  TR: "the Republic of Türkiye",
  // The rest of the countries setup offers (7 Nov 2026), so every business gets its own country's law, never Thailand's.
  JP: "Japan",
  CN: "the People's Republic of China",
  TW: "Taiwan",
  KR: "the Republic of Korea",
  BN: "Brunei Darussalam",
  IN: "the Republic of India",
  BD: "the People's Republic of Bangladesh",
  LK: "the Democratic Socialist Republic of Sri Lanka"
};

/** The laws a location in this country can choose (Settings › Travel area): the country's, and the UK's three. */
export function lawOptionsFor(countryCode: string): string[] {
  if (countryCode === "GB") return ["England and Wales", "Northern Ireland", "Scotland"];
  const law = jurisdictionByCountry[countryCode];
  return law ? [law] : [];
}

/** The law a location starts with: Scotland and Northern Ireland have their own; elsewhere the country's. */
export function defaultLawFor(countryCode: string, regionTexts: Array<string | null | undefined> = []) {
  const region = regionTexts.filter(Boolean).join(" ").toLowerCase();
  if (countryCode === "GB" && /scotland|edinburgh|glasgow|inverness|aberdeen/.test(region)) return "Scotland";
  if (countryCode === "GB" && /northern ireland|belfast|derry/.test(region)) return "Northern Ireland";
  return jurisdictionByCountry[countryCode] || "";
}

export const travelPolicyDefaults: TravelPolicySettings = {
  home_territory: "Koh Samui",
  home_territory_type: "island",
  island_travel_policy: "deposit_required",
  secondary_deposit_amount: 5000,
  geofence_monitoring_enabled: false,
  country: "Thailand",
  jurisdiction: jurisdictionByCountry.Thailand,
  mileage_limit: 1500,
  fuel_charge_per_increment: 150,
  late_fee_percentage: 5,
  cleaning_fee_minimum: 500,
  smoking_fee_maximum: 2000,
  emergency_repair_limit: 2000,
  deposit_return_days: 5,
  fees_off: [],
  owner_line_id: "",
  owner_whatsapp: "",
  promptpay_id: ""
};

function numberSetting(settings: Record<string, any>, key: keyof TravelPolicySettings) {
  const value = Number(settings[key]);
  return Number.isFinite(value) ? value : Number(travelPolicyDefaults[key]);
}

export function getTravelPolicySettings(settings: Record<string, any> | null | undefined): TravelPolicySettings {
  const source = settings || {};
  const country = String(source.country || source.main_location?.country || travelPolicyDefaults.country);
  const territory = String(source.home_territory || source.main_location?.town || source.location || travelPolicyDefaults.home_territory);
  const homeTerritoryType = source.home_territory_type === "mainland" ? "mainland" : "island";
  const islandTravelPolicy = ["deposit_required", "notice_only", "not_permitted"].includes(source.island_travel_policy)
    ? source.island_travel_policy
    : travelPolicyDefaults.island_travel_policy;

  return {
    home_territory: territory,
    home_territory_type: homeTerritoryType,
    island_travel_policy: islandTravelPolicy,
    secondary_deposit_amount: numberSetting(source, "secondary_deposit_amount"),
    geofence_monitoring_enabled: Boolean(source.geofence_monitoring_enabled),
    country,
    jurisdiction: String(source.jurisdiction || jurisdictionByCountry[country] || travelPolicyDefaults.jurisdiction),
    mileage_limit: numberSetting(source, "mileage_limit"),
    fuel_charge_per_increment: numberSetting(source, "fuel_charge_per_increment"),
    late_fee_percentage: numberSetting(source, "late_fee_percentage"),
    cleaning_fee_minimum: numberSetting(source, "cleaning_fee_minimum"),
    smoking_fee_maximum: numberSetting(source, "smoking_fee_maximum"),
    emergency_repair_limit: numberSetting(source, "emergency_repair_limit"),
    deposit_return_days: numberSetting(source, "deposit_return_days"),
    fees_off: Array.isArray(source.fees_off) ? (source.fees_off as string[]).filter((key): key is FeeKey => (FEE_KEYS as readonly string[]).includes(key)) : [],
    owner_line_id: String(source.owner_line_id || source.line_id || ""),
    owner_whatsapp: String(source.owner_whatsapp || source.whatsapp || ""),
    promptpay_id: String(source.promptpay_id || "")
  };
}

export function mergeTravelPolicySettings(settings: Record<string, any> | null | undefined, updates: Partial<TravelPolicySettings>) {
  return {
    ...(settings || {}),
    ...updates
  };
}

/* ------------------------------------------------------------------------------------------------------------------
 * Travel rules per location (Rory, 7 Nov 2026). Each of the business's locations (branches) has its own rules:
 * how far the vehicle may go, a Yes/No for each nearby country or island (lib/travel-places.ts) with an optional extra
 * deposit and/or notice for each Yes, and whose law applies. Saved in organizations.settings.travel_rules:
 *   { default: LocationTravelRules, locations: { [branchId]: LocationTravelRules } }
 * `default` is the main (first) location's rules and what every location without its own rules uses. A business that
 * has never saved them gets its old business-wide policy converted (legacyLocationRules), so nothing is lost; the old
 * fields stay in settings and are kept in step with the main location for anything that still reads them.
 * One-way returns are phase 2.
 * ------------------------------------------------------------------------------------------------------------------ */

export type PlaceRule = { allowed: boolean; deposit: number; notice: boolean };

export type LocationTravelRules = {
  /** The island the location is on (lib/travel-places.ts ISLANDS id), or "" for the mainland / not a listed island. */
  area: string;
  limit: "none" | "radius";
  /** In the business's distance unit. */
  radius: number;
  /** The place the distance is measured from, as written in agreements ("Koh Samui", "Lamai branch"). */
  anchor: string;
  /** Answers for nearby places; a place with no answer is a No. */
  places: Record<string, PlaceRule>;
  law: string;
};

export type TravelRulesStore = { default?: LocationTravelRules; locations?: Record<string, LocationTravelRules> };

export type TravelLocation = {
  id: string;
  name: string;
  /** Texts that tell where it is, most trusted first (town, name, address, region). */
  texts: string[];
  regionTexts: string[];
  rules: LocationTravelRules;
  /** Rules saved for this location itself (false: it uses the main location's). */
  own: boolean;
};

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});
const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : 0;
};

/** The business's country code for travel rules: the saved column, else the setup answer (any country setup offers). */
export function travelCountryCode(organization: any): string {
  const settings = record(organization?.settings);
  return countryCodeOf(organization?.country_code) || countryCodeOf(settings.main_location?.country) || countryCodeOf(settings.country) || "TH";
}

/** Clean rules from a form or settings; anything missing comes from `fallback`. */
export function cleanLocationRules(raw: unknown, fallback: LocationTravelRules): LocationTravelRules {
  const source = record(raw);
  const places: Record<string, PlaceRule> = {};
  const rawPlaces = source.places === undefined ? fallback.places : record(source.places);
  for (const [id, value] of Object.entries(rawPlaces).slice(0, 80)) {
    if (!/^(country|mainland|island|group|special):[A-Za-z0-9-]{1,40}$/.test(id)) continue;
    const rule = record(value);
    places[id] = { allowed: rule.allowed === true, deposit: amount(rule.deposit), notice: rule.notice === true };
  }
  const radius = Math.round(Number(source.radius ?? fallback.radius));
  return {
    area: source.area === undefined ? fallback.area : islandById(String(source.area)) ? String(source.area) : "",
    limit: (source.limit ?? fallback.limit) === "radius" ? "radius" : "none",
    radius: Number.isFinite(radius) && radius > 0 ? Math.min(radius, 100000) : 0,
    anchor: String(source.anchor ?? fallback.anchor ?? "").trim().slice(0, 120),
    places,
    law: String(source.law ?? fallback.law ?? "").trim().slice(0, 160) || fallback.law
  };
}

/** The old business-wide policy as location rules: the old island rule answers the island and mainland questions. */
export function legacyLocationRules(settings: Record<string, any> | null | undefined, countryCode: string): LocationTravelRules {
  const source = record(settings);
  const main = record(source.main_location);
  const texts = [main.town, source.home_territory, main.label, main.region];
  const area = source.home_territory_type === "mainland" ? "" : detectIsland(countryCode, texts);
  const places: Record<string, PlaceRule> = {};
  const policy = source.island_travel_policy;
  if (policy === "deposit_required" || policy === "notice_only" || policy === "not_permitted") {
    for (const id of placesFor(countryCode, area, [main.region, main.town])) {
      if (placeKind(id) === "country" || placeKind(id) === "special") continue;
      places[id] = {
        allowed: policy !== "not_permitted",
        deposit: policy === "deposit_required" ? amount(source.secondary_deposit_amount) : 0,
        notice: policy === "notice_only"
      };
    }
  }
  const savedLaw = String(source.jurisdiction || "").trim();
  return {
    area,
    limit: "none",
    radius: 0,
    anchor: String(main.town || source.home_territory || "").trim(),
    places,
    law: savedLaw || defaultLawFor(countryCode, [main.region, main.town]) || travelPolicyDefaults.jurisdiction
  };
}

export function storedTravelRules(settings: Record<string, any> | null | undefined): TravelRulesStore {
  const store = record(record(settings).travel_rules);
  return { default: store.default ? (store.default as LocationTravelRules) : undefined, locations: record(store.locations) as Record<string, LocationTravelRules> };
}

/** The main location's rules: what a location without its own rules (or a page that doesn't know the location) uses. */
export function defaultLocationRules(settings: Record<string, any> | null | undefined, countryCode: string): LocationTravelRules {
  const legacy = legacyLocationRules(settings, countryCode);
  const stored = storedTravelRules(settings).default;
  return stored ? cleanLocationRules(stored, legacy) : legacy;
}

/** The rules for a booking's pickup location (its branch id), else the main location's. */
export function rulesForLocation(settings: Record<string, any> | null | undefined, countryCode: string, branchId?: string | null): LocationTravelRules {
  const fallback = defaultLocationRules(settings, countryCode);
  const own = branchId ? storedTravelRules(settings).locations?.[branchId] : undefined;
  return own ? cleanLocationRules(own, fallback) : fallback;
}

/**
 * Every location with the rules it is edited with in Settings. A location without rules of its own starts from the
 * main location's, on its own island if its name or address says so.
 */
export function travelLocationsFor(organization: any, branches: Array<{ id: string; name: string; address?: string | null; is_active?: boolean }>): TravelLocation[] {
  const settings = record(organization?.settings);
  const main = record(settings.main_location);
  const country = travelCountryCode(organization);
  const store = storedTravelRules(settings);
  const fallback = defaultLocationRules(settings, country);
  const active = branches.filter((branch) => branch.is_active !== false);
  const list = active.length ? active : branches;
  return list.map((branch, index) => {
    const first = index === 0;
    const genericName = !branch.name || branch.name.trim() === String(organization?.name || "").trim();
    const texts = first ? [main.town, branch.name, branch.address, main.region] : [branch.name, branch.address];
    const regionTexts = first ? [main.region, main.town, branch.address] : [branch.address, branch.name];
    const saved = store.locations?.[branch.id];
    const anchor = first && genericName ? String(main.town || branch.name || "") : branch.name;
    const base: LocationTravelRules = first
      ? { ...fallback, anchor: fallback.anchor || anchor }
      : { ...fallback, area: detectIsland(country, texts), anchor, places: { ...fallback.places } };
    return {
      id: branch.id,
      name: first && genericName ? String(main.town || branch.name || "") : branch.name,
      texts: texts.map((text) => String(text || "")).filter(Boolean),
      regionTexts: regionTexts.map((text) => String(text || "")).filter(Boolean),
      rules: saved ? cleanLocationRules(saved, base) : base,
      own: Boolean(saved)
    };
  });
}

/** Where the vehicle may normally be used, as written in agreements ("Koh Samui", "within 50 km of Lamai"). */
export function territoryText(rules: LocationTravelRules, countryCode: string, unit: "km" | "mi") {
  if (rules.limit === "radius" && rules.radius > 0) {
    const distance = `${rules.radius.toLocaleString("en-US")} ${unit === "mi" ? (rules.radius === 1 ? "mile" : "miles") : "km"}`;
    return `within ${distance} of ${rules.anchor || placeName(rules.area ? `island:${rules.area}` : `country:${countryCode}`)}`;
  }
  if (rules.area) return placeName(`island:${rules.area}`);
  return COUNTRY_NAMES[countryCode] || rules.anchor || countryCode;
}

/** The answers in agreement order: the places customers may go (with deposit and notice) and the ones they may not. */
export function travelPlaceAnswers(rules: LocationTravelRules, countryCode: string, regionTexts: string[] = []) {
  // Only the places the owner is asked about in Settings count: an answer left from another island choice does not.
  const asked = placesFor(countryCode, rules.area, regionTexts);
  const allowed = asked.filter((id) => rules.places[id]?.allowed).map((id) => ({ id, name: placeName(id), deposit: rules.places[id].deposit, notice: rules.places[id].notice }));
  const notAllowed = asked.filter((id) => !rules.places[id]?.allowed).map((id) => ({ id, name: placeName(id) }));
  return { allowed, notAllowed };
}
