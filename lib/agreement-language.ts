/**
 * Which languages the rental agreement is written in (Rory, 3 Nov 2026): always English, plus the language of the
 * country the business is in. The RoveHQ agreement (lib/contract-templates/default-en.html) is kept in English and
 * Thai, exactly as before for a business in Thailand; for any other country lib/agreement-localize.ts swaps the Thai
 * for that country's language when the agreement is rendered (English only where RoveHQ has no translation).
 * Signed agreements are stored as rendered, so they never change.
 *
 * Small and safe in the browser: the translations themselves live in lib/agreement-localize.ts (server side).
 */

export type SecondLanguage = "id" | "vi" | "ms" | "fil" | "lo" | "km";
export type AgreementLanguage = "th" | SecondLanguage | "en";

const LANGUAGE_BY_COUNTRY: Record<string, AgreementLanguage> = { TH: "th", ID: "id", VN: "vi", MY: "ms", PH: "fil", LA: "lo", KH: "km" };
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
  kampuchea: "KH"
};
const COUNTRY_NAME: Record<string, string> = { TH: "Thailand", ID: "Indonesia", VN: "Vietnam", MY: "Malaysia", PH: "the Philippines", LA: "Laos", KH: "Cambodia" };

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
    unlimited: "Tanpa batas",
    perDay: "per hari",
    paidExtra: "layanan tambahan berbayar"
  },
  vi: {
    period: { once: "toàn bộ thời gian thuê", week: "tuần", day: "ngày", month: "tháng" },
    due: { once: "trả đủ trước", month: "vào cùng ngày mỗi tháng", week: "vào cùng thứ mỗi tuần", day: "trả đủ khi nhận xe", other: "theo thỏa thuận" },
    kmPerMonth: "km mỗi tháng",
    unlimited: "Không giới hạn",
    perDay: "mỗi ngày",
    paidExtra: "dịch vụ thêm có phí"
  },
  ms: {
    period: { once: "seluruh tempoh sewa", week: "minggu", day: "hari", month: "bulan" },
    due: { once: "penuh secara pendahuluan", month: "pada tarikh yang sama setiap bulan", week: "pada hari yang sama setiap minggu", day: "penuh semasa serahan", other: "seperti yang dipersetujui" },
    kmPerMonth: "km sebulan",
    unlimited: "Tanpa had",
    perDay: "sehari",
    paidExtra: "perkhidmatan tambahan berbayar"
  },
  fil: {
    period: { once: "buong panahon ng upa", week: "linggo", day: "araw", month: "buwan" },
    due: { once: "nang buo bilang paunang bayad", month: "sa parehong petsa bawat buwan", week: "sa parehong araw bawat linggo", day: "nang buo sa paghahatid", other: "ayon sa napagkasunduan" },
    kmPerMonth: "km bawat buwan",
    unlimited: "Walang limitasyon",
    perDay: "bawat araw",
    paidExtra: "bayad na dagdag na serbisyo"
  },
  lo: {
    period: { once: "ຕະຫຼອດໄລຍະເວລາເຊົ່າ", week: "ອາທິດ", day: "ມື້", month: "ເດືອນ" },
    due: { once: "ເຕັມຈຳນວນລ່ວງໜ້າ", month: "ວັນດຽວກັນຂອງທຸກເດືອນ", week: "ວັນດຽວກັນຂອງທຸກອາທິດ", day: "ເຕັມຈຳນວນເມື່ອຮັບລົດ", other: "ຕາມທີ່ຕົກລົງກັນ" },
    kmPerMonth: "ກມ. ຕໍ່ເດືອນ",
    unlimited: "ບໍ່ຈຳກັດ",
    perDay: "ຕໍ່ມື້",
    paidExtra: "ບໍລິການເສີມ"
  },
  km: {
    period: { once: "រយៈពេលជួលទាំងមូល", week: "សប្តាហ៍", day: "ថ្ងៃ", month: "ខែ" },
    due: { once: "ពេញចំនួនជាមុន", month: "នៅថ្ងៃដដែលរៀងរាល់ខែ", week: "នៅថ្ងៃដដែលរៀងរាល់សប្តាហ៍", day: "ពេញចំនួនពេលទទួលរថយន្ត", other: "តាមការព្រមព្រៀង" },
    kmPerMonth: "គ.ម. ក្នុងមួយខែ",
    unlimited: "គ្មានកំណត់",
    perDay: "ក្នុងមួយថ្ងៃ",
    paidExtra: "សេវាបន្ថែម"
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
