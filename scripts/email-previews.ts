/**
 * Draws every email the app sends, with sample data, so the design can be checked in a browser.
 *
 *   npx tsx scripts/email-previews.ts              -> %TEMP%/email-previews/<name>.html (+ index.html)
 *   npx tsx scripts/email-previews.ts --supabase   -> also rewrites docs/supabase-email-templates/*.html
 *
 * The previews show the logo from public/email/ (the emails themselves load it from https://rovehq.io/email/).
 * Screenshots: %TEMP%/pwshot/email-shots.mjs (Playwright, 600px and 375px, light and dark).
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { renderEmailHtml, rovehqLogoUrl } from "../lib/email/layout";
import { SUPABASE_TEMPLATES } from "./supabase-email-templates";
import {
  adminEmailChangedEmail,
  adminPasswordResetEmail,
  customerMessageEmail,
  executedDocumentEmail,
  LEAD_LINKS_MARKER,
  leadEmail,
  morningSummaryEmail,
  operatorAlertEmail
} from "../lib/email/templates";
import { buildDailySummaryMessages, type SummaryData } from "../lib/line/daily-summary";

const repo = resolve(__dirname, "..");
const out = join(tmpdir(), "email-previews");
mkdirSync(out, { recursive: true });

// 1. Supabase account emails (paste-ready, production logo URL).
if (process.argv.includes("--supabase")) {
  const dir = join(repo, "docs", "supabase-email-templates");
  mkdirSync(dir, { recursive: true });
  for (const template of SUPABASE_TEMPLATES) writeFileSync(join(dir, `${template.file}.html`), `${renderEmailHtml(template.content)}\n`);
  console.log(`wrote ${SUPABASE_TEMPLATES.length} Supabase templates to ${dir} (logo: ${rovehqLogoUrl()})`);
}

// 2. Previews: the local logo file, and a sample operator logo.
process.env.EMAIL_LOGO_URL = pathToFileURL(join(repo, "public", "email", "rovehq-logo.png")).href;
const SAMPLE_OPERATOR_LOGO = "https://preview.invalid/operator-logo.png";
const localOperatorLogo = pathToFileURL(join(out, "operator-logo.png")).href;
const APP = "https://rovehq.app";

const summary = (locale: "en" | "th"): SummaryData => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    orgName: "Sunny Cars Samui",
    lineUserId: "",
    timezone: "Asia/Bangkok",
    currency: "THB",
    locale,
    notificationSettings: {},
    activeRentals: [{}, {}, {}, {}, {}, {}],
    returningToday: [{ end_date: today, customers: { full_name: "Anna Müller" }, vehicles: { make: "Toyota", model: "Yaris Ativ" } }],
    returningTomorrow: [{ customers: { full_name: "James Carter" }, vehicles: { make: "Honda", model: "City" } }],
    overdueRentals: [{ end_date: "2026-11-02", balance_due: 1500, customers: { full_name: "Pierre Dubois" }, vehicles: { make: "Isuzu", model: "D-Max" } }],
    paymentsExpectedToday: [
      { customers: { full_name: "Somchai P." }, balance_due: 4500 },
      { customers: { full_name: "Emma Wilson" }, balance_due: 12000 }
    ],
    urgentCompliance: [{ vehicle: "Toyota Fortuner (กข 1234)", item: "insurance", expiry: "2026-11-09" }],
    monthRevenue: 84500
  };
};

const emails: Array<{ name: string; html: string; subject: string }> = [];
const add = (name: string, built: { html: string; subject: string } | null) => built && emails.push({ name, ...built });
const operator = (logo: boolean) => ({ kind: "operator" as const, name: "Sunny Cars Samui", logoUrl: logo ? SAMPLE_OPERATOR_LOGO : null, colour: "#c2410c" });

add("alert-payment", operatorAlertEmail({ title: "Payment", plain: "Anna Müller paid ฿4,500 for the Toyota Yaris Ativ (booking SC-1042).", link: `${APP}/rentals/123`, orgName: "Sunny Cars Samui", appUrl: APP }));
add("alert-portal-request", operatorAlertEmail({ title: "Customer request", plain: "James Carter asked to extend his booking by 3 days (Honda City, until 12 Nov).", link: `${APP}/tasks`, orgName: "Sunny Cars Samui", appUrl: APP }));
add("morning-summary-en", morningSummaryEmail({ orgName: "Sunny Cars Samui", messages: buildDailySummaryMessages(summary("en")) as any[], appUrl: APP, locale: "en" }));
add("morning-summary-th", morningSummaryEmail({ orgName: "Sunny Cars Samui", messages: buildDailySummaryMessages(summary("th")) as any[], appUrl: APP, locale: "th" }));
add("morning-summary-quiet", morningSummaryEmail({ orgName: "Sunny Cars Samui", messages: buildDailySummaryMessages({ ...summary("en"), activeRentals: [], overdueRentals: [], paymentsExpectedToday: [], urgentCompliance: [], notificationSettings: { daily_revenue: false } }) as any[], appUrl: APP, locale: "en" }));
add("document-to-customer-logo", executedDocumentEmail({ documentLabel: "Rental agreement", business: "Sunny Cars Samui", recipientName: "Anna", filenames: ["Rental-agreement-SC-1042.pdf"], brand: operator(true) }));
add("document-to-customer-nologo", executedDocumentEmail({ documentLabel: "Return receipt", business: "Sunny Cars Samui", recipientName: "", filenames: ["Return-receipt-SC-1042.pdf"], brand: operator(false) }));
const reminder = "Hi Anna, a reminder that your next payment of ฿4,500 for the Toyota Yaris Ativ is due tomorrow (6 Nov).";
add("customer-message-en", customerMessageEmail({ subject: "Sunny Cars Samui: an update on your booking", body: `${reminder}\n\nYour booking: https://rove.rent/book/abc123\n\nSunny Cars Samui`, brand: operator(true), locale: "en" }));
add("customer-message-he", customerMessageEmail({ subject: "Sunny Cars Samui: עדכון על ההזמנה שלך", body: "היי אנה, תזכורת שהתשלום הבא שלך בסך ‎฿4,500 עבור טויוטה יאריס מגיע מחר (6 בנוב׳).\n\nההזמנה שלך: https://rove.rent/book/abc123\n\nSunny Cars Samui", brand: operator(true), locale: "he" }));
const leadDownloads = [
  { label: "Download the Word file", detail: "English · 48 KB", url: "https://rovehq.io/api/download/rental-agreement?t=x" },
  { label: "Download the PDF", detail: "English · 112 KB", url: "https://rovehq.io/api/download/rental-agreement?t=y" },
  { label: "Download the PDF", detail: "ไทย · 120 KB", url: "https://rovehq.io/api/download/rental-agreement?t=z" }
];
// The real translated wording (locales/<code>/common.json, marketing.*), filled in the way next-intl does.
for (const locale of ["en", "he", "th"]) {
  const m = JSON.parse(readFileSync(join(repo, "locales", locale, "common.json"), "utf8")).marketing as Record<string, string>;
  const fill = (key: string, values: Record<string, string> = {}) => String(m[key] || "").replace(/\{(\w+)\}/g, (_, name) => values[name] ?? "");
  const downloads = leadDownloads.map((item, index) => ({ ...item, label: fill(index === 0 ? "downloadDocx" : "downloadPdf") }));
  add(`lead-download-${locale}`, leadEmail({
    subject: fill("leadEmailSubject", { title: "Car rental agreement" }),
    text: "",
    bodyWithMarker: fill("leadEmailBody", { name: " Rory", links: LEAD_LINKS_MARKER, disclaimer: fill("disclaimer") }),
    heading: "Car rental agreement",
    downloads,
    locale
  }));
}
add("admin-password-reset", adminPasswordResetEmail({ link: "https://xyz.supabase.co/auth/v1/verify?token=pkce_123&type=recovery&redirect_to=https://rovehq.app/auth/callback?next=/reset-password" }));
add("admin-email-changed", adminEmailChangedEmail({ before: "old@sunnycars.co", email: "owner@sunnycars.co" }));
for (const template of SUPABASE_TEMPLATES) {
  add(`supabase-${template.file}`, {
    subject: template.subject,
    html: renderEmailHtml(template.content)
      .replace(/\{\{ \.ConfirmationURL \}\}/g, "https://xyz.supabase.co/auth/v1/verify?token=pkce_abc&type=signup&redirect_to=https://rovehq.app/auth/callback")
      .replace(/\{\{ \.Token \}\}/g, "482913")
      .replace(/\{\{ \.Email \}\}/g, "owner@sunnycars.co")
      .replace(/\{\{ \.NewEmail \}\}/g, "new@sunnycars.co")
      .replace(/\{\{ \.SiteURL \}\}/g, APP)
  });
}

// A made-up operator logo (a dark mark on transparent, the hard case for dark mode).
void (async () => {
  const sharp = (await import("sharp")).default;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="440" height="120"><circle cx="60" cy="60" r="44" fill="#f97316"/><circle cx="60" cy="60" r="20" fill="#fff7ed"/><text x="122" y="76" font-family="Arial Black, Arial" font-weight="900" font-size="46" fill="#1f2937">Sunny Cars</text></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(join(out, "operator-logo.png"));
})();

for (const email of emails) writeFileSync(join(out, `${email.name}.html`), email.html.split(SAMPLE_OPERATOR_LOGO).join(localOperatorLogo));
writeFileSync(
  join(out, "index.html"),
  `<!doctype html><meta charset="utf-8"><title>Email previews</title><body style="font-family:system-ui;padding:24px"><h1>Email previews</h1><ul>${emails
    .map((email) => `<li><a href="${email.name}.html">${email.name}</a> - ${email.subject.replace(/</g, "&lt;")}</li>`)
    .join("")}</ul></body>`
);
writeFileSync(join(out, "list.json"), JSON.stringify(emails.map((email) => email.name)));
console.log(`wrote ${emails.length} previews to ${out}`);
