/**
 * Partner network (reworked to Rory's spec, 7 Nov 2026).
 *
 * A business that shares its fleet ("Share my fleet with the partner network") can search the free vehicles of other
 * sharing businesses and copy a booking link for a customer: the vehicle's own booking page, tagged with the referring
 * business (?ref=<referrer id>). Only businesses that share can search, so it stays fair.
 *
 * When the customer books through that link, the booking records the referral, and the referring business earns 10% of
 * EACH rental payment on it, paid by the vehicle's operator. RoveHQ takes no cut: the whole 10% goes to the referrer.
 * For now the two businesses settle between themselves and mark it settled here; see the STRIPE CONNECT notes below for
 * where automatic settlement plugs in once online payments go live.
 */
import { clashes } from "@/lib/booking-holds";
import { businessToday, setBusinessTimeZone } from "@/lib/business-time";
import { FINDERS_FEE_PCT } from "@/lib/plans";
import { seasonalRate } from "@/lib/price-rules";
import { getPublicCatalog } from "@/lib/public-catalog";
import { daysBetween, planFor } from "@/lib/rental-estimate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { ratesFrom } from "@/lib/visitor-currency";
import type { CommissionRow, PartnerVehicle, ReferralRow } from "@/lib/partner-pricing";

export type { CommissionRow, PartnerVehicle, ReferralRow };

/** The referrer's share of each rental payment. All of it goes to the referrer (RoveHQ takes nothing). */
export const PARTNER_COMMISSION_PCT = FINDERS_FEE_PCT;

export type Reach = "town" | "region" | "country";
export type PartnerNetworkSettings = { enabled: boolean; reach: Reach; blocked: string[] };

/** organizations.settings.partner_network. `enabled` means "shares its fleet" (and so may search). */
export function partnerNetworkSettings(settings: unknown): PartnerNetworkSettings {
  const raw = (settings && typeof settings === "object" ? (settings as Record<string, any>).partner_network : null) || {};
  const reach = ["town", "region", "country"].includes(raw.reach) ? (raw.reach as Reach) : "region";
  return { enabled: raw.enabled === true, reach, blocked: Array.isArray(raw.blocked) ? raw.blocked.map(String) : [] };
}

export type Place = { town: string; region: string; country: string };

/** Where a business is, from what it gave at setup (settings.main_location). */
export function placeOf(settings: unknown): Place {
  const raw = (settings && typeof settings === "object" ? (settings as Record<string, any>).main_location : null) || {};
  return { town: String(raw.town || raw.label || "").trim(), region: String(raw.region || "").trim(), country: String(raw.country || "").trim() };
}

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
const round2 = (value: number) => Math.round(value * 100) / 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type PartnerSearch = {
  organizationId: string;
  startDate: string;
  endDate: string | null;
  kind: string | null;
  /** A town, or a whole province/region; empty for anywhere in the searcher's country. */
  town: string | null;
  region: string | null;
};

/**
 * Other sharing businesses' vehicles that are free for these dates, priced for them. Availability and price come from
 * the same code as each operator's public booking page (getPublicCatalog: holds released, booked and held dates, gap
 * days, lead time, high seasons, VAT), so what is shown here is exactly what the customer can book through the link.
 */
