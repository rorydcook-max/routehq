/**
 * Which languages the rental agreement is written in (Rory, 3 Nov 2026): always English, plus the language of the
 * country the business is in. The RoveHQ agreement (lib/contract-templates/default-en.html) is kept in English and
 * Thai, exactly as before for a business in Thailand; for any other country lib/agreement-localize.ts swaps the Thai
 * for that country's language when the agreement is rendered (English only where RoveHQ has no translation).
 * Signed agreements are stored as rendered, so they never change.
 *
 * Small and safe in the browser: the translations themselves live in lib/agreement-localize.ts (server side).
 */

export type SecondLanguage = "id" | "vi" | "ms" | "fil" | "lo" | "km" | "el" | "es" | "pt" | "it" | "hr" | "fr" | "de" | "tr";
export type AgreementLanguage = "th" | SecondLanguage | "en";

// Europe (3 Nov 2026): the UK, Ireland and Malta are English only (English is official and the language of business in
// Malta); Greek serves Greece and Cyprus; Portuguese is European Portuguese.
// Türkiye (4 Nov 2026): Turkish, in formal legal register (consumer contracts must be readable in Turkish, Law 6502).
const LANGUAGE_BY_COUNTRY: Record<string, AgreementLanguage> = {
  TH: "th", ID: "id", VN: "vi", MY: "ms", PH: "fil", LA: "lo", KH: "km",
  GB: "en", IE: "en", MT: "en", CY: "el", GR: "el", ES: "es", PT: "pt", IT: "it", HR: "hr", FR: "fr", DE: "de",
  TR: "tr"
};
const COUNTRY_BY_NAME: Record<string, string> = {
  thailand: "TH",
  indonesia: "ID",
  vietnam: "VN",
  "viet nam": "VN",
  malaysia: "MY",
  philippines: "PH",
  "the philippines": "PH",
  laos: "LA",
  "lao pdr": "LA",
  "lao people's democratic republic": "LA",
  cambodia: "KH",
  kampuchea: "KH",
  "united kingdom": "GB",
  "the united kingdom": "GB",
  uk: "GB",
  "great britain": "GB",
  england: "GB",
  scotland: "GB",
  wales: "GB",
  "northern ireland": "GB",
  ireland: "IE",
  "republic of ireland": "IE",
  malta: "MT",
  cyprus: "CY",
  greece: "GR",
  spain: "ES",
  portugal: "PT",
  italy: "IT",
  croatia: "HR",
  france: "FR",
  germany: "DE",
  "türkiye": "TR",
  turkiye: "TR",
  turkey: "TR",
  "republic of türkiye": "TR"
};
const COUNTRY_NAME: Record<string, string> = {
  TH: "Thailand", ID: "Indonesia", VN: "Vietnam", MY: "Malaysia", PH: "the Philippines", LA: "Laos", KH: "Cambodia",
  GB: "the United Kingdom", IE: "Ireland", MT: "Malta", CY: "Cyprus", GR: "Greece", ES: "Spain", PT: "Portugal", IT: "Italy",
  HR: "Croatia", FR: "France", DE: "Germany", TR: "Türkiye"
};

/**
 * Countries outside the EU/UK whose agreements get their own country clauses (lib/contract-templates/country-clauses.ts,
 * guarded by country_<CC>), and the governing law used when the business still has Thailand's default.
 * Türkiye (4 Nov 2026): not EU, so none of the GDPR/eIDAS clauses; its own KVKK, consumer-law, fines and licence clauses.
 */
export const OWN_CLAUSE_JURISDICTION: Record<string, string> = { TR: "the Republic of Türkiye" };

export function hasOwnCountryClauses(countryCode: string) {
  return Object.prototype.hasOwnProperty.call(OWN_CLAUSE_JURISDICTION, String(countryCode || "").toUpperCase());
}

/** EU and EEA countries and the UK: their agreements get the European country clauses (lib/contract-templates/country-clauses.ts). */
const EUROPE = new Set([
  "AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT",
  "RO", "SK", "SI", "ES", "SE", "IS", "LI", "NO", "GB"
]);

export function isEuropeanAgreementCountry(countryCode: string) {
  return EUROPE.has(String(countryCode || "").toUpperCase());
}

