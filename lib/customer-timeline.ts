/**
 * A customer's life with the business, oldest to newest: first contact, each booking, money in and out, deposits,
 * agreements, documents, extensions, damage and partner referrals. Built only from records the app already keeps
 * (rentals, transactions, booking links, rental documents, inspections, extensions, conversations, activity),
 * in one round of parallel queries for the customer, never one per booking.
 */
import { toWallTime } from "@/lib/business-time";

export type TimelineKind = "contact" | "booking" | "money" | "paper" | "damage" | "change";

export type CustomerTimelineEvent = {
  id: string;
  /** ISO timestamp or YYYY-MM-DD. */
  date: string;
  kind: TimelineKind;
  /** Wording key under customerPage.tl_<key>. */
  key: string;
  values?: Record<string, string | number>;
  /** Money, in the business currency, shown on the right. Negative is money out. */
  amount?: number | null;
  /** The booking it belongs to, for a link. */
  rentalId?: string | null;
  /** An activity's own title, already in the reader's language (used when key is "activity"). */
  title?: string;
};

export type CustomerMessageCounts = { fromThem: number; toThem: number; firstAt: string | null; channel: string | null };

type Supabase = any;

function vehicleOf(rental: any) {
  return [rental?.vehicles?.make, rental?.vehicles?.model].filter(Boolean).join(" ") || rental?.vehicles?.registration_number || "";
}

const DEPOSIT_IN = new Set(["deposit", "deposit_received"]);

/** Activity worth a line of its own that no other record already covers. */
const ACTIVITY_TYPES = new Set(["vehicle_changed", "rental_early_return", "customer_portal_extension_request", "customer_portal_problem_report", "customer_reported", "extension_request_approved"]);

