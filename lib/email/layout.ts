/**
 * The one look every email the app sends shares (Rory, 4 Nov 2026: "they look like plain text").
 *
 * Table-based, inline-styled HTML for Gmail (web and app), Apple Mail, Outlook desktop and web, with a dark-mode
 * stylesheet for the clients that honour one (Apple Mail, Outlook.com, iOS); Gmail's own dark mode recolours the light
 * version and stays readable because the header band is already dark. A 560px card, the system font stack, a heading,
 * a short body, at most one button (bulletproof: a padded link inside a table cell, VML for Outlook desktop), and a
 * quiet footer.
 *
 * Two kinds of sender:
 * - RoveHQ's own emails (alerts, the morning summary, downloads, support): the RoveHQ logo on a navy band.
 * - Emails to an operator's customers (signed documents, booking updates): the operator's logo or name, and only a
 *   small "Sent with RoveHQ" at the bottom.
 *
 * This only draws: the words come from the callers, already in the reader's language. Right-to-left languages (he)
 * render right-to-left. The plain-text part of each email stays the caller's own text.
 */

import { textDirection } from "@/lib/i18n/locales";

export type EmailBrand =
  | { kind: "rovehq" }
  | {
      kind: "operator";
      name: string;
      /** An https image URL that will keep working (PNG/JPEG/GIF/WebP). SVG and data: URLs are dropped (Gmail blocks them). */
      logoUrl?: string | null;
      /** Their accent colour (#rrggbb), used for the button. */
      colour?: string | null;
    };

export type EmailRow = { label: string; value: string; tone?: "danger" | "warning" | "muted" | "strong" };

export type EmailBlock =
  /** Plain text: blank lines start a new paragraph, single line breaks are kept, web addresses become links. */
  | { type: "text"; text: string; tone?: "muted" | "small" }
  /** A list of links, e.g. downloads: each a label, an optional detail line and the address. The first may be a button. */
  | { type: "links"; items: Array<{ label: string; detail?: string; url: string; primary?: boolean }> }
  /** A boxed section with an optional title and lines or label/value rows (the morning summary's cards). */
  | {
      type: "card";
      title?: string;
      titleTone?: "danger" | "strong";
      lines?: Array<{ text: string; tone?: EmailRow["tone"]; size?: "big" }>;
      rows?: EmailRow[];
    }
  /** The address behind the button, written out, for when the button doesn't work. */
  | { type: "fallback-link"; intro: string; url: string };

export type EmailContent = {
  brand?: EmailBrand;
  /** The reader's language: sets lang and, for he, right-to-left. */
  locale?: string | null;
  /** The grey line many inboxes show after the subject. */
  preheader?: string;
  /** Small line above the heading, e.g. a date. */
  eyebrow?: string;
  heading?: string;
  blocks: EmailBlock[];
  button?: { label: string; url: string } | null;
  footer?: {
    /** Why they got it, e.g. "You get this because email alerts are on for Sunny Cars." */
    reason?: string;
    /** A link to change it, e.g. Settings › Notifications. */
    settings?: { label: string; url: string } | null;
  };
};

// Brand colours from app/globals.css (--primary #12BCB8, --foreground #0f172a, --muted #64748b, --border #e2e8f0,
// --background #f0f4f8) and the logo ink (#1B2430). The button uses a deeper teal so white text on it is readable
// (4.6:1); the light teal stays as the accent on the dark band.
const C = {
  page: "#f0f4f8",
  card: "#ffffff",
  band: "#1B2430",
  ink: "#0f172a",
  body: "#334155",
  muted: "#64748b",
  border: "#e2e8f0",
  panel: "#f8fafc",
  teal: "#12BCB8",
  button: "#0a7f7c",
  link: "#0a7f7c",
  danger: "#dc2626",
  warning: "#b45309"
};

const FONT = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji'";
const SITE = "https://rovehq.io";

