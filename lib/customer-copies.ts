import { isEmailConfigured, sendEmail, type EmailAttachment } from "@/lib/email";
import { operatorEmailBrandById } from "@/lib/email/operator-brand";
import { customerMessageEmail } from "@/lib/email/templates";
import { emailWords } from "@/lib/email/words";
import { hasCustomerChat, messageCustomer } from "@/lib/customer-messages";
import { customerDate, customerDateTime } from "@/lib/i18n/customer-dates";
import { customerMessageText, type CustomerMessageText } from "@/lib/i18n/customer-message-text";
import { niceMoney } from "@/lib/nice-money";
import { displayPhone } from "@/lib/phone";
import { defaultTimeZone } from "@/lib/regional";
import { recordActivityEventOnce } from "@/lib/supabase/activity";

/**
 * The customer's own copies (Rory, 8 Nov 2026): once the agreement is signed, the signed agreement and the booking's
 * details; once a handover or return report is signed (on the spot or later from the link), the report.
 *
 * In the customer's language. By email with the PDF attached when they gave an address and email is set up; on their
 * chat with the business too when they have one; otherwise a message with links, ready for the owner to send in the
 * app the customer prefers (lib/customer-messages.ts). Links go to pages that open a fresh download each time
 * (app/(app)/book/[token]/agreement, .../report/[inspectionId]), since stored-file links expire.
 *
 * Each copy goes once: the first send claims a key in customer_reminders (rental_id + key is its primary key), so a
 * retried signing or a second report finalisation sends nothing more. Never throws.
 *
 * Takes a service-role client.
 */

type StoredFile = { bucket: string | null | undefined; path: string | null | undefined; filename: string };

type CopyContext = {
  rental: any;
  organization: any;
  customer: any;
  vehicle: string;
  timeZone: string;
  wording: CustomerMessageText;
  bookingPage: string | null;
  token: string | null;
  bookingData: Record<string, any>;
  hi: string;
};

const appBase = () => String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