export async function getCustomerTimeline(
  supabase: Supabase,
  organizationId: string,
  customer: any,
  rentals: any[],
  transactions: any[],
  documents: Array<{ id: string; category: string; createdAt: string }>
): Promise<{ events: CustomerTimelineEvent[]; messages: CustomerMessageCounts; activities: any[] }> {
  const rentalIds = rentals.map((rental) => rental.id).filter(Boolean);
  const none = { data: [] as any[], error: null, count: 0 };
  const byRental = (query: () => any): Promise<any> => (rentalIds.length ? Promise.resolve(query()) : Promise.resolve(none));

  const [linksResult, extensionsResult, papersResult, inspectionsResult, conversationsResult, requestsResult, activityResult, lineResult] = await Promise.all([
    byRental(() => supabase.from("booking_links").select("rental_id, share_channels, booking_data, created_at").eq("organization_id", organizationId).in("rental_id", rentalIds).is("deleted_at", null)),
    byRental(() => supabase.from("rental_extensions").select("id, rental_id, new_end_date, created_at").eq("organization_id", organizationId).in("rental_id", rentalIds)),
    byRental(() =>
      supabase
        .from("rental_documents")
        .select("id, rental_id, document_type, finalised_at")
        .eq("organization_id", organizationId)
        .in("rental_id", rentalIds)
        .in("document_type", ["rental_agreement", "agreement_amendment", "extension_amendment"])
        .not("finalised_at", "is", null)
    ),
    byRental(() => supabase.from("inspections").select("id, rental_id, type, damage_items, submitted_at, created_at").eq("organization_id", organizationId).in("rental_id", rentalIds).in("type", ["delivery", "return"]).is("deleted_at", null)),
    supabase.from("conversations").select("id, provider, created_at").eq("organization_id", organizationId).eq("customer_id", customer.id).order("created_at", { ascending: true }),
    supabase.from("booking_requests").select("id, created_at, vehicles(make, model, registration_number)").eq("organization_id", organizationId).eq("customer_id", customer.id),
    supabase
      .from("activity_events")
      .select("id, event_type, title, detail, occurred_at, created_at, rental_id")
      .eq("organization_id", organizationId)
      .or(rentalIds.length ? `customer_id.eq.${customer.id},rental_id.in.(${rentalIds.join(",")})` : `customer_id.eq.${customer.id}`)
      .in("event_type", Array.from(ACTIVITY_TYPES))
      .order("occurred_at", { ascending: false })
      .limit(100),
    supabase.from("line_messages").select("id", { count: "exact", head: true }).eq("organisation_id", organizationId).eq("customer_id", customer.id)
  ]);

  const conversations = (conversationsResult.data || []) as any[];
  const conversationIds = conversations.map((row) => row.id);
  const [inCount, outCount] = conversationIds.length
    ? await Promise.all(
        ["in", "out"].map((direction) =>
          supabase.from("conversation_messages").select("id", { count: "exact", head: true }).eq("organization_id", organizationId).in("conversation_id", conversationIds).eq("direction", direction)
        )
      )
    : [none, none];
  const messages: CustomerMessageCounts = {
    fromThem: Number(inCount.count || 0),
    toThem: Number(outCount.count || 0) + Number(lineResult.count || 0),
    firstAt: conversations[0]?.created_at || null,
    channel: conversations[0]?.provider || null
  };

  const events: CustomerTimelineEvent[] = [];
  events.push({ id: "added", date: customer.created_at, kind: "contact", key: "added" });
  if (conversations[0]) events.push({ id: `conv-${conversations[0].id}`, date: conversations[0].created_at, kind: "contact", key: "firstMessage", values: { channel: String(conversations[0].provider || "") } });
  for (const request of (requestsResult.data || []) as any[]) {
    events.push({ id: `req-${request.id}`, date: request.created_at, kind: "contact", key: vehicleOf(request) ? "asked" : "askedAny", values: { vehicle: vehicleOf(request) } });
  }

  // Where each booking came from: its link's channel, or a partner's referral.
  const linkFor = new Map<string, any>();
  for (const link of (linksResult.data || []) as any[]) {
    if (!linkFor.has(link.rental_id) || String(link.created_at) < String(linkFor.get(link.rental_id).created_at)) linkFor.set(link.rental_id, link);
  }
  const pickups = new Map<string, string>();
  const returns = new Map<string, string>();
  for (const inspection of (inspectionsResult.data || []) as any[]) {
    const when = inspection.submitted_at || inspection.created_at;
    if (inspection.type === "delivery" && (!pickups.has(inspection.rental_id) || when < pickups.get(inspection.rental_id)!)) pickups.set(inspection.rental_id, when);
    if (inspection.type === "return") {
      if (!returns.has(inspection.rental_id) || when > returns.get(inspection.rental_id)!) returns.set(inspection.rental_id, when);
      const items = Array.isArray(inspection.damage_items) ? inspection.damage_items : [];
      const fresh = items.filter((item: any) => item?.is_pre_existing !== true).length;
      if (fresh > 0) events.push({ id: `dmg-${inspection.id}`, date: when, kind: "damage", key: "damage", values: { count: fresh }, rentalId: inspection.rental_id });
    }
  }

  for (const rental of rentals) {
    if (rental.status === "draft") continue;
    const vehicle = vehicleOf(rental) || "—";
    const link = linkFor.get(rental.id);
    const channel = String((Array.isArray(link?.share_channels) ? link.share_channels[0] : "") || "");
    const partner = link?.booking_data?.referral?.from ? String(link.booking_data.referral.from) : "";
    const key = partner ? "bookedPartner" : channel === "partner" ? "bookedPartnerAny" : channel === "directory" ? "bookedRoveRent" : channel === "public_page" || channel === "website" ? "bookedPage" : "booked";
    events.push({
      id: `bk-${rental.id}`,
      date: rental.created_at || rental.start_date,
      kind: "booking",
      key,
      values: { vehicle, partner: partner || "—", from: String(rental.start_date || "").slice(0, 10), to: String(rental.end_date || "").slice(0, 10) },
      rentalId: rental.id
    });
    if (["active", "due_soon", "overdue", "extended", "completed"].includes(String(rental.status))) {
      events.push({ id: `out-${rental.id}`, date: pickups.get(rental.id) || rental.start_date, kind: "booking", key: "pickedUp", values: { vehicle }, rentalId: rental.id });
    }
    if (rental.status === "completed") {
      events.push({ id: `back-${rental.id}`, date: returns.get(rental.id) || rental.end_date || rental.updated_at, kind: "booking", key: "returned", values: { vehicle }, rentalId: rental.id });
    }
    if (rental.status === "cancelled" && rental.cancelled_at) {
      events.push({ id: `cx-${rental.id}`, date: rental.cancelled_at, kind: "booking", key: "cancelled", values: { vehicle }, rentalId: rental.id });
    }
  }

  for (const extension of (extensionsResult.data || []) as any[]) {
    events.push({ id: `ext-${extension.id}`, date: extension.created_at, kind: "change", key: "extended", values: { date: String(extension.new_end_date || "").slice(0, 10) }, rentalId: extension.rental_id });
  }
  for (const paper of (papersResult.data || []) as any[]) {
    events.push({ id: `doc-${paper.id}`, date: paper.finalised_at, kind: "paper", key: paper.document_type === "rental_agreement" ? "signedAgreement" : "signedChange", rentalId: paper.rental_id });
  }
  for (const file of documents) {
    const value = String(file.category || "").toLowerCase();
    const kind = value.includes("passport") ? "passport" : value.includes("licen") ? "licence" : value.includes("selfie") || value.includes("photo") ? "photo" : "other";
    events.push({ id: `file-${file.id}`, date: file.createdAt, kind: "paper", key: `uploaded_${kind}` });
  }

  for (const transaction of transactions) {
    if (transaction.voided) continue;
    const type = String(transaction.type || "");
    const amount = Math.abs(Number(transaction.amount || 0));
    if (!amount) continue;
    const base = { id: `tx-${transaction.id}`, date: transaction.transaction_date || transaction.created_at, kind: "money" as const, rentalId: transaction.rental_id || null };
    if (DEPOSIT_IN.has(type) || (transaction.is_deposit && type !== "deposit_refunded")) events.push({ ...base, key: "depositTaken", amount: null, values: { amount } });
    else if (type === "deposit_refunded") events.push({ ...base, key: "depositReturned", amount: null, values: { amount } });
    else if (type === "deposit_forfeited" || type === "deposit_deduction") events.push({ ...base, key: "depositKept", amount });
    else if (type === "rental_income") events.push({ ...base, key: "paid", amount });
    else if (type === "charge_recovered") events.push({ ...base, key: "paidCharge", amount });
    else if (type === "refund") events.push({ ...base, key: "refunded", amount: -amount });
  }

  const activities = (activityResult.data || []) as any[];
  return { events, messages, activities };
}

/** The day an event happened, in the business's time zone. */
export function eventDay(date: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : toWallTime(date).slice(0, 10);
}
