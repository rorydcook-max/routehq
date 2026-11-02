/**
 * The paperwork a rental vehicle must keep up, by the business's country (Rory, 2 Nov 2026): every country has some
 * form of vehicle tax or registration and compulsory insurance, most an inspection; the local names differ.
 * The saved fields stay the same everywhere (tax_expiry_date, porbor_expiry_date, insurance_expiry_date,
 * inspection_expiry_date), so a business that moves country keeps its dates.
 */

export type PaperKey = "tax" | "porbor" | "insurance" | "inspection";

export type PaperItem = {
  key: PaperKey;
  /** vehiclePage message key for the plain name in the reader's language. */
  nameKey: string;
  /** The local name people know it by, shown after the plain name; not translated. */
  local?: string;
  /**
   * Only shown when the vehicle needs it or a date is already saved: Thailand's inspection is for cars over 7 years
   * and motorbikes over 5 before road tax can be paid.
   */
  minAge?: { car: number; bike: number };
  /** The money entry a renewal of it is recorded as. */
  costType: "tax" | "insurance" | "other";
  /** An inspection done at the same time as this renewal, for vehicles older than these ages: its cost is asked for here. */
  inspectionWith?: { local: string; car: number; bike: number };
};

const INSURANCE: PaperItem = { key: "insurance", nameKey: "c_insurance", costType: "insurance" };

const BY_COUNTRY: Record<string, PaperItem[]> = {
  // Thailand's inspection (ตรอ.) is done when the road tax is renewed, for cars over 7 years and motorbikes over 5:
  // no date of its own, its cost goes in with the road tax renewal (Rory, 2 Nov 2026).
  TH: [
    { key: "tax", nameKey: "c_tax", costType: "tax", inspectionWith: { local: "ตรอ.", car: 7, bike: 5 } },
    { key: "porbor", nameKey: "c_porbor", costType: "insurance" },
    INSURANCE
  ],
  MY: [
    { key: "tax", nameKey: "c_tax", local: "LKM", costType: "tax" },
    { key: "porbor", nameKey: "c_compulsory", costType: "insurance" },
    INSURANCE,
    { key: "inspection", nameKey: "c_inspection", local: "PUSPAKOM", costType: "other" }
  ],
  ID: [
    { key: "tax", nameKey: "c_registration", local: "PKB / STNK", costType: "tax" },
    { key: "porbor", nameKey: "c_compulsory", local: "SWDKLLJ", costType: "insurance" },
    INSURANCE,
    { key: "inspection", nameKey: "c_inspection", local: "KIR", costType: "other" }
  ],
  PH: [
    { key: "tax", nameKey: "c_registration", local: "LTO", costType: "tax" },
    { key: "porbor", nameKey: "c_compulsory", local: "CTPL", costType: "insurance" },
    INSURANCE,
    { key: "inspection", nameKey: "c_inspection", local: "Emission test", costType: "other" }
  ],
  VN: [
    { key: "tax", nameKey: "c_registration", local: "Phí đường bộ", costType: "tax" },
    { key: "porbor", nameKey: "c_compulsory", local: "Bảo hiểm TNDS", costType: "insurance" },
    INSURANCE,
    { key: "inspection", nameKey: "c_inspection", local: "Đăng kiểm", costType: "other" }
  ]
};

const DEFAULT: PaperItem[] = [
  { key: "tax", nameKey: "c_registration", costType: "tax" },
  { key: "porbor", nameKey: "c_compulsory", costType: "insurance" },
  INSURANCE,
  { key: "inspection", nameKey: "c_inspection", costType: "other" }
];

const NAMES: Record<string, string> = { thailand: "TH", malaysia: "MY", indonesia: "ID", philippines: "PH", vietnam: "VN", "viet nam": "VN" };

/** A two-letter code from the organization's country_code, or a country name ("Thailand"). */
export function countryCode(value: unknown) {
  const text = String(value || "").trim();
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  return NAMES[text.toLowerCase()] || "";
}

/** The paperwork items for a country, in the order shown. */
export function paperworkFor(country: unknown): PaperItem[] {
  return BY_COUNTRY[countryCode(country)] || DEFAULT;
}

/** The saved field for a paperwork item. */
export function paperField(key: PaperKey) {
  return `${key}_expiry_date`;
}

/** Whether an item is shown for this vehicle: age-limited items only once the vehicle is old enough or a date is saved. */
export function paperApplies(item: PaperItem, vehicleAge: number | null, twoWheeler: boolean, savedDate: unknown) {
  if (!item.minAge || savedDate) return true;
  return vehicleAge !== null && vehicleAge > (twoWheeler ? item.minAge.bike : item.minAge.car);
}

/** The money entry type for a renewal of this kind of paperwork in this country. */
export function paperCostType(country: unknown, key: string): "tax" | "insurance" | "other" {
  return paperworkFor(country).find((item) => item.key === key)?.costType || (key === "insurance" || key === "porbor" ? "insurance" : key === "tax" ? "tax" : "other");
}