async function loadContext(admin: any, rentalId: string): Promise<CopyContext | null> {
  const { data: rental } = await admin.from("rentals").select("*").eq("id", rentalId).maybeSingle();
  if (!rental?.customer_id) return null;
  const [{ data: organization }, { data: customer }, { data: vehicle }, { data: link }] = await Promise.all([
    admin.from("organizations").select("name, timezone, country_code, settings, business_phone, business_email").eq("id", rental.organization_id).maybeSingle(),
    admin.from("customers").select("full_name, email, preferred_locale").eq("id", rental.customer_id).maybeSingle(),
    rental.vehicle_id ? admin.from("vehicles").select("make, model, registration_number").eq("id", rental.vehicle_id).maybeSingle() : Promise.resolve({ data: null }),
    admin.from("booking_links").select("token, public_url, booking_data").eq("rental_id", rentalId).is("deleted_at", null).order("created_at", { ascending: false }).limit(1).maybeSingle()
  ]);
  const wording = await customerMessageText(customer?.preferred_locale);
  const givenName = String(customer?.full_name || "").trim().split(/\s+/)[0] || "";
  const token = link?.token ? String(link.token) : null;
  const base = appBase();
  return {
    rental,
    organization: organization || {},
    customer: customer || {},
    vehicle: [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") + (vehicle?.registration_number ? ` (${vehicle.registration_number})` : "") || "vehicle",
    // The business's own zone; without one, its country's usual zone (lib/regional.ts).
    timeZone: String(organization?.timezone || defaultTimeZone(organization?.country_code)),
    wording,
    token,
    bookingPage: token ? (base ? `${base}/book/${token}` : link?.public_url || null) : null,
    bookingData: (link?.booking_data || {}) as Record<string, any>,
    hi: givenName ? wording.t("hi", { name: givenName }) : wording.t("hiNoName")
  };
}

/** Claims a copy's key; false when it was already sent (or is being sent). */
async function claim(admin: any, rentalId: string, key: string) {
  const { error } = await admin.from("customer_reminders").insert({ rental_id: rentalId, reminder_key: key });
  return !error;
}

async function download(admin: any, files: StoredFile[]): Promise<EmailAttachment[]> {
  const out: EmailAttachment[] = [];
  for (const file of files) {
    if (!file.bucket || !file.path) continue;
    const { data, error } = await admin.storage.from(file.bucket).download(file.path);
    if (error || !data) throw new Error(`Could not load ${file.filename}: ${error?.message || "not found"}`);
    out.push({ filename: file.filename, content: new Uint8Array(await data.arrayBuffer()), contentType: "application/pdf" });
  }
  return out;
}

/**
 * Sends one copy: email with the PDFs, then the chat (or the owner's send-it-yourself message) when there is no email
 * or the customer has a chat with the business. Records the email outcome on the document's history, as before.
 */
async function deliver(
  admin: any,
  ctx: CopyContext,
  copy: { key: string; subject: string; emailText: string; chatText: string; files: StoredFile[]; documentId: string; versionId: string; label: string }
) {
  const { rental, organization, customer } = ctx;
  if (!(await claim(admin, rental.id, copy.key))) return { status: "already_sent" as const };

  const event = (status: string, title: string, detail: string, metadata: Record<string, unknown> = {}) =>
    recordActivityEventOnce(
      admin,
      {
        organization_id: rental.organization_id,
        entity_type: "document",
        entity_id: copy.documentId,
        vehicle_id: rental.vehicle_id ?? null,
        rental_id: rental.id,
        customer_id: rental.customer_id ?? null,
        event_type: `rental_document_email_${status}`,
        title,
        detail,
        metadata: { document_id: copy.documentId, version_id: copy.versionId, ...metadata }
      },
      `rental_document_email_${status}:${copy.versionId}`
    ).catch(() => undefined);

  let emailed = false;
  const to = String(customer.email || "").trim();
  if (to && isEmailConfigured()) {
    try {
      const attachments = await download(admin, copy.files);
      const business = String(organization.name || "");
      const brand = await operatorEmailBrandById(admin, rental.organization_id, business);
      const result = await sendEmail({
        to,
        ...customerMessageEmail({ subject: copy.subject, body: copy.emailText, brand, words: await emailWords(ctx.wording.locale) }),
        ...(organization.business_email ? { replyTo: String(organization.business_email) } : {}),
        attachments,
        metadata: { document_id: copy.documentId, version_id: copy.versionId }
      });
      emailed = result.status === "sent";
      await admin
        .from("communication_log")
        .insert({
          organisation_id: rental.organization_id,
          rental_id: rental.id,
          customer_id: rental.customer_id,
          type: "automated_reminder",
          channel: "email",
          direction: "outbound",
          content: copy.emailText,
          status: emailed ? "sent" : "failed",
          metadata: { automatic: true, copy: copy.key, attachments: attachments.map((file) => file.filename), ...(result.status === "failed" ? { error: result.error } : {}) }
        })
        .then(() => null, () => null);
      if (result.status === "sent") await event("sent", `${copy.label} emailed`, `Sent to ${to}.`, { recipient: to, provider: result.provider, message_id: result.messageId });
      else if (result.status === "failed") await event("failed", `${copy.label} email failed`, result.error, { recipient: to, provider: result.provider });
    } catch (error) {
      await event("failed", `${copy.label} email failed`, error instanceof Error ? error.message : String(error), { recipient: to });
    }
  } else {
    await event(
      "skipped",
      `${copy.label} not emailed`,
      to ? `No email provider is configured, so the copy for ${to} was not sent by email.` : "The customer has no email address on file.",
      { reason: to ? "not_configured" : "no_recipient", ...(to ? { recipient: to } : {}) }
    );
  }

  // Their usual channel: the chat they use with the business, or, without email, a message with the links.
  const chat = await hasCustomerChat(admin, rental.organization_id, rental.customer_id).catch(() => false);
  if (!emailed || chat) {
    const result = await messageCustomer(admin, {
      organizationId: rental.organization_id,
      customerId: rental.customer_id,
      rentalId: rental.id,
      text: copy.chatText,
      locale: ctx.wording.locale,
      withLink: true,
      metadata: { copy: copy.key }
    });
    if (!emailed && !result.sent && (result.reason === "off" || result.reason === "no_customer")) {
      // Nothing went out at all: let a later attempt try again.
      await admin.from("customer_reminders").delete().eq("rental_id", rental.id).eq("reminder_key", copy.key);
      return { status: "not_sent" as const };
    }
    return { status: "sent" as const, emailed, via: result.sent ? result.via : "pending" };
  }
  return { status: "sent" as const, emailed, via: "email" };
}

/** What a scheduled payment is, for its name in the customer's copy (copyPay_<kind>). */
function paymentKind(metadata: any): "deposit" | "top_up" | "extension" | "charge" | "extras" | "late_return" | "rent" {
  const type = String(metadata?.type || "");
  if (type === "deposit" || metadata?.is_deposit === true) return "deposit";
  if (type === "deposit_top_up") return "top_up";
  if (type === "extension") return "extension";
  if (type === "charge") return "charge";
  if (type === "extras") return "extras";
  if (metadata?.late_return) return "late_return";
  return "rent";
}

function rentalDates(ctx: CopyContext) {
  const { rental, wording } = ctx;
  const start = customerDate(String(rental.start_date || "").slice(0, 10), wording.locale);
  if (rental.is_indefinite || !rental.end_date) return wording.t("whenMonthly", { start });
  return wording.t("whenRange", { start, end: customerDate(String(rental.end_date).slice(0, 10), wording.locale) });
}

function contactLine(ctx: CopyContext) {
  const settings = ctx.organization.settings || {};
  // International format with the business's country code ("+44 7700 900123"), as the rest of the app shows it.
  const phone = displayPhone(String(ctx.organization.business_phone || settings.phone || settings.business_phone || "").trim(), ctx.organization.country_code);
  const email = String(ctx.organization.business_email || settings.business_email || "").trim();
  const details = [phone, email].filter(Boolean).join(", ");
  return details ? ctx.wording.t("copyContact", { business: String(ctx.organization.name || ""), details }) : "";
}

/** The signed agreement and the booking's details, once the customer has signed. */
export async function sendSignedAgreementCopy(
  admin: any,
  input: { rentalId: string; documentId: string; versionId: string; agreement: StoredFile; certificate?: StoredFile | null }
) {
  try {
    const ctx = await loadContext(admin, input.rentalId);
    if (!ctx) return { status: "no_customer" as const };
    const { rental, wording, timeZone } = ctx;
    const t = wording.t;
    const currency = String(rental.currency || "THB");
    const money = (amount: unknown) => niceMoney(Number(amount || 0), currency);

    const handoverAt = rental.delivery_datetime || ctx.bookingData.delivery_datetime || null;
    const handoverPlace = String(ctx.bookingData.delivery_location || rental.delivery_location || "").trim();
    const handover = [handoverAt ? customerDateTime(String(handoverAt), wording.locale, timeZone) : "", handoverPlace].filter(Boolean).join(", ");
    const model = ["daily", "weekly", "monthly", "custom"].includes(String(rental.pricing_model)) ? String(rental.pricing_model) : "monthly";

    const { data: due } = await admin
      .from("rental_payments")
      .select("amount, due_date, status, voided, metadata")
      .eq("rental_id", rental.id)
      .is("deleted_at", null)
      .in("status", ["pending", "scheduled", "overdue"])
      .order("due_date", { ascending: true })
      .limit(4);
    // Each payment named for what it is ("Deposit £300 on 20 Nov; Rent £180 on 20 Nov"), final pre-release test, 8 Nov 2026.
    const payments = (due || [])
      .filter((row: any) => !row.voided && Number(row.amount || 0) > 0)
      .map((row: any) =>
        t("copyPaymentItem", { label: t(`copyPay_${paymentKind(row.metadata)}`), amount: money(row.amount), date: customerDate(String(row.due_date || "").slice(0, 10), wording.locale) })
      );

    const agreementLink = ctx.token && appBase() ? `${appBase()}/book/${ctx.token}/agreement` : null;
    const details = [
      t("copyVehicle", { vehicle: ctx.vehicle }),
      t("copyDates", { dates: rentalDates(ctx) }),
      handover ? t("copyHandover", { details: handover }) : "",
      Number(rental.rental_rate || 0) > 0 ? t("copyPrice", { price: t(`copyRate_${model}`, { amount: money(rental.rental_rate) }) }) : "",
      Number(rental.deposit_amount || 0) > 0 ? t("copyDeposit", { amount: money(rental.deposit_amount) }) : "",
      payments.length ? t("copyPaymentsDue", { list: payments.join("; ") }) : "",
      contactLine(ctx)
    ].filter(Boolean);
    const intro = `${ctx.hi} ${t("copySignedIntro", { vehicle: ctx.vehicle })}`;
    const business = String(ctx.organization.name || "");
    const pageLine = ctx.bookingPage ? t("yourBooking", { link: ctx.bookingPage }) : "";
    const emailText = [intro, details.join("\n"), t("copyAgreementAttached"), pageLine, business].filter(Boolean).join("\n\n");
    const chatText = [intro, details.join("\n"), agreementLink ? t("copyAgreementLink", { link: agreementLink }) : ""].filter(Boolean).join("\n\n");

    return await deliver(admin, ctx, {
      key: `copy-agreement:${input.versionId}`,
      subject: t("copySubjectAgreement", { business: business || "RoveHQ" }),
      emailText,
      chatText,
      files: [input.agreement, ...(input.certificate ? [input.certificate] : [])],
      documentId: input.documentId,
      versionId: input.versionId,
      label: "Rental agreement"
    });
  } catch (error) {
    console.error("[copies] signed agreement copy failed", error);
    return { status: "failed" as const };
  }
}

export type ReportDamageLine = { where: string; what: string; severity: string };

/** A signed handover or return report: what was recorded, the walkaround video and the PDF. */
export async function sendReportCopy(
  admin: any,
  input: {
    rentalId: string;
    inspectionId: string;
    documentId: string;
    versionId: string;
    mode: "delivery" | "return";
    label: string;
    inspectedAt: string;
    odometer: number;
    distanceUnit: string;
    fuel: string;
    damage: ReportDamageLine[];
    notes: string | null;
    photoCount: number;
    pdf: StoredFile;
  }
) {
  try {
    const ctx = await loadContext(admin, input.rentalId);
    if (!ctx) return { status: "no_customer" as const };
    const { rental, wording, timeZone } = ctx;
    const t = wording.t;
    const { data: inspection } = await admin.from("inspections").select("video_url").eq("id", input.inspectionId).maybeSingle();
    const place = String(input.mode === "delivery" ? ctx.bookingData.delivery_location || rental.delivery_location || "" : rental.return_location || "").trim();
    const reportPage = ctx.token && appBase() ? `${appBase()}/book/${ctx.token}/report/${input.inspectionId}` : null;
    const videoLink = inspection?.video_url && reportPage ? `${reportPage}/video` : null;
    const damage = input.damage.length
      ? t("copyReportDamage", { list: input.damage.map((item) => [item.where, item.severity, item.what].filter(Boolean).join(" · ")).join("; ") })
      : t("copyReportNoDamage");
    const details = [
      t("copyReportWhen", { details: [customerDateTime(input.inspectedAt, wording.locale, timeZone), place].filter(Boolean).join(", ") }),
      t("copyReportOdometer", { value: `${Number(input.odometer || 0).toLocaleString("en-US")} ${input.distanceUnit}` }),
      t("copyReportFuel", { value: input.fuel }),
      damage,
      input.notes ? t("copyReportNotes", { notes: input.notes }) : "",
      input.photoCount > 0 ? t("copyReportPhotos", { count: input.photoCount }) : "",
      videoLink ? t("copyReportVideo", { link: videoLink }) : ""
    ].filter(Boolean);
    const intro = `${ctx.hi} ${t(input.mode === "return" ? "copyReportReturn" : "copyReportHandover", { vehicle: ctx.vehicle })}`;
    const business = String(ctx.organization.name || "");
    const emailText = [intro, details.join("\n"), reportPage ? t("copyReportAttached", { link: reportPage }) : t("copyReportAttachedOnly"), business].filter(Boolean).join("\n\n");
    const chatText = [intro, details.join("\n"), reportPage ? t("copyReportLink", { link: reportPage }) : ""].filter(Boolean).join("\n\n");

    return await deliver(admin, ctx, {
      key: `copy-report:${input.inspectionId}`,
      subject: t(input.mode === "return" ? "copySubjectReturn" : "copySubjectHandover", { business: business || "RoveHQ" }),
      emailText,
      chatText,
      files: [input.pdf],
      documentId: input.documentId,
      versionId: input.versionId,
      label: input.label
    });
  } catch (error) {
    console.error("[copies] report copy failed", error);
    return { status: "failed" as const };
  }
}
