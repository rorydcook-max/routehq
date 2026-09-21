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

function configuredProviderName() {
  return String(process.env.EMAIL_PROVIDER || "").trim().toLowerCase();
}

function resolveProvider(): EmailProvider | null {
  const name = configuredProviderName();
  if (!name) return null;

  // Register providers here once one is chosen, e.g.:
  //   if (name === "postmark") return createPostmarkProvider();
  //   if (name === "resend") return createResendProvider();

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
