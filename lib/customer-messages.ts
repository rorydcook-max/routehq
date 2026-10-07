import { isEmailConfigured, sendEmail } from "@/lib/email";
import { customerDate } from "@/lib/i18n/customer-dates";
import { customerMessageText } from "@/lib/i18n/customer-message-text";
import { linePush, PROVIDER_LABELS, telegramSend } from "@/lib/inbox/providers";

/**
 * Messages the business sends its customers automatically: an extension was
 * applied, a request was answered, a payment is due or was received, a
 * booking was cancelled.
 *
 * Where a message goes, in order:
 *   1. The chat the customer first wrote to the business on (their original
 *      conversation in the inbox).
 *   2. Email, when the customer gave one and an email provider is connected.
 *   3. Nowhere automatically. LINE, Telegram and WhatsApp don't let a business
 *      start a chat with someone who hasn't messaged it first, so the message
 *      is kept on the booking as "not sent", with a one-tap link that opens the
 *      customer's preferred app with the text filled in for the owner to send.
 *
 * The customer's booking page invites them to open a chat (see
 * lib/customer-chat-link.ts); once they do, route 1 applies from then on.
 *
 * Takes a service-role client: these are sent from customer actions and the
 * daily job as well as by signed-in staff.
 */

export type CustomerMessageResult = { sent: true; via: string } | { sent: false; reason: "off" | "no_customer" | "no_chat" | "failed"; detail?: string };

type Input = {
  organizationId: string;
  customerId: string | null | undefined;
  rentalId?: string | null;
  text: string;
  /** The customer's language, for the line that introduces the link and the email subject. */
  locale?: string | null;
  /** Adds the link to the customer's own booking page. On by default. */
  withLink?: boolean;
  /** Staff member who triggered it, when there is one. */
  sentBy?: string | null;
  /** Extra details kept with the record, e.g. the key that stops a reminder going twice. */
  metadata?: Record<string, unknown>;
  /**
   * The customer has just read this on their own booking page (they made the change themselves).
   * It still goes to their chat or email when that is automatic, but it is not left for the owner to send by hand.
   */
  seenAlready?: boolean;
  /**
   * This message closes the story (the vehicle is back, the booking is cancelled). Anything still waiting
   * to be sent by hand for the rental is out of date - "extended to the 13th" must not go out after the return.
   */
  replacesEarlier?: boolean;
};

/** Marks a rental's waiting-to-be-sent messages as overtaken, so they are no longer offered for sending. */
async function retireUnsent(admin: any, organizationId: string, rentalId: string) {
  const { data: rows } = await admin
    .from("communication_log")
    .select("id, metadata")
    .eq("organisation_id", organizationId)
    .eq("rental_id", rentalId)
    .eq("type", "automated_reminder")
    .in("status", ["pending", "failed"]);
  await Promise.all(
    (rows || [])
      .filter((row: any) => !row.metadata?.superseded)
      .map((row: any) => admin.from("communication_log").update({ metadata: { ...(row.metadata || {}), superseded: true } }).eq("id", row.id).then(() => null, () => null))
  );
}

export function customerMessagesOn(settings: any) {
  return settings?.customer_messages?.enabled !== false;
}

async function bookingPageUrl(admin: any, rentalId: string | null | undefined) {
  if (!rentalId) return null;
  const { data } = await admin.from("booking_links").select("token, public_url").eq("rental_id", rentalId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!data?.token) return null;
  const base = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  return data.public_url || (base ? `${base}/book/${data.token}` : null);
}

/** The chat this customer first used with the business, if its account is still connected. */
async function originalConversation(admin: any, organizationId: string, customerId: string) {
  const { data: conversations } = await admin
    .from("conversations")
    .select("id, channel_id, provider, external_user_id, created_at, messaging_channels!inner(status)")
    .eq("organization_id", organizationId)
    .eq("customer_id", customerId)
    .neq("messaging_channels.status", "disconnected")
    .order("created_at", { ascending: true })
    .limit(1);
  return (conversations || [])[0] || null;
}

const digitsOf = (value: unknown) => String(value || "").replace(/\D/g, "");

/**
 * A link the owner can tap to send the message themselves in the app the
 * customer said they prefer, with the text already filled in where the app
 * allows it.
 */