export async function findPartnerVehicles(admin: any, input: PartnerSearch): Promise<{ vehicles: PartnerVehicle[]; currency: string }> {
  const { data: mine } = await admin.from("organizations").select("id, settings, currency, timezone").eq("id", input.organizationId).maybeSingle();
  const myCurrency = String(mine?.currency || "THB");
  const mySettings = partnerNetworkSettings(mine?.settings);
  // Only businesses that share can search.
  if (!mySettings.enabled) return { vehicles: [], currency: myCurrency };
  const myPlace = placeOf(mine?.settings);

  const { data: candidates } = await admin
    .from("organizations")
    .select("id, name, trading_name, slug, settings, currency")
    .neq("id", input.organizationId)
    .is("deleted_at", null)
    .eq("settings->partner_network->>enabled", "true");
  const partners = ((candidates || []) as any[]).filter((candidate) => {
    const theirs = partnerNetworkSettings(candidate.settings);
    if (!theirs.enabled || !candidate.slug) return false;
    if (theirs.blocked.includes(input.organizationId) || mySettings.blocked.includes(candidate.id)) return false;
    const place = placeOf(candidate.settings);
    // The searcher's own country only; then the town or region asked for.
    if (myPlace.country && place.country && !same(myPlace.country, place.country)) return false;
    if (input.town) return same(place.town, input.town);
    if (input.region) return same(place.region, input.region);
    return true;
  });

  const found: Array<Omit<PartnerVehicle, "perDayMine" | "totalMine">> = [];
  const days = input.endDate ? daysBetween(input.startDate, input.endDate) : null;
  // One business at a time: getPublicCatalog sets the business clock for the request.
  for (const partner of partners) {
    const catalog = await getPublicCatalog(String(partner.slug)).catch(() => null);
    if (!catalog || !catalog.enabled) continue;
    if (input.startDate < catalog.minStart) continue;
    const place = placeOf(partner.settings);
    for (const vehicle of catalog.vehicles) {
      if (input.kind && input.kind !== "any" && vehicle.kind !== input.kind) continue;
      if (vehicle.busy.some((period) => clashes(input.startDate, input.endDate, period, catalog.gapDays))) continue;
      const base = planFor(vehicle, days);
      if (!base) continue;
      const rate = seasonalRate(base.rate, base.pricingModel, catalog.seasons, input.startDate, input.endDate).rate;
      const total =
        days === null
          ? rate
          : base.pricingModel === "daily"
            ? rate * days
            : base.pricingModel === "weekly"
              ? (days > 7 ? Math.round((rate * days) / 7) : rate)
              : (days > 30 ? Math.round((rate * days) / 30) : rate);
      const query = new URLSearchParams({ vehicle: vehicle.id, from: input.startDate, ...(input.endDate ? { to: input.endDate } : {}), ref: input.organizationId });
      found.push({
        vehicleId: vehicle.id,
        organizationId: catalog.organizationId,
        business: String(partner.trading_name || partner.name || catalog.name),
        town: place.town,
        region: place.region,
        photoUrl: vehicle.photoUrl,
        name: vehicle.name,
        year: vehicle.year,
        kind: vehicle.kind,
        currency: catalog.currency,
        pricingModel: base.pricingModel,
        rate,
        days,
        total,
        perDay: round2(days ? total / days : total / 30),
        bookingUrl: `${catalog.canonicalUrl}?${query.toString()}`
      });
    }
  }
  // Back to the searcher's own clock.
  setBusinessTimeZone(mine?.timezone);

  // In the searcher's currency too, when a partner charges in another one (a guide: the operator charges in its own).
  const currencies = [...new Set(found.map((item) => item.currency).filter((code) => code !== myCurrency))];
  const rateTo = new Map<string, number | null>();
  await Promise.all(
    currencies.map(async (code) => {
      const rates = await ratesFrom(code);
      rateTo.set(code, Number(rates[myCurrency]) > 0 ? Number(rates[myCurrency]) : null);
    })
  );
  const vehicles: PartnerVehicle[] = found.map((item) => {
    const factor = item.currency === myCurrency ? 1 : rateTo.get(item.currency) ?? null;
    return { ...item, perDayMine: factor ? round2(item.perDay * factor) : null, totalMine: factor ? round2(item.total * factor) : null };
  });
  vehicles.sort((a, b) => (a.perDayMine ?? a.perDay) - (b.perDayMine ?? b.perDay) || a.business.localeCompare(b.business));
  return { vehicles, currency: myCurrency };
}

/**
 * The referring business from a booking link's ?ref=, when the referral counts: a real, different business, both of
 * them sharing their fleets, neither blocking the other. Null otherwise (the booking then goes ahead as a normal one).
 */
