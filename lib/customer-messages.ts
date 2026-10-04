import { linePush, PROVIDER_LABELS, telegramSend } from "@/lib/inbox/providers";

/**
 * Messages the business sends its customers automatically: an extension was
 * applied, a request was answered, a payment was received, a booking was
 * cancelled. They go out on the chat the customer first wrote to the business
 * on (their original conversation in the inbox). A customer with no chat gets
 * nothing sent; the message is kept on the booking, marked "not sent", so the
 * owner can pass it on themselves.
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
  /** Adds the link to the customer's own booking page. On by default. */
  withLink?: boolean;
  /** Staff member who triggered it, when there is one. */
  sentBy?: string | null;
};

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

export async function messageCustomer(admin: any, input: Input): Promise<CustomerMessageResult> {
  const text = String(input.text || "").trim();
  if (!input.customerId || !text) return { sent: false, reason: "no_customer" };

  const { data: organization } = await admin.from("organizations").select("name, settings").eq("id", input.organizationId).maybeSingle();
  if (!customerMessagesOn(organization?.settings)) return { sent: false, reason: "off" };

  const link = input.withLink === false ? null : await bookingPageUrl(admin, input.rentalId);
  const body = `${text}${link ? `\n\nYour booking: ${link}` : ""}\n\n${organization?.name || ""}`.trim();

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
        metadata: { automatic: true, ...metadata }
      })
      .then(() => null, () => null);

  const conversation = await originalConversation(admin, input.organizationId, input.customerId).catch(() => null);
  if (!conversation) {
    await log("pending", null, { not_sent_reason: "no_chat" });
    return { sent: false, reason: "no_chat" };
  }

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
  await log(result.ok ? "sent" : "failed", conversation.provider, { conversation_id: conversation.id, ...(result.ok ? {} : { error: result.error }) });
  return result.ok ? { sent: true, via } : { sent: false, reason: "failed", detail: result.error };
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
};

/**
 * Tells the customer of a rental something, with the rental's details to
 * hand. Never throws: a message that can't be sent must not undo the action
 * that caused it.
 */
export async function tellRentalCustomer(admin: any, rentalId: string, build: (context: RentalMessageContext) => string, options: { sentBy?: string | null; withLink?: boolean } = {}): Promise<CustomerMessageResult> {
  try {
    const { data: rental } = await admin
      .from("rentals")
      .select("id, organization_id, customer_id, currency, vehicles!rentals_vehicle_id_fkey(make, model), customers!rentals_customer_id_fkey(full_name)")
      .eq("id", rentalId)
      .maybeSingle();
    if (!rental?.customer_id) return { sent: false, reason: "no_customer" };
    const currency = String(rental.currency || "THB");
    const context: RentalMessageContext = {
      rentalId,
      organizationId: rental.organization_id,
      customerId: rental.customer_id,
      firstName: String(rental.customers?.full_name || "").trim().split(/\s+/)[0] || "there",
      vehicle: [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" ") || "vehicle",
      currency,
      money: (amount: number) => `${currency === "THB" ? "฿" : `${currency} `}${Math.round(amount).toLocaleString("en-US")}`
    };
    return await messageCustomer(admin, { organizationId: rental.organization_id, customerId: rental.customer_id, rentalId, text: build(context), sentBy: options.sentBy, withLink: options.withLink });
  } catch {
    return { sent: false, reason: "failed" };
  }
}
