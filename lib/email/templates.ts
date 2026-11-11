/**
 * Every email the app sends, as subject + plain text + designed HTML (lib/email/layout.ts).
 *
 * The plain text and subjects are exactly what each email said before the redesign (4 Nov 2026): this file only adds
 * the HTML version beside them. Pure functions (no database), so scripts/email-previews.ts can draw each one with
 * sample data.
 *
 * Each takes `words` (lib/email/words.ts, emailWords(locale)) in the email's language: the button texts, the
 * "why you got this" footer and "Sent with RoveHQ" follow it, and so do lang and right-to-left.
 */

import { renderEmailHtml, type EmailBlock, type EmailBrand } from "@/lib/email/layout";
import type { EmailWords } from "@/lib/email/words";

export type BuiltEmail = { subject: string; text: string; html: string };

// Settings › Notifications is a tab on the settings page (7 Nov 2026); /settings/notifications redirects there too.
const settingsUrl = (appUrl: string) => (appUrl ? `${appUrl}/settings?tab=notifications` : "");

/** Split text around a marker (used to drop a designed block where a translated sentence had a placeholder). */
function around(text: string, marker: string): [string, string] {
  const at = text.indexOf(marker);
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + marker.length)];
}

// ── Operator alerts (lib/notify-operator.ts) ────────────────────────────────────────────────────────────────────────

/** "Reason. Change it in Settings › Notifications." as one plain-text line in English (as before), two lines otherwise. */
function plainReason(words: EmailWords, reason: string, settings: string) {
  return words.locale === "en" ? `${reason} ${settings}.` : `${reason}\n${settings}`;
}

/** The operator's own language (owner's preferred language, else the business's), from lib/notify-operator.ts. */
export function operatorAlertEmail(input: { title: string; plain: string; link: string; orgName: string | null | undefined; appUrl: string; words: EmailWords }): BuiltEmail {
  const { words } = input;
  const business = input.orgName || words.t("yourBusiness");
  const reason = words.t("alertReason", { business });
  const settings = words.t("alertSettings");
  const text = `${input.plain}\n\n${input.link ? `${words.t("openInApp")}: ${input.link}\n\n` : ""}${plainReason(words, reason, settings)}`;
  const html = renderEmailHtml({
    locale: words.locale,
    preheader: input.plain.slice(0, 140),
    eyebrow: input.orgName || undefined,
    heading: input.title,
    blocks: [{ type: "text", text: input.plain }],
    button: input.link ? { label: words.t("openInApp"), url: input.link } : null,
    footer: { reason, settings: settingsUrl(input.appUrl) ? { label: settings, url: settingsUrl(input.appUrl) } : null }
  });
  return { subject: `${input.title}: ${input.plain.slice(0, 80)}`, text, html };
}

// ── The morning summary (app/api/line/daily-summary/route.ts) ───────────────────────────────────────────────────────

/** The words of a LINE summary (its cards), as plain lines for Telegram and email. */
export function lineSummaryText(messages: unknown): string {
  const lines: string[] = [];
  const walk = (node: any) => {
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) return node.forEach(walk);
    if (node.type === "box" && node.layout === "horizontal" && Array.isArray(node.contents)) {
      const row = node.contents.filter((child: any) => child?.type === "text" && child.text).map((child: any) => child.text).join("  ·  ");
      if (row) lines.push(row);
      return;
    }
    if (node.type === "text" && typeof node.text === "string" && node.text !== "RoveHQ") lines.push(node.text);
    for (const key of ["contents", "header", "body", "footer"]) if (node[key]) walk(node[key]);
  };
  walk(messages);
  return lines.join("\n");
}

const toneOf = (colour: unknown): "danger" | "warning" | "muted" | undefined => {
  const c = String(colour || "").toLowerCase();
  if (c === "#dc2626") return "danger";
  if (c === "#d97706") return "warning";
  if (c === "#667085") return "muted";
  return undefined;
};
const texts = (contents: any[]) => (contents || []).filter((node) => node?.type === "text" && node.text);