export async function partnerReferrer(admin: any, ref: unknown, organizationId: string): Promise<{ id: string; name: string } | null> {
  const id = String(ref || "").trim();
  if (!UUID.test(id) || id === organizationId) return null;
  const { data: rows } = await admin.from("organizations").select("id, name, trading_name, settings, deleted_at").in("id", [id, organizationId]);
  const referrer = ((rows || []) as any[]).find((row) => row.id === id);
  const operator = ((rows || []) as any[]).find((row) => row.id === organizationId);
  if (!referrer || !operator || referrer.deleted_at) return null;
  const theirs = partnerNetworkSettings(referrer.settings);
  const ours = partnerNetworkSettings(operator.settings);
  if (!theirs.enabled || !ours.enabled || theirs.blocked.includes(organizationId) || ours.blocked.includes(id)) return null;
  return { id, name: String(referrer.trading_name || referrer.name || "") };
}

/**
 * A customer booked through a partner's link: the referral goes on the booking, and the operator hears about it
 * (a job on their list and an alert). Never throws: a missed referral must not undo the customer's booking.
 */
export async function recordLinkReferral(
  admin: any,
  input: {
    referrer: { id: string; name: string };
    organizationId: string;
    rentalId: string;
    bookingLinkId: string;
    vehicleId: string;
    vehicleName: string;
    customerName: string;
    customerPhone: string;
    startDate: string;
    endDate: string | null;
    currency: string;
  }
) {
  try {
    const { error } = await admin.from("referrals").insert({
      from_organization_id: input.referrer.id,
      to_organization_id: input.organizationId,
      vehicle_id: input.vehicleId,
      rental_id: input.rentalId,
      booking_link_id: input.bookingLinkId,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      start_date: input.startDate,
      end_date: input.endDate,
      status: "booked",
      channel: "link",
      fee_pct: PARTNER_COMMISSION_PCT,
      currency: input.currency
    });
    if (error) return;
    await admin.from("tasks").insert({
      organization_id: input.organizationId,
      vehicle_id: input.vehicleId,
      rental_id: input.rentalId,
      title: `Partner referral from ${input.referrer.name || "a partner"}: ${input.customerName || "a customer"} booked the ${input.vehicleName}. ${PARTNER_COMMISSION_PCT}% of each rental payment goes to ${input.referrer.name || "them"}.`,
      task_type: "other",
      due_at: input.startDate,
      created_by: null
    });
    const { notifyOperator } = await import("@/lib/notify-operator");
    await notifyOperator(
      input.organizationId,
      { emoji: "🤝", key: "referral", values: { partner: input.referrer.name || null, customer: input.customerName || null, vehicle: input.vehicleName || null }, dates: { start: input.startDate } },
      "operator_notification"
    );
  } catch {
    // The booking stands; the referral row (if written) is what counts.
  }
}

/** Totals on the referral, from its commission rows: everything earned, what is settled, and when it was all settled. */
async function refreshReferralTotals(admin: any, referralId: string) {
  const { data: rows } = await admin.from("referral_commissions").select("fee_amount, settled_at").eq("referral_id", referralId);
  const list = (rows || []) as Array<{ fee_amount: number; settled_at: string | null }>;
  const total = round2(list.reduce((sum, row) => sum + Number(row.fee_amount || 0), 0));
  const settled = round2(list.filter((row) => row.settled_at).reduce((sum, row) => sum + Number(row.fee_amount || 0), 0));
  await admin
    .from("referrals")
    .update({
      fee_amount: list.length ? total : null,
      fee_settled_amount: settled,
      fee_paid_at: total > 0 && settled >= total ? new Date().toISOString() : null,
      ...(list.length ? { status: "rented" } : {})
    })
    .eq("id", referralId);
}

/**
 * Called whenever a payment is recorded on a booking: if the booking came through a partner referral, 10% of that
 * rental payment is owed to the referrer. Deposits, damage charges and extras on their own don't count.
 */
