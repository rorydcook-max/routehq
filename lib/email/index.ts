/**
 * Provider-agnostic transactional email.
 *
 * No provider is wired up yet. Until one is, sendEmail() returns
 * { status: "not_configured" } without throwing, so callers can record that a
 * send was skipped and carry on. Adding a provider means implementing
 * EmailProvider and returning it from resolveProvider() - nothing else changes.
 *
 * Requirements a provider must meet for rental documents (see the contract
 * system spec, Workstream 4): delivery webhooks, attachment support, a
 * custom sending domain with DKIM/SPF, and retained send logs.
 */

export type EmailAttachment = {
  filename: string;
  content: Uint8Array;
  contentType: string;
};

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
  attachments?: EmailAttachment[];
  /** Free-form labels passed to the provider for tracking, e.g. document id. */
  metadata?: Record<string, string>;
};

export type EmailSendResult =
  | { status: "sent"; provider: string; messageId: string }
  | { status: "not_configured" }
  | { status: "failed"; provider: string; error: string };

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<{ messageId: string }>;
}

/**
 * Resend (resend.com) over its HTTP API, no SDK. Needs EMAIL_PROVIDER=resend, RESEND_API_KEY and
 * EMAIL_FROM (e.g. "RoveHQ <alerts@rovehq.app>", on a domain verified in Resend with DKIM/SPF).
 */
function createResendProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) throw new Error("EMAIL_PROVIDER is resend but RESEND_API_KEY or EMAIL_FROM is missing.");
  return {
    name: "resend",
    async send(message) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: [message.to],
          subject: message.subject,
          text: message.text,
          reply_to: message.replyTo || undefined,
          attachments: message.attachments?.map((file) => ({ filename: file.filename, content: Buffer.from(file.content).toString("base64") })),
          tags: message.metadata ? Object.entries(message.metadata).map(([name, value]) => ({ name, value: value.replace(/[^\w-]/g, "_").slice(0, 256) })) : undefined
        })
      });
      const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok || !json.id) throw new Error(json.message || `Resend HTTP ${res.status}`);
      return { messageId: json.id };
    }
  };
}

function configuredProviderName() {
  return String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
}

function resolveProvider(): EmailProvider | null {
  const name = configuredProviderName();
  if (!name) return null;

  if (name === "resend") return createResendProvider();

  throw new Error(`EMAIL_PROVIDER is set to "${name}" but no adapter is implemented for it.`);
}

/** True when a provider is configured, so callers can skip expensive prep such as downloading attachments. */
export function isEmailConfigured() {
  return configuredProviderName() !== "";
}

export async function sendEmail(message: EmailMessage): Promise<EmailSendResult> {
  let provider: EmailProvider | null;
  try {
    provider = resolveProvider();
  } catch (error) {
    return { status: "failed", provider: configuredProviderName(), error: error instanceof Error ? error.message : String(error) };
  }

  if (!provider) return { status: "not_configured" };

  try {
    const { messageId } = await provider.send(message);
    return { status: "sent", provider: provider.name, messageId };
  } catch (error) {
    return { status: "failed", provider: provider.name, error: error instanceof Error ? error.message : String(error) };
  }
}