/** The same LINE cards, as the email's heading and boxed sections. */
function lineSummaryBlocks(messages: any[]): { eyebrow?: string; heading?: string; blocks: EmailBlock[] } {
  const message = (messages || [])[0];
  if (!message) return { blocks: [] };
  if (message.type === "text") {
    // "Good morning!\n\nNothing urgent today...": the greeting as the heading.
    const [first, ...rest] = String(message.text || "").split(/\n{2,}/);
    return rest.length ? { heading: first, blocks: [{ type: "text", text: rest.join("\n\n") }] } : { blocks: [{ type: "text", text: first }] };
  }
  const bubbles: any[] = message.contents?.type === "carousel" ? message.contents.contents || [] : message.contents ? [message.contents] : [];
  const out: { eyebrow?: string; heading?: string; blocks: EmailBlock[] } = { blocks: [] };
  for (const bubble of bubbles) {
    if (bubble.header) {
      // The greeting card: "Good morning", the date, the business.
      const words = texts(bubble.header.contents).filter((node: any) => node.text !== "RoveHQ");
      out.heading = words[0]?.text;
      const date = words[1]?.text;
      const org = texts(bubble.body?.contents || [])[0]?.text;
      out.eyebrow = [org, date].filter(Boolean).join(" · ") || undefined;
      continue;
    }
    const contents: any[] = bubble.body?.contents || [];
    const card: Extract<EmailBlock, { type: "card" }> = { type: "card", lines: [], rows: [] };
    contents.forEach((node, index) => {
      if (node.type === "text" && node.text) {
        if (index === 0 && node.weight === "bold") {
          card.title = node.text;
          card.titleTone = toneOf(node.color) === "danger" ? "danger" : "strong";
        } else if (["lg", "xl", "xxl"].includes(node.size)) card.lines!.push({ text: node.text, size: "big" });
        else card.lines!.push({ text: node.text, tone: node.weight === "bold" ? "strong" : toneOf(node.color) });
      } else if (node.type === "box" && node.layout === "horizontal") {
        const cells = texts(node.contents).map((cell: any) => String(cell.text));
        if (!cells.length) return;
        card.rows!.push(cells.length === 1 ? { label: cells[0], value: "" } : { label: cells.slice(0, -1).join(" · "), value: cells[cells.length - 1] });
      } else if (node.type === "box") {
        texts(node.contents).forEach((cell: any, at: number) => card.lines!.push({ text: cell.text, tone: at === 0 || cell.weight === "bold" ? "strong" : toneOf(cell.color) }));
      }
    });
    // Rows under lines read as one list: lines first, then rows.
    out.blocks.push(card);
  }
  return out;
}

/**
 * In the summary's own language (English or Thai, lib/line/daily-summary.ts): pass emailWords(data.locale), and the
 * subject in the same language (operatorAlerts.summarySubject, lib/operator-alert-text.ts); English when left out.
 */
export function morningSummaryEmail(input: { orgName: string | null | undefined; messages: any[]; appUrl: string; words: EmailWords; subject?: string }): BuiltEmail | null {
  const { words } = input;
  const text = lineSummaryText(input.messages);
  if (!text) return null;
  const { eyebrow, heading, blocks } = lineSummaryBlocks(input.messages);
  const business = input.orgName || words.t("yourBusiness");
  const html = renderEmailHtml({
    locale: words.locale,
    preheader: text.split("\n").slice(0, 3).join(" · "),
    eyebrow,
    heading,
    blocks,
    button: input.appUrl ? { label: words.t("openApp"), url: input.appUrl } : null,
    footer: {
      reason: words.t("summaryReason", { business }),
      settings: settingsUrl(input.appUrl) ? { label: words.t("summarySettings"), url: settingsUrl(input.appUrl) } : null
    }
  });
  return { subject: input.subject || `${input.orgName || "RoveHQ"}: your morning summary`, text: `${text}${input.appUrl ? `\n\n${words.t("openApp")}: ${input.appUrl}` : ""}`, html };
}

// ── Signed rental documents to the customer (lib/rental-document-email.ts) - the operator's brand ───────────────────

/** The wording is English for now, so the caller passes emailWords("en") and the footer matches it. */
export function executedDocumentEmail(input: {
  documentLabel: string;
  business: string;
  recipientName: string;
  filenames: string[];
  brand: EmailBrand;
  words: EmailWords;
}): BuiltEmail {
  const label = input.documentLabel.toLowerCase();
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hello,";
  const attached = `Attached is your signed ${label} from ${input.business}. Please keep it for your records.`;
  const wrong = `If anything in it looks wrong, reply to this email or contact ${input.business} directly.`;
  const subject = `Your ${label} from ${input.business}`;
  const html = renderEmailHtml({
    brand: input.brand,
    locale: input.words.locale,
    preheader: attached,
    heading: subject,
    blocks: [
      { type: "text", text: `${greeting}\n\n${attached}` },
      ...(input.filenames.length ? [{ type: "card" as const, lines: input.filenames.map((name) => ({ text: `📎 ${name}`, tone: "strong" as const })) }] : []),
      { type: "text", text: wrong }
    ],
    footer: { sentWith: input.words.t("sentWith") }
  });
  return { subject, text: [greeting, "", attached, "", wrong].join("\n"), html };
}

// ── Messages to a customer by email, when they have no chat (lib/customer-messages.ts) - the operator's brand ──────

/** In the customer's language: pass emailWords(<the customer's saved language>). */
export function customerMessageEmail(input: { subject: string; body: string; brand: EmailBrand; words: EmailWords }): BuiltEmail {
  const html = renderEmailHtml({
    brand: input.brand,
    locale: input.words.locale,
    preheader: input.body.split("\n")[0]?.slice(0, 140),
    blocks: [{ type: "text", text: input.body }],
    footer: { sentWith: input.words.t("sentWith") }
  });
  return { subject: input.subject, text: input.body, html };
}

// ── Free downloads from the website (app/actions/leads.ts) - translated ─────────────────────────────────────────────