export async function noteReferralFee(_supabase: unknown, rentalId: string, amount: number, paymentMetadata: any, paymentId?: string | null, currency?: string | null) {
  const type = String(paymentMetadata?.type || "rent");
  if (paymentMetadata?.is_deposit === true || ["deposit", "deposit_top_up", "charge", "extras"].includes(type)) return;
  if (!(amount > 0)) return;
  // The payer's own login can only read referrals: the commission is written with the service role.
  const admin = createSupabaseAdminClient() as any;
  const { data: referral } = await admin
    .from("referrals")
    .select("id, from_organization_id, to_organization_id, fee_pct, currency")
    .eq("rental_id", rentalId)
    .neq("status", "cancelled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!referral) return;
  const pct = Number(referral.fee_pct || PARTNER_COMMISSION_PCT);
  const fee = round2((amount * pct) / 100);
  if (!(fee > 0)) return;
  const { error } = await admin.from("referral_commissions").insert({
    referral_id: referral.id,
    from_organization_id: referral.from_organization_id,
    to_organization_id: referral.to_organization_id,
    rental_id: rentalId,
    rental_payment_id: paymentId || null,
    payment_amount: round2(amount),
    fee_pct: pct,
    fee_amount: fee,
    currency: String(currency || referral.currency || "THB")
  });
  // 23505: this payment already earned its commission (recorded twice).
  if (error) return;
  await refreshReferralTotals(admin, referral.id);
  // STRIPE CONNECT (later, when online payments go live): when this payment was taken through Stripe, move `fee` to the
  // referrer's connected account here (a transfer from the operator's account, or an application-fee split at charge
  // time), then mark the commission row settled with settlement_method = 'stripe_connect' and stripe_transfer_id set.
  // RoveHQ keeps nothing: the whole fee goes to the referrer. Until then both sides settle by hand ("Mark settled").
}

/** A payment was deleted: its commission goes too, unless it was already settled. */
export async function dropReferralFee(paymentId: string) {
  if (!paymentId) return;
  const admin = createSupabaseAdminClient() as any;
  const { data: row } = await admin.from("referral_commissions").select("id, referral_id, settled_at").eq("rental_payment_id", paymentId).maybeSingle();
  if (!row || row.settled_at) return;
  await admin.from("referral_commissions").delete().eq("id", row.id);
  await refreshReferralTotals(admin, row.referral_id);
}

/** Both sides' referred bookings, with each payment's commission. */
export async function listReferrals(supabase: any, organizationId: string): Promise<ReferralRow[]> {
  const { data } = await supabase
    .from("referrals")
    .select(
      "id, from_organization_id, to_organization_id, customer_name, start_date, end_date, rental_id, status, channel, fee_pct, currency, created_at, vehicles(make, model, registration_number), rentals(status, currency), from_org:organizations!referrals_from_organization_id_fkey(name, trading_name), to_org:organizations!referrals_to_organization_id_fkey(name, trading_name, currency)"
    )
    .or(`from_organization_id.eq.${organizationId},to_organization_id.eq.${organizationId}`)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data || []) as any[];
  const ids = rows.map((row) => row.id);
  const { data: commissionRows } = ids.length
    ? await supabase.from("referral_commissions").select("id, referral_id, payment_amount, fee_amount, currency, created_at, settled_at").in("referral_id", ids).order("created_at", { ascending: true })
    : { data: [] };
  const byReferral = new Map<string, CommissionRow[]>();
  for (const row of (commissionRows || []) as any[]) {
    const list = byReferral.get(row.referral_id) || [];
    list.push({ id: row.id, paymentAmount: Number(row.payment_amount || 0), feeAmount: Number(row.fee_amount || 0), createdAt: row.created_at, settledAt: row.settled_at });
    byReferral.set(row.referral_id, list);
  }
  return rows.map((row) => {
    const sent = row.from_organization_id === organizationId;
    const other = sent ? row.to_org : row.from_org;
    const commissions = byReferral.get(row.id) || [];
    const feeTotal = round2(commissions.reduce((sum, item) => sum + item.feeAmount, 0));
    const feeSettled = round2(commissions.filter((item) => item.settledAt).reduce((sum, item) => sum + item.feeAmount, 0));
    return {
      id: row.id,
      direction: sent ? "sent" : "received",
      partner: String(other?.trading_name || other?.name || ""),
      customerName: row.customer_name || "",
      vehicle: [row.vehicles?.make, row.vehicles?.model, sent ? null : row.vehicles?.registration_number].filter(Boolean).join(" "),
      startDate: row.start_date,
      endDate: row.end_date,
      rentalId: row.rental_id,
      rentalStatus: row.rentals?.status || null,
      status: row.status,
      channel: row.channel || "manual",
      feePct: Number(row.fee_pct || PARTNER_COMMISSION_PCT),
      currency: String(row.currency || row.rentals?.currency || row.to_org?.currency || "THB"),
      feeTotal,
      feeSettled,
      feeOpen: round2(feeTotal - feeSettled),
      commissions,
      createdAt: row.created_at
    };
  });
}

