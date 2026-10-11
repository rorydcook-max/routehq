import { longDate } from "@/lib/i18n/dates";
﻿/**
 * Partner network. An operator with nothing free sends the customer to a
 * partner's vehicle: the customer becomes the partner's from then on, and the
 * partner owes the referrer a one-time finder's fee, a share of the first rent
 * payment, settled between them directly and marked paid here.
 */
import { businessToday } from "@/lib/business-time";
import { holdDeadline } from "@/lib/booking-holds";
import { bookingRules } from "@/lib/booking-rules";
import { FINDERS_FEE_PCT } from "@/lib/plans";
import { publicBookingSettings } from "@/lib/public-catalog";
import { priceFor, type PartnerVehicle, type ReferralRow } from "@/lib/partner-pricing";

export { priceFor };
export type { PartnerVehicle, ReferralRow };

export type Reach = "town" | "region" | "country";
export type PartnerNetworkSettings = { enabled: boolean; reach: Reach; blocked: string[] };

export function partnerNetworkSettings(settings: unknown): PartnerNetworkSettings {
  const raw = (settings && typeof settings === "object" ? (settings as Record<string, any>).partner_network : null) || {};
  const reach = ["town", "region", "country"].includes(raw.reach) ? (raw.reach as Reach) : "region";
  return { enabled: raw.enabled === true, reach, blocked: Array.isArray(raw.blocked) ? raw.blocked.map(String) : [] };
}

type Place = { town: string; region: string; country: string };

function placeOf(settings: unknown): Place {
  const raw = (settings && typeof settings === "object" ? (settings as Record<string, any>).main_location : null) || {};
  return { town: String(raw.town || "").trim().toLowerCase(), region: String(raw.region || "").trim().toLowerCase(), country: String(raw.country || "").trim().toLowerCase() };
}

/** Whether "other" is within "mine"'s reach, by the places the businesses gave at setup. */
function withinReach(reach: Reach, mine: Place, other: Place) {
  if (reach === "country") return !mine.country || mine.country === other.country;
  if (reach === "region") return !!mine.region && mine.region === other.region;
  return !!mine.town && mine.town === other.town;
}


const BUSY = ["booked", "active", "due_soon", "overdue", "extended"];