export function handoffFor(customer: any, body: string): { channel: string; label: string; url: string | null } {
  const text = encodeURIComponent(body);
  const phone = digitsOf(customer?.whatsapp_number || customer?.phone);
  const options: Record<string, () => { channel: string; label: string; url: string | null } | null> = {
    whatsapp: () => (phone ? { channel: "whatsapp", label: "Send on WhatsApp", url: `https://wa.me/${phone.startsWith("0") ? `66${phone.slice(1)}` : phone}?text=${text}` } : null),
    telegram: () => (customer?.telegram_username ? { channel: "telegram", label: "Send on Telegram", url: `https://t.me/${String(customer.telegram_username).replace(/^@/, "")}?text=${text}` } : null),
    email: () => (customer?.email ? { channel: "email", label: "Send by email", url: `mailto:${customer.email}?body=${text}` } : null),
    // LINE and Messenger can't be opened to a person with text filled in.
    line: () => (customer?.line_id ? { channel: "line", label: `Copy and send on LINE (${customer.line_id})`, url: null } : null),
    messenger: () => (customer?.messenger_id ? { channel: "messenger", label: `Copy and send on Messenger (${customer.messenger_id})`, url: null } : null),
    sms: () => (digitsOf(customer?.phone) ? { channel: "sms", label: "Send by text message", url: `sms:+${digitsOf(customer.phone)}?body=${text}` } : null),
    phone: () => (digitsOf(customer?.phone) ? { channel: "sms", label: "Send by text message", url: `sms:+${digitsOf(customer.phone)}?body=${text}` } : null)
  };
  const preferred = String(customer?.preferred_contact_method || "").toLowerCase();
  const order = [preferred, "whatsapp", "telegram", "line", "email", "sms"].filter((key, index, all) => key && all.indexOf(key) === index);
  for (const key of order) {
    const found = options[key]?.();
    if (found) return found;
  }
  return { channel: "none", label: "Copy and send it yourself", url: null };
}

async function customerContact(admin: any, customerId: string) {
  const { data } = await admin
    .from("customers")
    .select("full_name, email, phone, whatsapp_number, line_id, telegram_username, messenger_id, preferred_contact_method")
    .eq("id", customerId)
    .maybeSingle();
  return data;
}

export async function messageCustomer(admin: any, input: Input): Promise<CustomerMessageResult> {
  const text = String(input.text || "").trim();
  if (!input.customerId || !text) return { sent: false, reason: "no_customer" };

  const { data: organization } = await admin.from("organizations").select("name, settings").eq("id", input.organizationId).maybeSingle();
  if (!customerMessagesOn(organization?.settings)) return { sent: false, reason: "off" };

  if (input.replacesEarlier && input.rentalId) await retireUnsent(admin, input.organizationId, input.rentalId).catch(() => null);

  const link = input.withLink === false ? null : await bookingPageUrl(admin, input.rentalId);
  const wording = await customerMessageText(input.locale);
  const body = `${text}${link ? `\n\n${wording.t("yourBooking", { link })}` : ""}\n\n${organization?.name || ""}`.trim();

  const log = (status: "sent" | "failed" | "pending", channel: string | null, metadata: Record<string, unknown>) =>
    admin
      .from("communication_log")
      .insert({
        organisation_id: input.organizationId,
        rental_id: input.rentalId || null,
        customer_id: input.customerId,
        type: "automated_reminder",
        channel,
        direction: "outbound",
        content: body,
        status,
        created_by: input.sentBy || null,
        metadata: { automatic: true, ...(input.metadata || {}), ...metadata }
      })
      .then(() => null, () => null);

  // 1. Their own chat with the business.
  const conversation = await originalConversation(admin, input.organizationId, input.customerId).catch(() => null);
  if (conversation) {
    const { data: secrets } = await admin.from("messaging_channel_secrets").select("access_token").eq("channel_id", conversation.channel_id).maybeSingle();
    const token = String(secrets?.access_token || "");
    const result = !token
      ? { ok: false as const, error: "The messaging account is not connected." }
      : conversation.provider === "line"
        ? await linePush(token, conversation.external_user_id, body)
        : conversation.provider === "telegram"
          ? await telegramSend(token, conversation.external_user_id, body)
          : { ok: false as const, error: "Sending on this platform isn't supported yet." };

    const via = PROVIDER_LABELS[conversation.provider] || conversation.provider;
    const now = new Date().toISOString();
    await admin
      .from("conversation_messages")
      .insert({
        organization_id: input.organizationId,
        conversation_id: conversation.id,
        direction: "out",
        body,
        sent_by: input.sentBy || null,
        status: result.ok ? "sent" : "failed",
        error: result.ok ? null : result.error || "Not delivered"
      })
      .then(() => null, () => null);
    if (result.ok) {
      await admin.from("conversations").update({ last_message_at: now, last_message_preview: body.slice(0, 140), last_message_direction: "out" }).eq("id", conversation.id).then(() => null, () => null);
    }
    if (result.ok) {
      await log("sent", conversation.provider, { conversation_id: conversation.id });
      return { sent: true, via };
    }
    const fallback = handoffFor(await customerContact(admin, input.customerId), body);
    await log("failed", conversation.provider, { conversation_id: conversation.id, error: result.error, handoff_label: fallback.label, handoff_url: fallback.url });
    return { sent: false, reason: "failed", detail: result.error };
  }

  const customer = await customerContact(admin, input.customerId);

  // 2. Email, the one channel a business can start a conversation on.
  if (customer?.email && isEmailConfigured()) {
    const result = await sendEmail({ to: customer.email, subject: wording.t("emailSubject", { business: organization?.name || "RouteHQ" }), text: body });
    if (result.status === "sent") {
      await log("sent", "email", { provider: result.provider });
      return { sent: true, via: "email" };
    }
    if (result.status === "failed") await log("failed", "email", { error: result.error });
  }

  if (input.seenAlready) return { sent: false, reason: "no_chat" };

  // 3. Ready for the owner to send in the app the customer prefers.
  const handoff = handoffFor(customer, body);
  await log("pending", handoff.channel === "none" ? null : handoff.channel, { not_sent_reason: "no_chat", handoff_label: handoff.label, handoff_url: handoff.url });
  return { sent: false, reason: "no_chat" };
}