/**
 * The commission still open on a referred booking has been paid between the two businesses: either side can mark it
 * settled. Both businesses get the money record. (Later, with Stripe Connect, this happens on its own: see noteReferralFee.)
 */
export async function settleReferral(admin: any, input: { referralId: string; organizationId: string; userId: string; method: string }) {
  const { data: referral } = await admin
    .from("referrals")
    .select("id, from_organization_id, to_organization_id, vehicle_id, rental_id, customer_name, currency, from_org:organizations!referrals_from_organization_id_fkey(name, trading_name, currency), to_org:organizations!referrals_to_organization_id_fkey(name, trading_name, currency)")
    .eq("id", input.referralId)
    .maybeSingle();
  if (!referral || (referral.to_organization_id !== input.organizationId && referral.from_organization_id !== input.organizationId)) throw new Error("This referral isn't one of yours.");
  const { data: open } = await admin.from("referral_commissions").select("id, fee_amount, currency").eq("referral_id", referral.id).is("settled_at", null);
  const openRows = (open || []) as Array<{ id: string; fee_amount: number; currency: string }>;
  const amount = round2(openRows.reduce((sum, row) => sum + Number(row.fee_amount || 0), 0));
  if (!(amount > 0)) throw new Error("Nothing to settle on this booking yet.");
  const currency = String(openRows[0]?.currency || referral.currency || referral.to_org?.currency || "THB");
  const now = new Date().toISOString();
  const today = businessToday();
  const referrerName = String(referral.from_org?.trading_name || referral.from_org?.name || "partner");
  const operatorName = String(referral.to_org?.trading_name || referral.to_org?.name || "partner");
  const meta = { source: "partner_network", referral_id: referral.id, payment_method: input.method };
  const byMe = (organizationId: string) => (organizationId === input.organizationId ? input.userId : null);

  const { error: settleError } = await admin
    .from("referral_commissions")
    .update({ settled_at: now, settled_by: input.userId, settlement_method: "manual" })
    .in("id", openRows.map((row) => row.id));
  if (settleError) throw new Error(settleError.message);
  const written = await Promise.all([
    admin.from("transactions").insert({
      organization_id: referral.to_organization_id,
      vehicle_id: referral.vehicle_id,
      rental_id: referral.rental_id,
      type: "finders_fee",
      amount,
      currency,
      transaction_date: today,
      notes: `Partner commission to ${referrerName} for ${referral.customer_name || "a referred customer"}`,
      metadata: meta,
      created_by: byMe(referral.to_organization_id)
    }),
    admin.from("transactions").insert({
      organization_id: referral.from_organization_id,
      vehicle_id: null,
      rental_id: null,
      type: "finders_fee_income",
      amount,
      currency,
      transaction_date: today,
      notes: `Partner commission from ${operatorName} for ${referral.customer_name || "a referred customer"}`,
      metadata: meta,
      created_by: byMe(referral.from_organization_id)
    })
  ]);
  await refreshReferralTotals(admin, referral.id);
  const failed = written.find((result: any) => result?.error);
  if (failed) throw new Error(failed.error.message);
}
