import { isSecondLanguage, type AgreementLanguage, type SecondLanguage } from "@/lib/agreement-language";
import { COUNTRY_CLAUSES } from "@/lib/contract-templates/country-clauses";
import { AGREEMENT_CLAUSES, AGREEMENT_LABELS } from "@/lib/contract-templates/second-languages";

/**
 * The RoveHQ agreement in English plus the business location's language (lib/agreement-language.ts).
 *
 * The template (lib/contract-templates/default-en.html) is English and Thai. For a business in Thailand it is returned
 * untouched, so Thai agreements stay exactly as they were. For anywhere else, before the booking's details are filled
 * in, every Thai clause and label is replaced with that country's language, or removed for an English-only agreement;
 * Thailand-only wording in the English (the baht sign, "For use in Thailand", Thai insurance) follows the business's
 * country and currency. Only the platform template is changed: an owner's uploaded agreement is theirs, as written.
 *
 * Server side (the translations are large); pages hand the browser the localized template.
 */

const PLATFORM_MARKER = "routehq-template-v3";

const clauseByThai = new Map(AGREEMENT_CLAUSES.map((entry) => [entry.th.trim(), entry]));
// Longest first, so "ค่าเช่าและค่าใช้จ่าย" is matched before "ค่าเช่า".
const labels = [...AGREEMENT_LABELS].sort((a, b) => b.th.length - a.th.length);
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const labelPatterns = labels.map((entry) => ({ entry, pattern: new RegExp(` / ${escapeRegExp(entry.th)}(?=[<:{]|$)`, "gm") }));

const FONTS: Record<SecondLanguage, { link: string; family: string }> = {
  id: { link: "Noto+Sans", family: '"Noto Sans"' },
  vi: { link: "Noto+Sans", family: '"Noto Sans"' },
  ms: { link: "Noto+Sans", family: '"Noto Sans"' },
  fil: { link: "Noto+Sans", family: '"Noto Sans"' },
  lo: { link: "Noto+Sans+Lao", family: '"Noto Sans Lao", "Noto Sans"' },
  km: { link: "Noto+Sans+Khmer", family: '"Noto Sans Khmer", "Noto Sans"' },
  // Noto Sans has Greek and every Latin letter these languages use (č, ć, đ, ş...).
  el: { link: "Noto+Sans", family: '"Noto Sans"' },
  es: { link: "Noto+Sans", family: '"Noto Sans"' },
  pt: { link: "Noto+Sans", family: '"Noto Sans"' },
  it: { link: "Noto+Sans", family: '"Noto Sans"' },
  hr: { link: "Noto+Sans", family: '"Noto Sans"' },
  fr: { link: "Noto+Sans", family: '"Noto Sans"' },
  de: { link: "Noto+Sans", family: '"Noto Sans"' }
};

/**
 * Europe and the UK (3 Nov 2026). The English the Thai template has that is wrong or unfair there, and where each
 * country clause (lib/contract-templates/country-clauses.ts) goes. Every addition is wrapped in {{#if ...}} on a
 * variable lib/contract-rendering.ts sets (agreement_eu_uk, country_GB...), so a business elsewhere that falls back
 * to English-only never sees them.
 */
// The Thai Type 1 sentence, for every business outside Thailand: the cover the Owner states, never "comprehensive".
const THAI_INSURANCE =
  "The vehicle is covered by full comprehensive (Type 1) insurance valid throughout the Kingdom of Thailand. The Renter will be added as a named driver on the policy.";
const NEUTRAL_INSURANCE =
  "The vehicle is insured as stated by the Owner, including any third-party liability insurance required by law in {{agreement_country}}. The Renter is covered as a driver named in this agreement.";
// Keeping the whole deposit, whatever the loss, is a disproportionate penalty under EU and UK unfair-terms law
// (Directive 93/13/EEC, Annex point (e); Consumer Rights Act 2015, Schedule 2 para 6): in Europe, actual losses only.
const EUROPE_FAIRER: Array<[string, string]> = [
  [
    "Any suspected tampering may result in deposit forfeiture and recovery of additional losses.",
    "Proven tampering allows the Owner to recover the losses it causes, including from the deposit."
  ],
  [
    "entitle the Owner to immediately repossess the vehicle and forfeit the security deposit in full.",
    "entitle the Owner to immediately repossess the vehicle and to deduct from the security deposit the losses and costs this causes."
  ]
];
const EUROPE_PLACES: Array<{ section: string; shared: string[]; countries: string[] }> = [
  { section: "4. Renter qualifications", shared: [], countries: ["GR"] },
  { section: "10. Exclusions and prohibited use", shared: ["use"], countries: [] },
  { section: "11. Permitted travel", shared: ["travel"], countries: ["CY", "HR"] },
  { section: "12. Insurance and claims", shared: ["insurance"], countries: [] },
  { section: "15. Fines and violations", shared: ["fines"], countries: ["GB", "IE", "IT", "FR", "ES", "DE", "PT"] },
  { section: "17. Governing law", shared: ["law"], countries: [] }
];