/** Put this where the translated body has {links}; the designed list goes there. */
export const LEAD_LINKS_MARKER = "\u0000LINKS\u0000";

export function leadEmail(input: {
  subject: string;
  /** The translated text with {links} filled in, as sent before. */
  text: string;
  /** The same translated text with LEAD_LINKS_MARKER in place of {links}. */
  bodyWithMarker: string;
  heading?: string;
  downloads: Array<{ label: string; detail?: string; url: string }>;
  /** The visitor's language: emailWords(<the page's language>). */
  words: EmailWords;
}): BuiltEmail {
  const [before, after] = around(input.bodyWithMarker, LEAD_LINKS_MARKER);
  const html = renderEmailHtml({
    locale: input.words.locale,
    preheader: input.heading,
    heading: input.heading,
    blocks: [
      { type: "text", text: before },
      { type: "links", items: input.downloads.map((item, index) => ({ ...item, primary: index === 0 })) },
      { type: "text", text: after }
    ]
  });
  return { subject: input.subject, text: input.text, html };
}

// ── RoveHQ support actions (app/actions/admin.ts) ───────────────────────────────────────────────────────────────────

// The wording is English for now, so the caller passes emailWords("en") and the labels match it.

export function adminPasswordResetEmail(input: { link: string; words: EmailWords }): BuiltEmail {
  const { words } = input;
  const text = `Hello,\n\nRoveHQ support has sent you a link to choose a new password:\n\n${input.link}\n\nThe link works once and stops working after a short while. If you didn't ask for this, you can ignore this email: your password stays the same.\n\nRoveHQ`;
  const html = renderEmailHtml({
    locale: words.locale,
    preheader: "RoveHQ support has sent you a link to choose a new password.",
    heading: "Reset your RoveHQ password",
    blocks: [
      { type: "text", text: "Hello,\n\nRoveHQ support has sent you a link to choose a new password:" },
      { type: "fallback-link", intro: words.t("linkFallback"), url: input.link },
      { type: "text", text: "The link works once and stops working after a short while. If you didn't ask for this, you can ignore this email: your password stays the same.\n\nRoveHQ" }
    ],
    button: { label: words.t("choosePassword"), url: input.link },
    footer: { reason: words.t("passwordReason") }
  });
  return { subject: "Reset your RoveHQ password", text, html };
}

// ── Team invites (app/actions/auth.ts inviteUser) ───────────────────────────────────────────────────────────────────

/**
 * "You're invited to join {business} on RoveHQ" (Rory, 9 Nov 2026: the invite arrived as Supabase's plain default).
 * English for now, like the other account emails; it goes into the final translation pass.
 */
export function teamInviteEmail(input: { link: string; business: string; inviter: string | null; role: string; words: EmailWords }): BuiltEmail {
  const { words } = input;
  const who = input.inviter ? `${input.inviter} has invited you` : "You've been invited";
  const intro = `Hi,\n\n${who} to join ${input.business} on RoveHQ as ${input.role}. It's where the team runs its bookings, vehicles and payments.\n\nTap the button to accept and choose your password.`;
  const tail = "The invite works once. If it has run out, ask the person who invited you to send a new one.";
  const subject = `You're invited to join ${input.business} on RoveHQ`;
  const html = renderEmailHtml({
    locale: words.locale,
    preheader: `${who} to join ${input.business} on RoveHQ.`,
    eyebrow: input.business,
    heading: "You're invited",
    blocks: [
      { type: "text", text: intro },
      { type: "card", rows: [{ label: "Business", value: input.business, tone: "strong" }, { label: "Your role", value: input.role }, ...(input.inviter ? [{ label: "Invited by", value: input.inviter }] : [])] },
      { type: "fallback-link", intro: words.t("linkFallback"), url: input.link },
      { type: "text", text: tail, tone: "muted" }
    ],
    button: { label: "Accept the invite", url: input.link },
    footer: { reason: `You get this because someone invited this address to ${input.business} on RoveHQ. If you weren't expecting it, you can ignore this email.` }
  });
  return { subject, text: `${intro}\n\n${input.link}\n\n${tail}\n\nRoveHQ`, html };
}

export function adminEmailChangedEmail(input: { before: string | null; email: string; words: EmailWords }): BuiltEmail {
  const changed = `RoveHQ support changed the email address you sign in with${input.before ? ` from ${input.before}` : ""} to ${input.email}.`;
  const tail = "If you didn't ask for this, reply to this email or contact RoveHQ support straight away.";
  const html = renderEmailHtml({
    locale: input.words.locale,
    preheader: changed,
    heading: "Your RoveHQ email address was changed",
    blocks: [{ type: "text", text: `Hello,\n\n${changed}\n\n${tail}\n\nRoveHQ` }],
    footer: { reason: input.words.t("emailChangedReason") }
  });
  return { subject: "Your RoveHQ email address was changed", text: `Hello,\n\n${changed}\n\n${tail}\n\nRoveHQ`, html };
}
