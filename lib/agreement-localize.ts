import { isSecondLanguage, type AgreementLanguage, type SecondLanguage } from "@/lib/agreement-language";
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
  km: { link: "Noto+Sans+Khmer", family: '"Noto Sans Khmer", "Noto Sans"' }
};

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
  for (const { entry, pattern } of labelPatterns) out = out.replace(pattern, second ? ` / ${entry[second]}` : "");
  out = out
    .replace(/ \/ \{\{billing_period_label_th\}\}/g, second ? " / {{billing_period_label_2}}" : "")
    .replace(/ \/ \{\{payment_due_label_th\}\}/g, second ? " / {{payment_due_label_2}}" : "");

  // The English that only fits Thailand.
  out = out
    .replace(/฿\{\{/g, "{{currency_symbol}}{{")
    .replace("For use in Thailand", "For use in {{agreement_country}}")
    .replace("full comprehensive (Type 1) insurance valid throughout the Kingdom of Thailand", "comprehensive insurance valid throughout {{jurisdiction}}");

  // Anything Thai still left (wording added to the template later without a translation) is dropped from labels.
  out = out.replace(/ \/ [^<{]*[฀-๿][^<{]*/g, "");

  if (second) out = out.replace("</head>", `  ${fontStyle(second)}\n</head>`);
  return out.replace("<html>", '<html lang="en">');
}