/** The governing-law wording for a European country, when the business has not set one (or still has Thailand's). */
export const EUROPEAN_JURISDICTION: Record<string, string> = {
  GB: "England and Wales", IE: "Ireland", MT: "Malta", CY: "the Republic of Cyprus", GR: "Greece", ES: "Spain", PT: "Portugal",
  IT: "Italy", HR: "the Republic of Croatia", FR: "France", DE: "the Federal Republic of Germany"
};

/** Greek serves two countries: the country (accusative, after "στην") and its law, for {{agreement_country_2}} and {{agreement_law_2}}. */
const GREEK_COUNTRY: Record<string, { name: string; law: string }> = {
  GR: { name: "Ελλάδα", law: "το ελληνικό δίκαιο" },
  CY: { name: "Κύπρο", law: "το κυπριακό δίκαιο" }
};

export function secondCountryWords(countryCode: string) {
  return GREEK_COUNTRY[String(countryCode || "").toUpperCase()] || { name: "", law: "" };
}

/**
 * Kilometres or miles for the agreement's distances. A per-business setting (settings.distance_unit, "km" or "mi")
 * wins; without one the UK uses miles and everywhere else kilometres.
 */
export function agreementDistanceUnit(organization: any, countryCode: string): "km" | "mi" {
  const settings = organization?.settings || {};
  const raw = String(settings.distance_unit || organization?.distance_unit || "").toLowerCase();
  if (raw === "mi" || raw === "mile" || raw === "miles") return "mi";
  if (raw === "km" || raw === "kilometre" || raw === "kilometres" || raw === "kilometers") return "km";
  return String(countryCode || "").toUpperCase() === "GB" ? "mi" : "km";
}

function toCode(value: unknown) {
  const text = String(value || "").trim();
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase();
  return COUNTRY_BY_NAME[text.toLowerCase()] || "";
}

/** The business location's country: Settings › Business location first, then the older fields. */
export function agreementCountry(organization: any): { code: string; name: string } {
  const settings = organization?.settings || {};
  const raw = settings.main_location?.country || settings.country || organization?.country_code || "";
  const code = toCode(raw);
  return { code, name: COUNTRY_NAME[code] || String(raw || "").trim() };
}

export function agreementLanguageFor(countryCode: string): AgreementLanguage {
  return LANGUAGE_BY_COUNTRY[String(countryCode || "").toUpperCase()] || "en";
}

export function organizationAgreementLanguage(organization: any): AgreementLanguage {
  return agreementLanguageFor(agreementCountry(organization).code);
}

type Words = {
  period: { once: string; week: string; day: string; month: string };
  due: { once: string; month: string; week: string; day: string; other: string };
  kmPerMonth: string;
  milesPerMonth: string;
  unlimited: string;
  perDay: string;
  paidExtra: string;
};