/** Closes the open jobs of one kind on a rental, e.g. the "Refund to decide" job once a refund is recorded. */
export async function completeRentalJobs(admin: any, rentalId: string, action: "refund" | "request", note?: string, portalActionId?: string) {
  let query = admin.from("tasks").update({ completed_at: new Date().toISOString(), ...(note ? { completion_notes: note } : {}) }).eq("rental_id", rentalId).eq("action", action).is("completed_at", null);
  if (portalActionId) query = query.eq("portal_action_id", portalActionId);
  await query.then(() => null, () => null);
}

export type RentalMessageContext = {
  rentalId: string;
  organizationId: string;
  customerId: string | null;
  firstName: string;
  vehicle: string;
  currency: string;
  money: (amount: number) => string;
  /** The customer's language. */
  locale: string;
  /** One sentence of a message, in the customer's language (see "customerMessages" in the locale files). */
  t: (key: string, values?: Record<string, string | number>) => string;
  /** The same, opened with "Hi <first name>,". */
  say: (key: string, values?: Record<string, string | number>) => string;
  /** "Hi <first name>," on its own, for a message the owner wrote themselves. */
  hi: string;
  /** A button or heading exactly as it reads on the customer's booking page. */
  label: (key: string) => string;
  /** "2026-11-04" -> "4 Nov 2026" in the customer's language. */
  date: (iso: unknown) => string;
};

/**
 * Tells the customer of a rental something, with the rental's details to
 * hand. Never throws: a message that can't be sent must not undo the action
 * that caused it.
 */
export async function tellRentalCustomer(
  admin: any,
  rentalId: string,
  build: (context: RentalMessageContext) => string,
  options: { sentBy?: string | null; withLink?: boolean; metadata?: Record<string, unknown>; seenAlready?: boolean; replacesEarlier?: boolean } = {}
): Promise<CustomerMessageResult> {
  try {
    const { data: rental } = await admin
      .from("rentals")
      .select("id, organization_id, customer_id, currency, vehicles!rentals_vehicle_id_fkey(make, model), customers!rentals_customer_id_fkey(full_name, preferred_locale)")
      .eq("id", rentalId)
      .maybeSingle();
    if (!rental?.customer_id) return { sent: false, reason: "no_customer" };
    const currency = String(rental.currency || "THB");
    const wording = await customerMessageText(rental.customers?.preferred_locale);
    const givenName = String(rental.customers?.full_name || "").trim().split(/\s+/)[0] || "";
    const hi = givenName ? wording.t("hi", { name: givenName }) : wording.t("hiNoName");
    const context: RentalMessageContext = {
      locale: wording.locale,
      t: wording.t,
      say: (key, values) => `${hi} ${wording.t(key, values)}`,
      hi,
      label: wording.label,
      date: (iso) => customerDate(String(iso || "").slice(0, 10), wording.locale),
      rentalId,
      organizationId: rental.organization_id,
      customerId: rental.customer_id,
      firstName: String(rental.customers?.full_name || "").trim().split(/\s+/)[0] || "there",
      vehicle: [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ") || "vehicle",
      currency,
      money: (amount: number) => `${currency === "THB" ? "฿" : `${currency} `}${Math.round(amount).toLocaleString("en-US")}`
    };
    return await messageCustomer(admin, {
      organizationId: rental.organization_id,
      customerId: rental.customer_id,
      rentalId,
      text: build(context),
      locale: wording.locale,
      sentBy: options.sentBy,
      withLink: options.withLink,
      metadata: options.metadata,
      seenAlready: options.seenAlready,
      replacesEarlier: options.replacesEarlier
    });
  } catch {
    return { sent: false, reason: "failed" };
  }
}

/**
 * The same, but at most once per key for a rental: the daily job can run it
 * every day and each reminder still goes out a single time.
 */
export async function remindRentalCustomerOnce(admin: any, rentalId: string, key: string, build: (context: RentalMessageContext) => string, options: { withLink?: boolean } = {}): Promise<boolean> {
  // Claim the reminder first: the table's primary key lets only one run through, even if two start together.
  const { error: claimed } = await admin.from("customer_reminders").insert({ rental_id: rentalId, reminder_key: key });
  if (claimed) return false;
  const result = await tellRentalCustomer(admin, rentalId, build, { withLink: options.withLink, metadata: { reminder_key: key } });
  if (!result.sent && (result.reason === "off" || result.reason === "no_customer")) {
    // Nothing was sent or recorded, so let it be tried again once messages are on or the customer is known.
    await admin.from("customer_reminders").delete().eq("rental_id", rentalId).eq("reminder_key", key);
    return false;
  }
  return true;
}