/** Partners' vehicles free for these dates, in the agreed reach, neither side blocking the other. */
export async function findPartnerVehicles(
  admin: any,
  input: { organizationId: string; startDate: string; endDate: string | null; kind: string | null }
): Promise<PartnerVehicle[]> {
  const { data: mine } = await admin.from("organizations").select("id, settings").eq("id", input.organizationId).maybeSingle();
  const mySettings = partnerNetworkSettings(mine?.settings);
  if (!mySettings.enabled) return [];
  const myPlace = placeOf(mine?.settings);

  const { data: candidates } = await admin
    .from("organizations")
    .select("id, name, trading_name, settings, business_phone, currency")
    .neq("id", input.organizationId)
    .is("deleted_at", null)
    .eq("settings->partner_network->>enabled", "true");
  const partners = ((candidates || []) as any[]).filter((candidate) => {
    const theirs = partnerNetworkSettings(candidate.settings);
    if (!theirs.enabled || theirs.blocked.includes(input.organizationId) || mySettings.blocked.includes(candidate.id)) return false;
    const theirPlace = placeOf(candidate.settings);
    return withinReach(mySettings.reach, myPlace, theirPlace) && withinReach(theirs.reach, theirPlace, myPlace);
  });
  if (!partners.length) return [];
  const partnerById = new Map(partners.map((partner) => [partner.id, partner]));

  const { data: vehicles } = await admin
    .from("vehicles")
    .select("id, organization_id, make, model, year, registration_number, status, daily_rate, weekly_rate, monthly_rate, deposit_amount, vehicle_categories(code)")
    .in("organization_id", partners.map((partner) => partner.id))
    .is("deleted_at", null)
    .not("status", "in", "(maintenance,inactive,retired)");
  const priced = ((vehicles || []) as any[]).filter((vehicle) => Number(vehicle.daily_rate) > 0 || Number(vehicle.weekly_rate) > 0 || Number(vehicle.monthly_rate) > 0);
  const wanted = input.kind && input.kind !== "any" ? priced.filter((vehicle) => String(vehicle.vehicle_categories?.code || "") === input.kind) : priced;
  if (!wanted.length) return [];

  // Taken for any part of the dates asked for (an open-ended request is treated as a month).
  const end = input.endDate || businessToday(30 + Math.max(0, Math.round((new Date(`${input.startDate}T00:00:00Z`).getTime() - new Date(`${businessToday()}T00:00:00Z`).getTime()) / 86_400_000)));
  const { data: busy } = await admin
    .from("rentals")
    .select("vehicle_id, start_date, end_date, status")
    .in("vehicle_id", wanted.map((vehicle) => vehicle.id))
    .in("status", BUSY)
    .is("deleted_at", null)
    .lte("start_date", end)
    .or(`end_date.is.null,end_date.gte.${input.startDate}`);
  const taken = new Set(((busy || []) as any[]).map((rental) => rental.vehicle_id));

  return wanted
    .filter((vehicle) => !taken.has(vehicle.id))
    .map((vehicle) => {
      const partner = partnerById.get(vehicle.organization_id);
      const usualDeposit = publicBookingSettings(partner?.settings).deposit;
      return {
        vehicleId: vehicle.id,
        organizationId: vehicle.organization_id,
        business: String(partner?.trading_name || partner?.name || ""),
        town: String(partner?.settings?.main_location?.town || partner?.settings?.main_location?.label || ""),
        phone: String(partner?.business_phone || partner?.settings?.business_phone || partner?.settings?.phone || ""),
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        plate: vehicle.registration_number || "",
        kind: String(vehicle.vehicle_categories?.code || ""),
        dailyRate: Number(vehicle.daily_rate || 0),
        weeklyRate: Number(vehicle.weekly_rate || 0),
        monthlyRate: Number(vehicle.monthly_rate || 0),
        deposit: vehicle.deposit_amount != null ? Number(vehicle.deposit_amount) : usualDeposit,
        currency: String(partner?.currency || "THB")
      };
    })
    .sort((a, b) => a.business.localeCompare(b.business) || a.make.localeCompare(b.make));
}


/**
 * Sends a customer to a partner: a booking link in the partner's business,
 * exactly as if the partner had created it, plus the referral that earns the fee.
 */
