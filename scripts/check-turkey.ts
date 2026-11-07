import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildContractVariables, renderContractTemplate } from "@/lib/contract-rendering";
import { localizeAgreementTemplate } from "@/lib/agreement-localize";
import { organizationAgreementLanguage } from "@/lib/agreement-language";
import { isKabisBusiness, kabisFields, kabisMissingCount } from "@/lib/kabis";
import { planCurrency, planCharge } from "@/lib/plan-currency";
import { formatMoney, vatSettings, countryInfo } from "@/lib/regional";
import { cleanTcKimlikNo, licenceCategoriesFor } from "@/lib/licence";
import { parse as parseYaml } from "yaml";
import { PLANS } from "@/lib/plans";

const root = process.cwd();
const template = readFileSync(join(root, "lib", "contract-templates", "default-en.html"), "utf8");
let failed = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? `  (${extra})` : ""}`);
  if (!ok) failed++;
};

const trOrg = { id: "o1", name: "Ege Rent", currency: "TRY", country_code: "TR", settings: { main_location: { country: "Türkiye", town: "Fethiye" }, country: "Türkiye" } };
const thOrg = { id: "o2", name: "Samui Cars", currency: "THB", country_code: "TH", settings: { main_location: { country: "Thailand", town: "Koh Samui" } } };
const customer = { id: "c1", full_name: "Ayşe Yılmaz", nationality: "Türkiye", national_id_number: "10000000146", date_of_birth: "1990-05-01", phone: "+905321234567", address: "Fethiye", driver_license_number: "TR123", license_type: "B", driver_license_issued: "2010-02-03" };
const foreigner = { id: "c2", full_name: "John Smith", nationality: "United Kingdom", passport_number: "123456789", phone: "+447700900000" };
const vehicle = { id: "v1", make: "Fiat", model: "Egea", registration_number: "48 ABC 123", year: 2024 };
const rental = { id: "r1", start_date: "2026-11-10T09:00:00+03:00", end_date: "2026-11-14T09:00:00+03:00", rental_rate: 1500, pricing_model: "daily", currency: "TRY", deposit_amount: 4500 };

// Agreement: English + Turkish, with the Turkish clauses and Türkiye's law.
check("agreement language for TR is tr", organizationAgreementLanguage(trOrg) === "tr");
const localized = localizeAgreementTemplate(template, "tr");
const vars = buildContractVariables({ organization: trOrg, customer, vehicle, rental, bookingLink: {} });
const html = renderContractTemplate(localized, vars as any);
const englishBlocks = (html.match(/class="lang-en"/g) || []).length;
const turkishBlocks = (html.match(/lang="tr"/g) || []).length;
check("both columns present", englishBlocks > 20 && turkishBlocks > 20, `${englishBlocks} English, ${turkishBlocks} Turkish`);
check("no Thai left", !/[฀-๿]/.test(html));
check("Turkish clause text", html.includes("Kiraya Veren") && html.includes("Türkiye'de kullanım için"));
check("governing law is Türkiye", String(vars.jurisdiction) === "the Republic of Türkiye", String(vars.jurisdiction));
check("KABİS / Law 7574 fines clause shown", html.includes("Law No. 7574") && html.includes("7574 sayılı"));
check("KVKK clause shown", html.includes("KVKK"));
check("no EU GDPR clause for TR", !html.includes("GDPR"));
check("lira sign", html.includes("₺"));
check("no leaked tags", !/\{\{[#/]?(if|else)/.test(html));
const thHtml = renderContractTemplate(localizeAgreementTemplate(template, "th"), buildContractVariables({ organization: thOrg, customer: foreigner, vehicle, rental: { ...rental, currency: "THB" }, bookingLink: {} }) as any);
check("Thai agreement has no Turkish clauses", !thHtml.includes("KABİS") && !thHtml.includes("lang=\"tr\""));

// KABİS block: TR businesses only; T.C. number for a citizen, passport for a foreigner.
check("KABİS shows for TR business", isKabisBusiness(trOrg));
check("KABİS hidden for TH business", !isKabisBusiness(thOrg));
const fields = kabisFields({ customer, vehicle, rental, timeZone: "Europe/Istanbul" });
const get = (list: any[], key: string) => list.find((item) => item.key === key)?.value;
check("KABİS T.C. number", get(fields, "tcKimlik") === "10000000146");
check("KABİS dates in Turkish format", get(fields, "startDate") === "10.11.2026" && get(fields, "startTime") === "09:00", `${get(fields, "startDate")} ${get(fields, "startTime")}`);
check("KABİS citizen complete", kabisMissingCount(fields) === 0, String(kabisMissingCount(fields)));
const foreignFields = kabisFields({ customer: foreigner, vehicle, rental, timeZone: "Europe/Istanbul" });
check("KABİS passport for foreigner", get(foreignFields, "passport") === "123456789" && !foreignFields.some((f) => f.key === "tcKimlik"));
check("KABİS lists what is missing", kabisMissingCount(foreignFields) > 0, String(kabisMissingCount(foreignFields)));

// Country data.
check("T.C. checksum", cleanTcKimlikNo("10000000146") === "10000000146" && cleanTcKimlikNo("10000000147") === "");
check("TR licence classes include M and B1", licenceCategoriesFor("TR").includes("M") && licenceCategoriesFor("TR").includes("B1"));
check("KDV 20%", countryInfo("Türkiye")?.vat === 20 && vatSettings(trOrg).name === "KDV");
check("TRY formatting", formatMoney(1500, "TRY", "tr-TR").includes("₺"), formatMoney(1500, "TRY", "tr-TR"));
check("plans in EUR for TRY businesses", planCurrency("TRY") === "EUR", `${planCurrency("TRY")} ${JSON.stringify(planCharge(PLANS[0], { cars: 3, motorbikes: 2 } as any, "TRY", "monthly"))}`);

// Download builder: the Turkish version loads.
// (document.ts imports "server-only", so the YAML is checked directly: every clause in both languages, same placeholders.)
const yaml = parseYaml(readFileSync(join(root, "content", "contracts", "tr.yaml"), "utf8")) as any;
const yclauses = (yaml.sections as any[]).flatMap((section) => section.clauses || []);
const tok = (text: string) => (String(text).match(/\{\{[^}]+\}\}/g) || []).sort().join("|");
const badClauses = yclauses.filter((c) => !String(c.local || "").trim() || tok(c.en) !== tok(c.local)).map((c) => c.id);
check("contract builder tr.yaml", yaml.locale === "tr" && yclauses.length > 70 && badClauses.length === 0, `${yclauses.length} clauses${badClauses.length ? `, bad: ${badClauses.join(",")}` : ""}`);

console.log(failed ? `${failed} failed` : "All Turkey checks passed");
process.exit(failed ? 1 : 0);