/** The RoveHQ header logo: public/email/rovehq-logo.png, served from the website's domain (absolute, PNG). */
export function rovehqLogoUrl() {
  const override = String(process.env.EMAIL_LOGO_URL || "").trim();
  if (override) return override;
  const site = String(process.env.NEXT_PUBLIC_SITE_URL || SITE).replace(/\/$/, "");
  return `${/^https:\/\//.test(site) ? site : SITE}/email/rovehq-logo.png`;
}

export function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const escapeAttr = escapeHtml;

/** Escapes text and turns http(s) addresses into links (trailing punctuation stays outside the link). */
function linkify(text: string) {
  const parts = String(text).split(/(https?:\/\/[^\s<>"]+)/g);
  return parts
    .map((part, index) => {
      if (index % 2 === 0) return escapeHtml(part);
      const match = part.match(/^(.*?)([.,;:!?)\]]*)$/);
      const url = match ? match[1] : part;
      const tail = match ? match[2] : "";
      return `<a href="${escapeAttr(url)}" style="color:${C.link};text-decoration:underline;overflow-wrap:anywhere;word-break:break-word;" class="rhq-link">${escapeHtml(url)}</a>${escapeHtml(tail)}`;
    })
    .join("");
}

function safeColour(value: string | null | undefined) {
  const colour = String(value || "").trim();
  return /^#[0-9a-f]{6}$/i.test(colour) ? colour : null;
}

/** White text needs a dark enough button: a pale operator colour falls back to the neutral one. */
function readableOnWhite(hex: string) {
  const channel = (offset: number) => {
    const c = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
  return 1.05 / (luminance + 0.05) >= 4.5;
}

export function safeEmailImageUrl(value: string | null | undefined) {
  const url = String(value || "").trim();
  if (!/^https:\/\//i.test(url)) return null;
  try {
    if (/\.svg$/i.test(new URL(url).pathname)) return null;
  } catch {
    return null;
  }
  return url;
}

function toneColour(tone: EmailRow["tone"] | undefined, fallback = C.body) {
  return tone === "danger" ? C.danger : tone === "warning" ? C.warning : tone === "muted" ? C.muted : tone === "strong" ? C.ink : fallback;
}

const DARK_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
@media only screen and (max-width:600px) {
  .rhq-container { width:100% !important; }
  .rhq-pad { padding-left:22px !important; padding-right:22px !important; }
  .rhq-outer { padding-left:10px !important; padding-right:10px !important; padding-top:12px !important; }
  .rhq-h1 { font-size:22px !important; line-height:29px !important; }
}
@media (prefers-color-scheme: dark) {
  .rhq-page { background:#0b1220 !important; }
  .rhq-card { background:#111a2b !important; border-color:#1f2a3d !important; }
  .rhq-band { background:#0f1622 !important; }
  .rhq-h1, .rhq-strong { color:#f1f5f9 !important; }
  .rhq-text { color:#cbd5e1 !important; }
  .rhq-muted { color:#94a3b8 !important; }
  .rhq-panel { background:#0e1626 !important; border-color:#1f2a3d !important; }
  .rhq-rule { border-color:#1f2a3d !important; }
  .rhq-link { color:#5eead4 !important; }
  .rhq-danger { color:#f87171 !important; }
  .rhq-warning { color:#fbbf24 !important; }
}
[data-ogsc] .rhq-h1, [data-ogsc] .rhq-strong { color:#f1f5f9 !important; }
[data-ogsc] .rhq-text { color:#cbd5e1 !important; }
[data-ogsc] .rhq-muted { color:#94a3b8 !important; }
[data-ogsc] .rhq-link { color:#5eead4 !important; }
[data-ogsb] .rhq-page { background:#0b1220 !important; }
[data-ogsb] .rhq-card { background:#111a2b !important; }
[data-ogsb] .rhq-panel { background:#0e1626 !important; }
`;

function toneClass(tone: EmailRow["tone"] | undefined, fallback = "rhq-text") {
  return tone === "danger" ? "rhq-danger" : tone === "warning" ? "rhq-warning" : tone === "muted" ? "rhq-muted" : tone === "strong" ? "rhq-strong" : fallback;
}

function paragraphs(text: string, align: string, tone?: "muted" | "small") {
  const colour = tone ? C.muted : C.body;
  const size = tone === "small" ? "13px" : tone === "muted" ? "14px" : "16px";
  const lineHeight = tone === "small" ? "20px" : tone === "muted" ? "22px" : "25px";
  return String(text)
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map(
      (chunk) =>
        `<p class="${tone ? "rhq-muted" : "rhq-text"}" style="margin:0 0 16px;font-family:${FONT};font-size:${size};line-height:${lineHeight};color:${colour};text-align:${align};">${chunk
          .split("\n")
          .map(linkify)
          .join("<br>")}</p>`
    )
    .join("\n");
}

function button(label: string, url: string, colour: string, align: string) {
  const width = Math.min(480, Math.max(200, Math.round(label.length * 9.5) + 56));
  const href = escapeAttr(url);
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;"><tr><td align="${align}">
<table role="presentation" border="0" cellspacing="0" cellpadding="0">
<tr><td align="center" bgcolor="${colour}" style="border-radius:8px;background:${colour};">
<!--[if mso]><v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${href}" style="height:48px;v-text-anchor:middle;width:${width}px;" arcsize="17%" stroke="f" fillcolor="${colour}"><w:anchorlock/><center style="color:#ffffff;font-family:Segoe UI,Arial,sans-serif;font-size:16px;font-weight:bold;">${escapeHtml(label)}</center></v:roundrect><![endif]-->
<!--[if !mso]><!--><a href="${href}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;background:${colour};mso-hide:all;">${escapeHtml(label)}</a><!--<![endif]-->
</td></tr></table>
</td></tr></table>`;
}

function linksBlock(items: Extract<EmailBlock, { type: "links" }>["items"], colour: string, align: string) {
  return items
    .map((item) => {
      if (item.primary) {
        return `${button(item.label, item.url, colour, align)}${item.detail ? `<p class="rhq-muted" style="margin:-16px 0 20px;font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted};text-align:${align};">${escapeHtml(item.detail)}</p>` : ""}`;
      }
      return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 10px;">
<tr><td class="rhq-panel" style="padding:12px 16px;border:1px solid ${C.border};border-radius:8px;background:${C.panel};text-align:${align};">
<a href="${escapeAttr(item.url)}" target="_blank" class="rhq-link" style="font-family:${FONT};font-size:15px;line-height:21px;font-weight:600;color:${C.link};text-decoration:none;">${escapeHtml(item.label)}</a>${
        item.detail ? `<div class="rhq-muted" style="font-family:${FONT};font-size:13px;line-height:18px;color:${C.muted};">${escapeHtml(item.detail)}</div>` : ""
      }
</td></tr></table>`;
    })
    .join("\n");
}

function cardBlock(block: Extract<EmailBlock, { type: "card" }>, align: string, opposite: string) {
  const title = block.title
    ? `<div class="${block.titleTone === "danger" ? "rhq-danger" : "rhq-strong"}" style="font-family:${FONT};font-size:15px;line-height:21px;font-weight:700;color:${block.titleTone === "danger" ? C.danger : C.ink};margin:0 0 8px;text-align:${align};">${escapeHtml(block.title)}</div>`
    : "";
  const lines = (block.lines || [])
    .map(
      (line) =>
        `<div class="${line.size === "big" ? "rhq-strong" : toneClass(line.tone)}" style="font-family:${FONT};font-size:${line.size === "big" ? "26px" : "14px"};line-height:${line.size === "big" ? "34px" : "21px"};font-weight:${line.size === "big" || line.tone === "strong" ? 700 : 400};color:${line.size === "big" ? C.ink : toneColour(line.tone)};text-align:${align};">${escapeHtml(line.text)}</div>`
    )
    .join("");
  const rows = (block.rows || []).length
    ? `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">${(block.rows || [])
        .map(
          (row) =>
            `<tr><td class="rhq-text rhq-rule" style="padding:7px 0;border-top:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:20px;color:${C.body};text-align:${align};">${escapeHtml(row.label)}</td><td class="${toneClass(row.tone, "rhq-strong")} rhq-rule" style="padding:7px 0 7px 12px;border-top:1px solid ${C.border};font-family:${FONT};font-size:14px;line-height:20px;font-weight:600;color:${toneColour(row.tone, C.ink)};text-align:${opposite};">${escapeHtml(row.value)}</td></tr>`
        )
        .join("")}</table>`
    : "";
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 14px;">
<tr><td class="rhq-panel" style="padding:16px 18px;border:1px solid ${C.border};border-radius:10px;background:${C.panel};">${title}${lines}${rows}</td></tr></table>`;
}

function header(brand: EmailBrand, align: string) {
  if (brand.kind === "rovehq") {
    return `<tr><td class="rhq-band rhq-pad" bgcolor="${C.band}" style="background:${C.band};padding:22px 32px;border-radius:12px 12px 0 0;text-align:${align};">
<a href="${SITE}" target="_blank" style="text-decoration:none;"><img src="${escapeAttr(rovehqLogoUrl())}" width="150" height="23" alt="RoveHQ" style="display:inline-block;width:150px;height:23px;border:0;font-family:${FONT};font-size:20px;font-weight:800;line-height:23px;color:#ffffff;"></a>
</td></tr>
<tr><td height="3" bgcolor="${C.teal}" style="height:3px;line-height:3px;font-size:0;background:${C.teal};">&nbsp;</td></tr>`;
  }
  const logo = safeEmailImageUrl(brand.logoUrl);
  const name = escapeHtml(brand.name);
  // Their logo on a white plate, so a dark logo on a transparent background still shows in dark mode.
  const mark = logo
    ? `<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="${align}"><tr><td bgcolor="#ffffff" style="background:#ffffff;border-radius:8px;padding:6px 8px;"><img src="${escapeAttr(logo)}" height="48" alt="${name}" style="display:block;height:48px;width:auto;max-width:220px;border:0;font-family:${FONT};font-size:20px;font-weight:700;color:${C.ink};"></td></tr></table>`
    : `<div class="rhq-strong" style="font-family:${FONT};font-size:20px;line-height:26px;font-weight:800;color:${C.ink};">${name}</div>`;
  return `<tr><td class="rhq-pad rhq-rule" style="padding:22px 32px 18px;border-bottom:1px solid ${C.border};text-align:${align};">${mark}</td></tr>`;
}

function footer(brand: EmailBrand, content: EmailContent, align: string) {
  const small = (inner: string, extra = "") =>
    `<p class="rhq-muted" style="margin:0 0 8px;font-family:${FONT};font-size:12px;line-height:18px;color:${C.muted};text-align:center;${extra}">${inner}</p>`;
  const parts: string[] = [];
  if (content.footer?.reason) parts.push(small(escapeHtml(content.footer.reason)));
  if (content.footer?.settings?.url) {
    parts.push(small(`<a href="${escapeAttr(content.footer.settings.url)}" target="_blank" class="rhq-link" style="color:${C.link};text-decoration:underline;">${escapeHtml(content.footer.settings.label)}</a>`));
  }
  parts.push(
    brand.kind === "rovehq"
      ? small(`<a href="${SITE}" target="_blank" class="rhq-muted" style="color:${C.muted};text-decoration:none;font-weight:600;">RoveHQ</a> &middot; <a href="${SITE}" target="_blank" class="rhq-muted" style="color:${C.muted};text-decoration:none;">rovehq.io</a>`)
      : small(`Sent with <a href="${SITE}" target="_blank" class="rhq-muted" style="color:${C.muted};text-decoration:none;font-weight:600;">RoveHQ</a>`, "font-size:11px;")
  );
  void align;
  return parts.join("\n");
}

/** The whole email as HTML. */
export function renderEmailHtml(content: EmailContent): string {
  const brand: EmailBrand = content.brand || { kind: "rovehq" };
  const locale = String(content.locale || "en");
  const dir = textDirection(locale);
  const align = dir === "rtl" ? "right" : "left";
  const opposite = dir === "rtl" ? "left" : "right";
  const operatorColour = brand.kind === "operator" ? safeColour(brand.colour) : null;
  const buttonColour = brand.kind === "operator" ? (operatorColour && readableOnWhite(operatorColour) ? operatorColour : C.ink) : C.button;

  const body: string[] = [];
  if (content.eyebrow) {
    body.push(`<p class="rhq-muted" style="margin:0 0 6px;font-family:${FONT};font-size:13px;line-height:18px;font-weight:600;color:${C.muted};text-align:${align};">${escapeHtml(content.eyebrow)}</p>`);
  }
  if (content.heading) {
    body.push(`<h1 class="rhq-h1" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:31px;font-weight:700;color:${C.ink};text-align:${align};">${escapeHtml(content.heading)}</h1>`);
  }
  let buttonPlaced = false;
  for (const block of content.blocks) {
    if (block.type === "text") body.push(paragraphs(block.text, align, block.tone));
    else if (block.type === "links") body.push(linksBlock(block.items, buttonColour, align));
    else if (block.type === "card") body.push(cardBlock(block, align, opposite));
    else if (block.type === "fallback-link") {
      // The button goes just before its written-out address.
      if (content.button && !buttonPlaced) {
        body.push(button(content.button.label, content.button.url, buttonColour, align));
        buttonPlaced = true;
      }
      body.push(
        `<p class="rhq-muted" style="margin:0 0 16px;font-family:${FONT};font-size:13px;line-height:19px;color:${C.muted};text-align:${align};">${escapeHtml(block.intro)}<br><a href="${escapeAttr(block.url)}" target="_blank" class="rhq-link" style="color:${C.link};text-decoration:underline;word-break:break-all;">${escapeHtml(block.url)}</a></p>`
      );
    }
  }
  if (content.button && !buttonPlaced) body.push(button(content.button.label, content.button.url, buttonColour, align));

  const preheader = content.preheader
    ? `<div style="display:none;font-size:1px;color:${C.page};line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">${escapeHtml(content.preheader)}${"&#847;&zwnj;&nbsp;".repeat(30)}</div>`
    : "";
  const title = escapeHtml(content.heading || (brand.kind === "operator" ? brand.name : "RoveHQ"));

  return `<!DOCTYPE html>
<html lang="${escapeAttr(locale)}" dir="${dir}" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<meta name="x-apple-disable-message-reformatting">
<meta name="format-detection" content="telephone=no, date=no, address=no, email=no, url=no">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${title}</title>
<!--[if mso]><noscript><xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript><![endif]-->
<style>${DARK_CSS}</style>
</head>
<body class="rhq-page" style="margin:0;padding:0;background:${C.page};" dir="${dir}">
${preheader}
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="rhq-page" bgcolor="${C.page}" style="background:${C.page};" dir="${dir}">
<tr><td align="center" class="rhq-outer" style="padding:28px 16px 32px;">
<!--[if mso]><table role="presentation" width="560" border="0" cellspacing="0" cellpadding="0"><tr><td><![endif]-->
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="rhq-container" style="max-width:560px;width:100%;">
<tr><td>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" class="rhq-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.border};border-radius:12px;border-collapse:separate;">
${header(brand, align)}
<tr><td class="rhq-pad" style="padding:30px 32px 14px;text-align:${align};" dir="${dir}">
${body.join("\n")}
</td></tr>
</table>
</td></tr>
<tr><td style="padding:20px 24px 0;" dir="${dir}">
${footer(brand, content, align)}
</td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
</td></tr>
</table>
</body>
</html>`;
}