export async function referCustomer(
  admin: any,
  input: { fromOrganizationId: string; userId: string; vehicleId: string; startDate: string; endDate: string | null; customerName: string; customerPhone: string; baseUrl: string }
) {
  const { data: vehicle } = await admin
    .from("vehicles")
    .select("id, organization_id, make, model, registration_number, status, daily_rate, weekly_rate, monthly_rate, deposit_amount, metadata")
    .eq("id", input.vehicleId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle || vehicle.organization_id === input.fromOrganizationId) throw new Error("That vehicle is not a partner's.");
  const free = await findPartnerVehicles(admin, { organizationId: input.fromOrganizationId, startDate: input.startDate, endDate: input.endDate, kind: null });
  const offer = free.find((item) => item.vehicleId === vehicle.id);
  if (!offer) throw new Error("That vehicle is no longer free for those dates.");

  const [{ data: partner }, { data: referrer }] = await Promise.all([
    admin.from("organizations").select("id, name, trading_name, settings, currency").eq("id", vehicle.organization_id).maybeSingle(),
    admin.from("organizations").select("id, name, trading_name").eq("id", input.fromOrganizationId).maybeSingle()
  ]);
  const price = priceFor(offer, input.startDate, input.endDate);
  const deposit = offer.deposit;
  const currency = String(partner?.currency || "THB");

  const { data: rental, error: rentalError } = await admin
    .from("rentals")
    .insert({
      organization_id: vehicle.organization_id,
      customer_id: null,
      vehicle_id: vehicle.id,
      start_date: input.startDate,
      end_date: input.endDate,
      is_indefinite: !input.endDate,
      status: "booked",
      pricing_model: price.model,
      recurring_billing: price.model === "monthly",
      billing_interval: price.model,
      rental_rate: price.rate,
      deposit_amount: deposit,
      balance_due: price.total + deposit,
      currency,
      delivery_method: "collection",
      delivery_location: null,
      return_location: null,
      created_by: null
    })
    .select("id, display_code, reference")
    .single();
  if (rentalError || !rental) throw new Error(rentalError?.message || "The booking could not be created.");

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .insert({ organization_id: vehicle.organization_id, rental_id: rental.id, customer_id: null, locale: "en", status: "draft", metadata: { included_items: [], referral: true } })
    .select("id")
    .single();
  if (contractError || !contract) throw new Error(contractError?.message || "The booking could not be created.");

  const bookingData = {
    delivery_method: "collection",
    delivery_location: null,
    delivery_datetime: null,
    special_conditions: null,
    customer_document_status: null,
    share_channel: "partner",
    referral: { from: String(referrer?.trading_name || referrer?.name || ""), customer_name: input.customerName, customer_phone: input.customerPhone }
  };
  const { data: link, error: linkError } = await admin
    .from("booking_links")
    .insert({
      organization_id: vehicle.organization_id,
      rental_id: rental.id,
      vehicle_id: vehicle.id,
      customer_id: null,
      contract_id: contract.id,
      status: "pending",
      data_type: "rental_booking",
      delivery_method: "collection",
      booking_data: bookingData,
      included_items: [],
      special_conditions: null,
      share_channels: ["partner"],
      hold_until: holdDeadline(bookingRules(partner?.settings).holdHours),
      expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_by: null
    })
    .select("id, token")
    .single();
  if (linkError || !link) throw new Error(linkError?.message || "The booking link could not be created.");

  const bookingUrl = `${input.baseUrl.replace(/\/$/, "")}/book/${link.token}`;
  await Promise.all([
    admin.from("booking_links").update({ public_url: bookingUrl, contract_id: contract.id }).eq("id", link.id),
    admin.from("contracts").update({ booking_link_id: link.id }).eq("id", contract.id),
    admin.from("rentals").update({ contract_id: contract.id }).eq("id", rental.id)
  ]);

  const { data: referral } = await admin
    .from("referrals")
    .insert({
      from_organization_id: input.fromOrganizationId,
      to_organization_id: vehicle.organization_id,
      vehicle_id: vehicle.id,
      rental_id: rental.id,
      booking_link_id: link.id,
      customer_name: input.customerName,
      customer_phone: input.customerPhone,
      start_date: input.startDate,
      end_date: input.endDate,
      fee_pct: FINDERS_FEE_PCT,
      created_by: input.userId
    })
    .select("id")
    .single();

  const referrerName = String(referrer?.trading_name || referrer?.name || "a partner");
  // The partner hears about it: a job on their list, and an alert.
  await admin.from("tasks").insert({
    organization_id: vehicle.organization_id,
    vehicle_id: vehicle.id,
    rental_id: rental.id,
    title: `Referral from ${referrerName}: ${input.customerName || "a customer"} for ${vehicle.make} ${vehicle.model}, ${longDate(input.startDate, "en")}${input.endDate ? ` to ${longDate(input.endDate, "en")}` : ""}. Booking link sent; finder's fee ${FINDERS_FEE_PCT}% of the first rent.`,
    task_type: "other",
    due_at: input.startDate,
    created_by: null
  });
  try {
    const { notifyOperator } = await import("@/lib/notify-operator");
    await notifyOperator(vehicle.organization_id, `ðŸ¤ Referral from ${referrerName}: ${input.customerName || "a customer"} wants your ${vehicle.make} ${vehicle.model} from ${longDate(input.startDate, "en")}. The booking link has been sent to them.`, "operator_notification");
  } catch {
    // The task on their list is enough.
  }

  return { bookingUrl, referralId: referral?.id as string | undefined, partner: String(partner?.trading_name || partner?.name || ""), rentalId: rental.id as string, price, deposit, currency };
}

/** Called when rent is recorded on a rental: the first rent payment sets the fee. */
export async function noteReferralFee(supabase: any, rentalId: string, amount: number, paymentMetadata: any) {
  const type = String(paymentMetadata?.type || "rent");
  if (paymentMetadata?.is_deposit === true || ["deposit", "deposit_top_up", "charge", "extras"].includes(type)) return;
  const { data: referral } = await supabase.from("referrals").select("id, fee_pct, fee_amount").eq("rental_id", rentalId).is("fee_amount", null).neq("status", "cancelled").maybeSingle();
  if (!referral) return;
  const fee = Math.round((amount * Number(referral.fee_pct || FINDERS_FEE_PCT)) / 100);
  await supabase.from("referrals").update({ fee_amount: fee, fee_due_at: businessToday(7), status: "rented" }).eq("id", referral.id);
}


