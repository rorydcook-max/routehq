/**
 * Every email the app sends, as subject + plain text + designed HTML (lib/email/layout.ts).
 *
 * The plain text and subjects are exactly what each email said before the redesign (4 Nov 2026): this file only adds
 * the HTML version beside them. Pure functions (no database), so scripts/email-previews.ts can draw each one with
 * sample data.
 */

import { renderEmailHtml, type EmailBlock, type EmailBrand } from "@/lib/email/layout";

export type BuiltEmail = { subject: string; text: string; html: string };

const settingsUrl = (appUrl: string) => (appUrl ? `${appUrl}/settings/notifications` : "");

/** Split text around a marker (used to drop a designed block where a translated sentence had a placeholder). */
function around(text: string, marker: string): [string, string] {
  const at = text.indexOf(marker);
  return at < 0 ? [text, ""] : [text.slice(0, at), text.slice(at + marker.length)];
}

// ── Operator alerts (lib/notify-operator.ts) ────────────────────────────────────────────────────────────────────────

export function operatorAlertEmail(input: { title: string; plain: string; link: string; orgName: string | null | undefined; appUrl: string }): BuiltEmail {
  const business = input.orgName || "your business";
  const reason = `You get this because email alerts are on for ${business}. Change them in Settings › Notifications.`;
  const text = `${input.plain}\n\n${input.link ? `Open in RoveHQ: ${input.link}\n\n` : ""}${reason}`;
  const html = renderEmailHtml({
    preheader: input.plain.slice(0, 140),
    eyebrow: input.orgName || undefined,
    heading: input.title,
    blocks: [{ type: "text", text: input.plain }],
    button: input.link ? { label: "Open in RoveHQ", url: input.link } : null,
    footer: { reason: `You get this because email alerts are on for ${business}.`, settings: settingsUrl(input.appUrl) ? { label: "Change them in Settings › Notifications", url: settingsUrl(input.appUrl) } : null }
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

export function morningSummaryEmail(input: { orgName: string | null | undefined; messages: any[]; appUrl: string; locale?: string | null }): BuiltEmail | null {
  const text = lineSummaryText(input.messages);
  if (!text) return null;
  const { eyebrow, heading, blocks } = lineSummaryBlocks(input.messages);
  const business = input.orgName || "your business";
  const html = renderEmailHtml({
    locale: input.locale,
    preheader: text.split("\n").slice(0, 3).join(" · "),
    eyebrow,
    heading,
    blocks,
    button: input.appUrl ? { label: "Open RoveHQ", url: input.appUrl } : null,
    footer: {
      reason: `You get this because the morning summary by email is on for ${business}.`,
      settings: settingsUrl(input.appUrl) ? { label: "Change it in Settings › Notifications", url: settingsUrl(input.appUrl) } : null
    }
  });
  return { subject: `${input.orgName || "RoveHQ"}: your morning summary`, text: `${text}${input.appUrl ? `\n\nOpen RoveHQ: ${input.appUrl}` : ""}`, html };
}

// ── Signed rental documents to the customer (lib/rental-document-email.ts) - the operator's brand ───────────────────

export function executedDocumentEmail(input: {
  documentLabel: string;
  business: string;
  recipientName: string;
  filenames: string[];
  brand: EmailBrand;
}): BuiltEmail {
  const label = input.documentLabel.toLowerCase();
  const greeting = input.recipientName ? `Hi ${input.recipientName},` : "Hello,";
  const attached = `Attached is your signed ${label} from ${input.business}. Please keep it for your records.`;
  const wrong = `If anything in it looks wrong, reply to this email or contact ${input.business} directly.`;
  const subject = `Your ${label} from ${input.business}`;
  const html = renderEmailHtml({
    brand: input.brand,
    preheader: attached,
    heading: subject,
    blocks: [
      { type: "text", text: `${greeting}\n\n${attached}` },
      ...(input.filenames.length ? [{ type: "card" as const, lines: input.filenames.map((name) => ({ text: `📎 ${name}`, tone: "strong" as const })) }] : []),
      { type: "text", text: wrong }
    ]
  });
  return { subject, text: [greeting, "", attached, "", wrong].join("\n"), html };
}

// ── Messages to a customer by email, when they have no chat (lib/customer-messages.ts) - the operator's brand ──────

export function customerMessageEmail(input: { subject: string; body: string; brand: EmailBrand; locale?: string | null }): BuiltEmail {
  const html = renderEmailHtml({
    brand: input.brand,
    locale: input.locale,
    preheader: input.body.split("\n")[0]?.slice(0, 140),
    blocks: [{ type: "text", text: input.body }]
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
  locale?: string | null;
}): BuiltEmail {
  const [before, after] = around(input.bodyWithMarker, LEAD_LINKS_MARKER);
  const html = renderEmailHtml({
    locale: input.locale,
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

export function adminPasswordResetEmail(input: { link: string }): BuiltEmail {
  const text = `Hello,\n\nRoveHQ support has sent you a link to choose a new password:\n\n${input.link}\n\nThe link works once and stops working after a short while. If you didn't ask for this, you can ignore this email: your password stays the same.\n\nRoveHQ`;
  const html = renderEmailHtml({
    preheader: "RoveHQ support has sent you a link to choose a new password.",
    heading: "Reset your RoveHQ password",
    blocks: [
      { type: "text", text: "Hello,\n\nRoveHQ support has sent you a link to choose a new password:" },
      { type: "fallback-link", intro: "If the button doesn't work, copy this link into your browser:", url: input.link },
      { type: "text", text: "The link works once and stops working after a short while. If you didn't ask for this, you can ignore this email: your password stays the same.\n\nRoveHQ" }
    ],
    button: { label: "Choose a new password", url: input.link },
    footer: { reason: "You get this because RoveHQ support sent you a password link." }
  });
  return { subject: "Reset your RoveHQ password", text, html };
}

export function adminEmailChangedEmail(input: { before: string | null; email: string }): BuiltEmail {
  const changed = `RoveHQ support changed the email address you sign in with${input.before ? ` from ${input.before}` : ""} to ${input.email}.`;
  const tail = "If you didn't ask for this, reply to this email or contact RoveHQ support straight away.";
  const html = renderEmailHtml({
    preheader: changed,
    heading: "Your RoveHQ email address was changed",
    blocks: [{ type: "text", text: `Hello,\n\n${changed}\n\n${tail}\n\nRoveHQ` }],
    footer: { reason: "You get this because the sign-in email on your RoveHQ account changed." }
  });
  return { subject: "Your RoveHQ email address was changed", text: `Hello,\n\n${changed}\n\n${tail}\n\nRoveHQ`, html };
}
