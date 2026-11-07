/**
 * The paperwork a rental vehicle must keep up, by the business's country (Rory, 2 Nov 2026): every country has some
 * form of vehicle tax or registration and compulsory insurance, most an inspection; the local names differ.
 * The saved fields stay the same everywhere (tax_expiry_date, porbor_expiry_date, insurance_expiry_date,
 * inspection_expiry_date), so a business that moves country keeps its dates.
 */

import { toCountryCode } from "@/lib/regional";

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
  /**
   * "How to renew" outside Thailand (Thailand has its own step-by-step help): a short note (vehiclePage message key,
   * with the usual interval) and the official page.
   */
  howTo?: { key: string; url?: string };
};

const INSURANCE: PaperItem = { key: "insurance", nameKey: "c_insurance", costType: "insurance" };
/** Europe: third-party cover is compulsory everywhere; hire vehicles need a policy that covers rental. */
const eu = (local?: string): PaperItem => ({ key: "insurance", nameKey: "c_insurance", costType: "insurance", ...(local ? { local } : {}), howTo: { key: "rn_EU_insurance" } });

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
  ],
  // Europe (3 Nov 2026). Intervals are for private cars unless said; minAge hides an inspection until it is first due
  // (shown anyway once a date is saved). Sources: GOV.UK, ncts.ie, DGT, IMT, ilportaledellautomobilista.it, gov.gr,
  // CVH, Cyprus RTD, Transport Malta, service-public.fr, StVZO Anlage VIII (rental cars every 12 months in Germany).
  GB: [
    { key: "tax", nameKey: "c_tax", local: "VED", costType: "tax", howTo: { key: "rn_GB_tax", url: "https://www.gov.uk/vehicle-tax" } },
    eu(),
    { key: "inspection", nameKey: "c_inspection", local: "MOT", minAge: { car: 2, bike: 2 }, costType: "other", howTo: { key: "rn_GB_inspection", url: "https://www.gov.uk/getting-an-mot" } }
  ],
  IE: [
    { key: "tax", nameKey: "c_tax", local: "Motor tax", costType: "tax", howTo: { key: "rn_IE_tax", url: "https://www.motortax.ie" } },
    eu(),
    { key: "inspection", nameKey: "c_inspection", local: "NCT", minAge: { car: 3, bike: 99 }, costType: "other", howTo: { key: "rn_IE_inspection", url: "https://www.ncts.ie" } }
  ],
  ES: [
    { key: "tax", nameKey: "c_tax", local: "IVTM", costType: "tax", howTo: { key: "rn_ES_tax" } },
    eu("Seguro"),
    { key: "inspection", nameKey: "c_inspection", local: "ITV", minAge: { car: 3, bike: 3 }, costType: "other", howTo: { key: "rn_ES_inspection", url: "https://www.dgt.es" } }
  ],
  PT: [
    { key: "tax", nameKey: "c_tax", local: "IUC", costType: "tax", howTo: { key: "rn_PT_tax", url: "https://www.portaldasfinancas.gov.pt" } },
    eu("Seguro"),
    { key: "inspection", nameKey: "c_inspection", local: "IPO", minAge: { car: 3, bike: 3 }, costType: "other", howTo: { key: "rn_PT_inspection", url: "https://www.imt-ip.pt" } }
  ],
  IT: [
    { key: "tax", nameKey: "c_tax", local: "Bollo auto", costType: "tax", howTo: { key: "rn_IT_tax" } },
    eu("Assicurazione RC"),
    { key: "inspection", nameKey: "c_inspection", local: "Revisione", minAge: { car: 3, bike: 3 }, costType: "other", howTo: { key: "rn_IT_inspection", url: "https://www.ilportaledellautomobilista.it" } }
  ],
  GR: [
    { key: "tax", nameKey: "c_tax", local: "Τέλη κυκλοφορίας", costType: "tax", howTo: { key: "rn_GR_tax", url: "https://www.gov.gr" } },
    eu("Ασφάλεια"),
    { key: "inspection", nameKey: "c_inspection", local: "ΚΤΕΟ", minAge: { car: 3, bike: 3 }, costType: "other", howTo: { key: "rn_GR_inspection", url: "https://www.gov.gr" } }
  ],
  HR: [
    { key: "tax", nameKey: "c_registration", local: "Registracija", costType: "tax", howTo: { key: "rn_HR_tax" } },
    eu("Osiguranje"),
    { key: "inspection", nameKey: "c_inspection", local: "Tehnički pregled", costType: "other", howTo: { key: "rn_HR_inspection", url: "https://www.cvh.hr" } }
  ],
  CY: [
    { key: "tax", nameKey: "c_tax", local: "Road tax", costType: "tax", howTo: { key: "rn_CY_tax" } },
    eu(),
    { key: "inspection", nameKey: "c_inspection", local: "MOT", minAge: { car: 3, bike: 3 }, costType: "other", howTo: { key: "rn_CY_inspection" } }
  ],
  MT: [
    { key: "tax", nameKey: "c_tax", local: "Road licence", costType: "tax", howTo: { key: "rn_MT_tax", url: "https://www.transport.gov.mt" } },
    eu(),
    { key: "inspection", nameKey: "c_inspection", local: "VRT", minAge: { car: 3, bike: 3 }, costType: "other", howTo: { key: "rn_MT_inspection", url: "https://www.transport.gov.mt" } }
  ],
  // France has no yearly road tax for cars.
  FR: [
    eu("Assurance"),
    { key: "inspection", nameKey: "c_inspection", local: "Contrôle technique", minAge: { car: 3, bike: 4 }, costType: "other", howTo: { key: "rn_FR_inspection", url: "https://www.service-public.fr" } }
  ],
  DE: [
    { key: "tax", nameKey: "c_tax", local: "Kfz-Steuer", costType: "tax", howTo: { key: "rn_DE_tax", url: "https://www.zoll.de" } },
    eu("Versicherung"),
    { key: "inspection", nameKey: "c_inspection", local: "HU / TÜV", costType: "other", howTo: { key: "rn_DE_inspection", url: "https://www.gesetze-im-internet.de/stvzo_2012/anlage_viii.html" } }
  ],
  // Türkiye (4 Nov 2026). MTV (motor vehicle tax) is paid in two instalments, January and July (GİB); compulsory
  // traffic insurance (Zorunlu Mali Sorumluluk / trafik sigortası, Highway Traffic Act 2918 art. 91) is yearly; kasko is
  // the optional own-damage cover, which the Ministry of Trade's rental regulation (from 1 Jan 2027) expects for cars
  // (or the business's own guarantee). The periodic inspection is done by TÜVTÜRK: private cars first at 3 years, then
  // every 2; commercial vehicles yearly. Whether a rental car counts as commercial for the interval is an open point
  // (content/contracts/tr.yaml), so no minAge: the owner enters the date from the registration document.
  TR: [
    { key: "tax", nameKey: "c_tax", local: "MTV", costType: "tax", howTo: { key: "rn_TR_tax", url: "https://dijital.gib.gov.tr" } },
    { key: "porbor", nameKey: "c_compulsory", local: "Trafik sigortası", costType: "insurance", howTo: { key: "rn_TR_porbor", url: "https://www.sbm.org.tr" } },
    { key: "insurance", nameKey: "c_insurance", local: "Kasko", costType: "insurance" },
    { key: "inspection", nameKey: "c_inspection", local: "TÜVTÜRK muayene", costType: "other", howTo: { key: "rn_TR_inspection", url: "https://www.tuvturk.com.tr" } }
  ]
};

const DEFAULT: PaperItem[] = [
  { key: "tax", nameKey: "c_registration", costType: "tax" },
  { key: "porbor", nameKey: "c_compulsory", costType: "insurance" },
  INSURANCE,
  { key: "inspection", nameKey: "c_inspection", costType: "other" }
];

/** A two-letter code from the organization's country_code, or a country name ("Thailand", "United Kingdom", "España", "UK"). */
export function countryCode(value: unknown) {
  return toCountryCode(value);
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