/** The few words the agreement builds from booking details, in each second language (Thai stays in contract-rendering). */
const WORDS: Record<SecondLanguage, Words> = {
  id: {
    period: { once: "seluruh masa sewa", week: "minggu", day: "hari", month: "bulan" },
    due: { once: "penuh di muka", month: "pada tanggal yang sama setiap bulan", week: "pada hari yang sama setiap minggu", day: "penuh saat serah terima", other: "sesuai kesepakatan" },
    kmPerMonth: "km per bulan",
    milesPerMonth: "mil per bulan",
    unlimited: "Tanpa batas",
    perDay: "per hari",
    paidExtra: "layanan tambahan berbayar"
  },
  vi: {
    period: { once: "toàn bộ thời gian thuê", week: "tuần", day: "ngày", month: "tháng" },
    due: { once: "trả đủ trước", month: "vào cùng ngày mỗi tháng", week: "vào cùng thứ mỗi tuần", day: "trả đủ khi nhận xe", other: "theo thỏa thuận" },
    kmPerMonth: "km mỗi tháng",
    milesPerMonth: "dặm mỗi tháng",
    unlimited: "Không giới hạn",
    perDay: "mỗi ngày",
    paidExtra: "dịch vụ thêm có phí"
  },
  ms: {
    period: { once: "seluruh tempoh sewa", week: "minggu", day: "hari", month: "bulan" },
    due: { once: "penuh secara pendahuluan", month: "pada tarikh yang sama setiap bulan", week: "pada hari yang sama setiap minggu", day: "penuh semasa serahan", other: "seperti yang dipersetujui" },
    kmPerMonth: "km sebulan",
    milesPerMonth: "batu sebulan",
    unlimited: "Tanpa had",
    perDay: "sehari",
    paidExtra: "perkhidmatan tambahan berbayar"
  },
  fil: {
    period: { once: "buong panahon ng upa", week: "linggo", day: "araw", month: "buwan" },
    due: { once: "nang buo bilang paunang bayad", month: "sa parehong petsa bawat buwan", week: "sa parehong araw bawat linggo", day: "nang buo sa paghahatid", other: "ayon sa napagkasunduan" },
    kmPerMonth: "km bawat buwan",
    milesPerMonth: "milya bawat buwan",
    unlimited: "Walang limitasyon",
    perDay: "bawat araw",
    paidExtra: "bayad na dagdag na serbisyo"
  },
  lo: {
    period: { once: "ຕະຫຼອດໄລຍະເວລາເຊົ່າ", week: "ອາທິດ", day: "ມື້", month: "ເດືອນ" },
    due: { once: "ເຕັມຈຳນວນລ່ວງໜ້າ", month: "ວັນດຽວກັນຂອງທຸກເດືອນ", week: "ວັນດຽວກັນຂອງທຸກອາທິດ", day: "ເຕັມຈຳນວນເມື່ອຮັບລົດ", other: "ຕາມທີ່ຕົກລົງກັນ" },
    kmPerMonth: "ກມ. ຕໍ່ເດືອນ",
    milesPerMonth: "ໄມລ໌ ຕໍ່ເດືອນ",
    unlimited: "ບໍ່ຈຳກັດ",
    perDay: "ຕໍ່ມື້",
    paidExtra: "ບໍລິການເສີມ"
  },
  km: {
    period: { once: "រយៈពេលជួលទាំងមូល", week: "សប្តាហ៍", day: "ថ្ងៃ", month: "ខែ" },
    due: { once: "ពេញចំនួនជាមុន", month: "នៅថ្ងៃដដែលរៀងរាល់ខែ", week: "នៅថ្ងៃដដែលរៀងរាល់សប្តាហ៍", day: "ពេញចំនួនពេលទទួលរថយន្ត", other: "តាមការព្រមព្រៀង" },
    kmPerMonth: "គ.ម. ក្នុងមួយខែ",
    milesPerMonth: "ម៉ាយ ក្នុងមួយខែ",
    unlimited: "គ្មានកំណត់",
    perDay: "ក្នុងមួយថ្ងៃ",
    paidExtra: "សេវាបន្ថែម"
  },
  el: {
    period: { once: "όλη τη διάρκεια της μίσθωσης", week: "εβδομάδα", day: "ημέρα", month: "μήνα" },
    due: { once: "ολόκληρο προκαταβολικά", month: "την ίδια ημερομηνία κάθε μήνα", week: "την ίδια ημέρα κάθε εβδομάδα", day: "ολόκληρο κατά την παράδοση", other: "όπως έχει συμφωνηθεί" },
    kmPerMonth: "χλμ. τον μήνα",
    milesPerMonth: "μίλια τον μήνα",
    unlimited: "Απεριόριστα",
    perDay: "ανά ημέρα",
    paidExtra: "πρόσθετη υπηρεσία με χρέωση"
  },
  es: {
    period: { once: "todo el periodo de alquiler", week: "semana", day: "día", month: "mes" },
    due: { once: "íntegramente por adelantado", month: "el mismo día de cada mes", week: "el mismo día de cada semana", day: "íntegramente en la entrega", other: "según lo acordado" },
    kmPerMonth: "km al mes",
    milesPerMonth: "millas al mes",
    unlimited: "Ilimitado",
    perDay: "por día",
    paidExtra: "servicio adicional de pago"
  },
  pt: {
    period: { once: "todo o período de aluguer", week: "semana", day: "dia", month: "mês" },
    due: { once: "na totalidade, antecipadamente", month: "no mesmo dia de cada mês", week: "no mesmo dia de cada semana", day: "na totalidade, na entrega", other: "conforme acordado" },
    kmPerMonth: "km por mês",
    milesPerMonth: "milhas por mês",
    unlimited: "Ilimitada",
    perDay: "por dia",
    paidExtra: "serviço adicional pago"
  },
  it: {
    period: { once: "intero periodo di noleggio", week: "settimana", day: "giorno", month: "mese" },
    due: { once: "per intero in anticipo", month: "lo stesso giorno di ogni mese", week: "lo stesso giorno di ogni settimana", day: "per intero alla consegna", other: "come concordato" },
    kmPerMonth: "km al mese",
    milesPerMonth: "miglia al mese",
    unlimited: "Illimitato",
    perDay: "al giorno",
    paidExtra: "servizio aggiuntivo a pagamento"
  },
  hr: {
    period: { once: "cijelom razdoblju najma", week: "tjednu", day: "danu", month: "mjesecu" },
    due: { once: "u cijelosti unaprijed", month: "istog dana svakog mjeseca", week: "istog dana svakog tjedna", day: "u cijelosti pri predaji", other: "prema dogovoru" },
    kmPerMonth: "km mjesečno",
    milesPerMonth: "milja mjesečno",
    unlimited: "Neograničeno",
    perDay: "po danu",
    paidExtra: "dodatna usluga uz naplatu"
  },
  fr: {
    period: { once: "toute la durée de location", week: "semaine", day: "jour", month: "mois" },
    due: { once: "en totalité d'avance", month: "le même jour chaque mois", week: "le même jour chaque semaine", day: "en totalité à la remise", other: "selon accord" },
    kmPerMonth: "km par mois",
    milesPerMonth: "miles par mois",
    unlimited: "Illimité",
    perDay: "par jour",
    paidExtra: "option payante"
  },
  de: {
    period: { once: "gesamte Mietdauer", week: "Woche", day: "Tag", month: "Monat" },
    due: { once: "vollständig im Voraus", month: "jeweils am selben Tag des Monats", week: "jeweils am selben Wochentag", day: "vollständig bei Übergabe", other: "wie vereinbart" },
    kmPerMonth: "km pro Monat",
    milesPerMonth: "Meilen pro Monat",
    unlimited: "Unbegrenzt",
    perDay: "pro Tag",
    paidExtra: "kostenpflichtige Zusatzleistung"
  },
  // The Turkish clause writes the rate as "{{currency_symbol}}{{rental_rate}} / {{billing_period_label_2}}", so the period
  // stands alone ("ay", "tüm kiralama süresi") without a case ending.
  tr: {
    period: { once: "tüm kiralama süresi", week: "hafta", day: "gün", month: "ay" },
    due: { once: "tamamı peşin olarak", month: "her ay aynı tarihte", week: "her hafta aynı günde", day: "tamamı teslimde", other: "kararlaştırıldığı şekilde" },
    kmPerMonth: "km / ay",
    milesPerMonth: "mil / ay",
    unlimited: "Sınırsız",
    perDay: "günlük",
    paidExtra: "ücretli ek hizmet"
  }
};

export function isSecondLanguage(lang: AgreementLanguage): lang is SecondLanguage {
  return lang !== "th" && lang !== "en";
}

/** The words for a second language other than Thai, or null (Thai and English-only agreements don't use them). */
export function agreementWords(lang: AgreementLanguage): Words | null {
  return isSecondLanguage(lang) ? WORDS[lang] : null;
}

/** "month", "week"... in the second language, for {{billing_period_label_2}}. */
export function secondPeriodLabel(lang: AgreementLanguage, pricingModel: unknown) {
  const words = agreementWords(lang);
  if (!words) return "";
  const model = String(pricingModel || "");
  if (model === "custom" || model === "once") return words.period.once;
  if (model === "weekly") return words.period.week;
  if (model === "daily") return words.period.day;
  return words.period.month;
}

/** "on the same date each month"... in the second language, for {{payment_due_label_2}}. */
export function secondDueLabel(lang: AgreementLanguage, pricingModel: unknown) {
  const words = agreementWords(lang);
  if (!words) return "";
  const model = String(pricingModel || "");
  if (model === "custom" || model === "once") return words.due.once;
  if (model === "monthly") return words.due.month;
  if (model === "weekly") return words.due.week;
  if (model === "daily") return words.due.day;
  return words.due.other;
}