function countryBlock(key: string, second: SecondLanguage | null, guard: string, asClause = false) {
  const clause = COUNTRY_CLAUSES[key];
  if (!clause) return "";
  const local = second && clause[second] ? `\n        <div class="lang-th" lang="${second}">${clause[second]}</div>` : "";
  const body = `<div class="bilingual-section">\n        <div class="lang-en">${clause.en}</div>${local}\n      </div>`;
  return `\n      {{#if ${guard}}}${asClause ? `<div class="clause">${body}</div>` : body}{{/if}}`;
}

/** Puts the European clauses at the end of their sections (before the section body closes). */
function addEuropeanClauses(html: string, second: SecondLanguage | null) {
  let out = html;
  for (const place of EUROPE_PLACES) {
    const at = out.indexOf(`>${place.section}`);
    const end = at === -1 ? -1 : out.indexOf("\n    </div>\n  </section>", at);
    if (end === -1) continue;
    const blocks =
      place.shared.map((key) => countryBlock(key, second, "agreement_eu_uk")).join("") +
      place.countries.map((code) => countryBlock(code, second, `country_${code}`)).join("");
    out = out.slice(0, end) + blocks + out.slice(end);
  }
  const special = out.indexOf("{{#if special_conditions}}");
  if (special !== -1) {
    const blocks = countryBlock("data", second, "agreement_eu_uk", true) + countryBlock("esign", second, "agreement_eu_uk", true);
    out = `${out.slice(0, special)}${blocks.trimStart()}\n      ${out.slice(special)}`;
  }
  for (const [unfair, fair] of EUROPE_FAIRER) out = out.replace(unfair, `{{#if agreement_eu_uk}}${fair}{{else}}${unfair}{{/if}}`);
  return out;
}

/** The second column's font: the Thai one (Sarabun) has no Lao or Khmer letters, and serverless Chrome has no system fonts. */
function fontStyle(lang: SecondLanguage) {
  const font = FONTS[lang];
  const families = font.link === "Noto+Sans" ? "family=Noto+Sans:wght@400;600;700" : `family=Noto+Sans:wght@400;600;700&family=${font.link}:wght@400;600;700`;
  return `<link href="https://fonts.googleapis.com/css2?${families}&display=swap" rel="stylesheet">
  <style>
    body { font-family: Arial, ${font.family}, sans-serif; }
    .lang-th, .title-band p { font-family: ${font.family}, Arial, sans-serif; }
  </style>`;
}

export function isPlatformAgreement(templateHtml: string) {
  return String(templateHtml || "").includes(PLATFORM_MARKER);
}

export function localizeAgreementTemplate(templateHtml: string, lang: AgreementLanguage | string | null | undefined): string {
  const html = String(templateHtml || "");
  const language = (lang || "th") as AgreementLanguage;
  if (language === "th" || !isPlatformAgreement(html)) return html;
  const second = isSecondLanguage(language) ? language : null;

  // Clauses: the Thai block under each English one. One RoveHQ has no wording for is left out, never shown in Thai.
  let out = html.replace(/(\s*)<div class="lang-th">([\s\S]*?)<\/div>/g, (_match, space: string, inner: string) => {
    const entry = clauseByThai.get(inner.trim());
    return second && entry ? `${space}<div class="lang-th" lang="${second}">${entry[second]}</div>` : "";
  });

  // Labels: "Owner / ผู้ให้เช่า" becomes "Owner / Pemilik", or just "Owner".
  // The label is marked with its language, so upper-case Greek headings drop their accents as Greek does.
  for (const { entry, pattern } of labelPatterns) out = out.replace(pattern, second ? ` / <span lang="${second}">${entry[second]}</span>` : "");
  out = out
    .replace(/ \/ \{\{billing_period_label_th\}\}/g, second ? " / {{billing_period_label_2}}" : "")
    .replace(/ \/ \{\{payment_due_label_th\}\}/g, second ? " / {{payment_due_label_2}}" : "");

  // The English that only fits Thailand.
  out = out
    .replace(/฿\{\{/g, "{{currency_symbol}}{{")
    .replace("For use in Thailand", "For use in {{agreement_country}}")
    .replace(THAI_INSURANCE, NEUTRAL_INSURANCE);

  // Anything Thai still left (wording added to the template later without a translation) is dropped from labels.
  out = out.replace(/ \/ [^<{]*[฀-๿][^<{]*/g, "");

  // Europe and the UK: fairer deposit wording and the country clauses, each shown only for those countries.
  out = addEuropeanClauses(out, second);

  if (second) out = out.replace("</head>", `  ${fontStyle(second)}\n</head>`);
  return out.replace("<html>", '<html lang="en">');
}
