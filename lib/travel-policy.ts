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
  owner_line_id: string;
  owner_whatsapp: string;
  promptpay_id: string;
};

export const jurisdictionByCountry: Record<string, string> = {
  Thailand: "the Kingdom of Thailand",
  Indonesia: "the Republic of Indonesia",
  Philippines: "the Republic of the Philippines",
  Malaysia: "Malaysia",
  Singapore: "the Republic of Singapore",
  Vietnam: "the Socialist Republic of Vietnam",
  Australia: "Australia",
  "United Kingdom": "England and Wales"
};

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