export async function listReferrals(supabase: any, organizationId: string): Promise<ReferralRow[]> {
  const { data } = await supabase
    .from("referrals")
    .select("id, from_organization_id, to_organization_id, customer_name, customer_phone, start_date, end_date, rental_id, status, fee_pct, fee_amount, fee_due_at, fee_paid_at, created_at, vehicles(make, model, registration_number), rentals(status), from_org:organizations!referrals_from_organization_id_fkey(name, trading_name), to_org:organizations!referrals_to_organization_id_fkey(name, trading_name)")
    .or(`from_organization_id.eq.${organizationId},to_organization_id.eq.${organizationId}`)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data || []) as any[]).map((row) => {
    const sent = row.from_organization_id === organizationId;
    const other = sent ? row.to_org : row.from_org;
    return {
      id: row.id,
      direction: sent ? "sent" : "received",
      partner: String(other?.trading_name || other?.name || ""),
      customerName: row.customer_name || "",
      customerPhone: row.customer_phone || "",
      vehicle: [row.vehicles?.make, row.vehicles?.model, row.vehicles?.registration_number].filter(Boolean).join(" "),
      startDate: row.start_date,
      endDate: row.end_date,
      rentalId: row.rental_id,
      rentalStatus: row.rentals?.status || null,
      status: row.status,
      feePct: Number(row.fee_pct || FINDERS_FEE_PCT),
      feeAmount: row.fee_amount === null ? null : Number(row.fee_amount),
      feeDueAt: row.fee_due_at,
      feePaidAt: row.fee_paid_at,
      createdAt: row.created_at
    };
  });
}

/** The partner paid the referrer: both businesses get the money record. */
export async function markReferralFeePaid(admin: any, input: { referralId: string; organizationId: string; userId: string; method: string }) {
  const { data: referral } = await admin
    .from("referrals")
    .select("id, from_organization_id, to_organization_id, vehicle_id, rental_id, customer_name, fee_amount, fee_paid_at, from_org:organizations!referrals_from_organization_id_fkey(name, trading_name, currency), to_org:organizations!referrals_to_organization_id_fkey(name, trading_name, currency)")
    .eq("id", input.referralId)
    .maybeSingle();
  if (!referral || referral.to_organization_id !== input.organizationId) throw new Error("Only the business that owes the fee can mark it paid.");
  if (referral.fee_paid_at) return;
  if (!referral.fee_amount) throw new Error("No fee is due yet: it is set when the first rent is recorded.");
  const today = businessToday();
  const amount = Number(referral.fee_amount);
  const referrerName = String(referral.from_org?.trading_name || referral.from_org?.name || "partner");
  const partnerName = String(referral.to_org?.trading_name || referral.to_org?.name || "partner");
  const written = await Promise.all([
    admin.from("transactions").insert({
      organization_id: referral.to_organization_id,
      vehicle_id: referral.vehicle_id,
      rental_id: referral.rental_id,
      type: "finders_fee",
      amount,
      currency: String(referral.to_org?.currency || "THB"),
      transaction_date: today,
      notes: `Finder's fee to ${referrerName} for ${referral.customer_name || "a referred customer"}`,
      metadata: { source: "partner_network", referral_id: referral.id, payment_method: input.method },
      created_by: input.userId
    }),
    admin.from("transactions").insert({
      organization_id: referral.from_organization_id,
      vehicle_id: null,
      rental_id: null,
      type: "finders_fee_income",
      amount,
      currency: String(referral.from_org?.currency || "THB"),
      transaction_date: today,
      notes: `Finder's fee from ${partnerName} for ${referral.customer_name || "a referred customer"}`,
      metadata: { source: "partner_network", referral_id: referral.id, payment_method: input.method },
      created_by: null
    }),
    admin.from("referrals").update({ fee_paid_at: new Date().toISOString(), fee_paid_method: input.method }).eq("id", referral.id)
  ]);
  const failed = written.find((result: any) => result?.error);
  if (failed) throw new Error(failed.error.message);
}
