"use server";

import { said } from "@/lib/i18n/server-text";
import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";
import { businessToday } from "@/lib/business-time";
import { notifyOperator } from "@/lib/notify-operator";
import { BOOKING_OFFERS, getPublicCatalog, publicBookingSettings } from "@/lib/public-catalog";
import { daysBetween, minimumStay, planFor } from "@/lib/rental-estimate";
import { extrasFor, priceExtras, seasonalRate } from "@/lib/price-rules";
import { isTwoWheeler } from "@/lib/vehicle-groups";
import { clashes, holdDeadline } from "@/lib/booking-holds";
import { bookingRules, type BookingRules } from "@/lib/booking-rules";
import { isDoubleBookingError } from "@/lib/rental-conflicts";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { syncVehicleStatusFromBookings } from "@/lib/vehicle-status";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
const TAKEN = "Someone has just taken those dates. Please choose other dates or another vehicle.";

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/**
 * A customer books a vehicle from the public page. No sign-in and no approval
 * step: the booking is made at the listed price, the vehicle is taken for
 * those dates at once, and the customer goes straight to the booking form to
 * add their details and sign. The vehicle is held for a limited time (see
 * lib/booking-holds.ts); signing confirms the booking.
 */
export async function bookOnline(formData: FormData): Promise<Result<{ href: string }>> {
  const slug = String(formData.get("slug") || "").trim();
  const vehicleId = String(formData.get("vehicleId") || "").trim();
  const startDate = String(formData.get("startDate") || "").trim();
  const endDate = String(formData.get("endDate") || "").trim() || null;
  const name = String(formData.get("name") || "").trim().slice(0, 120);
  // Stored without spaces, the way the booking form and WhatsApp links expect.
  const phone = String(formData.get("phone") || "").replace(/[\s\-().]/g, "").slice(0, 24);

  // Bots fill every field; people never see this one.
  if (String(formData.get("website") || "").trim()) return { ok: false, error: await said("Please try again.") };

  if (name.length < 2) return { ok: false, error: await said("Please tell us your name.") };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: await said("Please add a phone or WhatsApp number we can reach you on.") };
  if (!isDate(startDate) || startDate < businessToday()) return { ok: false, error: await said("Please choose a start date from today onwards.") };
  if (endDate && (!isDate(endDate) || endDate <= startDate)) return { ok: false, error: await said("The return date must be after the start date.") };

  const catalog = await getPublicCatalog(slug);
  if (!catalog || !catalog.enabled) return { ok: false, error: await said("Online booking isn't available for this business right now.") };
  // The page only offers what the business chose; this stops a hand-made request getting round it.
  if (catalog.offer === "monthly" && endDate) return { ok: false, error: await said("This business only takes monthly rentals with no end date.") };
  if (catalog.offer === "dates" && !endDate) return { ok: false, error: await said("Please choose a return date.") };
  const vehicle = catalog.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return { ok: false, error: await said("That vehicle is no longer available. Please choose another.") };
  if (startDate < catalog.minStart) return { ok: false, error: await said(`The earliest start date is ${shortDate(catalog.minStart)}. Please choose a later date.`) };
  if (vehicle.busy.some((period) => clashes(startDate, endDate, period, catalog.gapDays))) return { ok: false, error: await said(TAKEN) };

  const basePlan = planFor(vehicle, endDate ? daysBetween(startDate, endDate) : null);
  // High season and paid extras: priced here from Settings, never taken from the browser.
  const plan = basePlan ? { ...basePlan, rate: seasonalRate(basePlan.rate, basePlan.pricingModel, catalog.seasons, startDate, endDate).rate } : null;
  let extraIds: string[] = [];
  try {
    extraIds = (JSON.parse(String(formData.get("extraIds") || "[]")) as unknown[]).map(String).slice(0, 30);
  } catch {
    extraIds = [];
  }
  const extrasPriced = priceExtras(
    extrasFor(catalog.extras, isTwoWheeler(vehicle.kind)).filter((extra) => extraIds.includes(extra.id)),
    endDate ? daysBetween(startDate, endDate) : null
  );
  if (!plan) return { ok: false, error: await said(`${minimumStay(vehicle) || "This vehicle can't be booked online for those dates"}. Please choose a longer stay or another vehicle.`) };

  const admin = createSupabaseAdminClient() as any;
  const organizationId = catalog.organizationId;

  // One person can't tie up the fleet: a couple of unfinished online bookings at most.
  const { data: unfinished } = await admin
    .from("booking_links")
    .select("id, customers!inner(phone)")
    .eq("organization_id", organizationId)
    .eq("booking_data->>source", "public_page")
    .in("status", ["pending", "viewed"])
    .is("customer_details_submitted_at", null)
    .eq("customers.phone", phone);
  if ((unfinished || []).length >= 2) return { ok: false, error: await said("You already have bookings waiting for your details. Please finish those first, or contact the business.") };

  // A returning customer keeps their record (matched by phone).
  const { data: existing } = await admin.from("customers").select("id").eq("organization_id", organizationId).eq("phone", phone).is("deleted_at", null).limit(1).maybeSingle();
  let customerId = existing?.id as string | undefined;
  if (!customerId) {
    const { data: created, error } = await admin.from("customers").insert({ organization_id: organizationId, full_name: name, phone }).select("id").single();
    if (error || !created) return { ok: false, error: await said("We couldn't start your booking. Please try again.") };
    customerId = created.id;
  }

  const { data: rental, error: rentalError } = await admin
    .from("rentals")
    .insert({
      organization_id: organizationId,
      customer_id: customerId,
      vehicle_id: vehicle.id,
      start_date: startDate,
      end_date: endDate,
      is_indefinite: !endDate,
      status: "booked",
      pricing_model: plan.pricingModel,
      recurring_billing: plan.pricingModel === "monthly",
      billing_interval: plan.pricingModel,
      rental_rate: plan.rate + extrasPriced.monthly,
      deposit_amount: vehicle.deposit,
      balance_due: plan.rate + extrasPriced.monthly + vehicle.deposit + extrasPriced.upfront,
      extras: extrasPriced.lines,
      extras_total: extrasPriced.upfront,
      currency: catalog.currency,
      delivery_method: "tbd",
      delivery_location: null,
      delivery_datetime: null,
      return_location: null
    })
    .select("id, display_code, reference")
    .single();
  if (rentalError || !rental) return { ok: false, error: isDoubleBookingError(rentalError) ? TAKEN : "We couldn't start your booking. Please try again." };

  const undo = async () => {
    await admin.from("booking_links").delete().eq("rental_id", rental.id);
    await admin.from("contracts").delete().eq("rental_id", rental.id);
    await admin.from("rentals").delete().eq("id", rental.id);
  };

  const { data: contract, error: contractError } = await admin
    .from("contracts")
    .insert({ organization_id: organizationId, rental_id: rental.id, customer_id: customerId, locale: "en", status: "draft", metadata: { included_items: [], special_conditions: null } })
    .select("id")
    .single();
  if (contractError || !contract) {
    await undo();
    return { ok: false, error: await said("We couldn't start your booking. Please try again.") };
  }

  const bookingData = { delivery_method: "tbd", delivery_location: null, delivery_datetime: null, special_conditions: null, share_channel: "public_page", source: "public_page" };
  const { data: link, error: linkError } = await admin
    .from("booking_links")
    .insert({
      organization_id: organizationId,
      rental_id: rental.id,
      vehicle_id: vehicle.id,
      customer_id: customerId,
      contract_id: contract.id,
      status: "pending",
      data_type: "rental_booking",
      delivery_method: "tbd",
      booking_data: bookingData,
      included_items: [],
      share_channels: ["public_page"],
      // Held for a limited time; the link itself lasts much longer.
      hold_until: holdDeadline(catalog.holdHours),
      expires_at: new Date(Date.now() + 60 * 24 * 3_600_000).toISOString()
    })
    .select("id, token")
    .single();
  if (linkError || !link) {
    await undo();
    return { ok: false, error: await said("We couldn't start your booking. Please try again.") };
  }

  const baseUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  await Promise.all([
    admin.from("booking_links").update({ public_url: baseUrl ? `${baseUrl}/book/${link.token}` : null }).eq("id", link.id),
    admin.from("contracts").update({ booking_link_id: link.id }).eq("id", contract.id),
    admin.from("rentals").update({ contract_id: contract.id }).eq("id", rental.id)
  ]);
  await syncVehicleStatusFromBookings(admin, organizationId, vehicle.id).catch(() => null);

  const when = endDate ? `${shortDate(startDate)} to ${shortDate(endDate)}` : `from ${shortDate(startDate)}, no end date`;
  await recordActivityEvent(admin, {
    organization_id: organizationId,
    entity_type: "rental",
    entity_id: rental.id,
    vehicle_id: vehicle.id,
    rental_id: rental.id,
    customer_id: customerId,
    event_type: "booking_created",
    title: "Booked online",
    detail: `${name} booked the ${vehicle.name} ${when} from your booking page.`
  } as any).catch(() => null);
  notifyOperator(organizationId, `🚗 New online booking: ${name} booked the ${vehicle.name} ${when}. They are filling in their details now.`, "operator_notification").catch(() => null);

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath("/calendar");
  revalidatePath(`/rent/${slug}`);
  return { ok: true, href: `/book/${link.token}` };
}

/** Turns the public booking page on or off and sets its terms. */
export async function savePublicBookingSettings(input: { enabled: boolean; holdHours: number; deposit: number; offer?: string }): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };

  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("settings, slug").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: await said("Business not found.") };
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  const current = publicBookingSettings(settings);
  const holdHours = [6, 12, 24, 48, 72].includes(Number(input.holdHours)) ? Number(input.holdHours) : current.holdHours;
  const deposit = Number.isFinite(Number(input.deposit)) && Number(input.deposit) >= 0 ? Math.round(Number(input.deposit)) : current.deposit;
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, public_booking: { enabled: !!input.enabled, hold_hours: holdHours, deposit, offer: (BOOKING_OFFERS as string[]).includes(String(input.offer)) ? input.offer : current.offer } } })
    .eq("id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/settings");
  revalidatePath(`/rent/${organization.slug}`);
  return { ok: true };
}

/** Turns the automatic messages to customers on or off (owner only). */
export async function saveCustomerMessages(enabled: boolean): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("settings").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: await said("Business not found.") };
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  const { error } = await admin.from("organizations").update({ settings: { ...settings, customer_messages: { enabled: !!enabled } } }).eq("id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/settings");
  return { ok: true };
}

/** Holds and notice periods for the business (owner only). */
export async function saveBookingRules(input: BookingRules): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };

  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("settings, slug").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: await said("Business not found.") };
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  // Run the values through the same reader the rest of the app uses, so only allowed options are stored.
  const clean = bookingRules({
    booking_rules: { hold_hours: input.holdHours, lead_hours: input.leadHours, end_notice_days: input.endNoticeDays, extend_notice_days: input.extendNoticeDays, gap_days: input.gapDays }
  });
  const { error } = await admin
    .from("organizations")
    .update({
      settings: {
        ...settings,
        booking_rules: { hold_hours: clean.holdHours, lead_hours: clean.leadHours, end_notice_days: clean.endNoticeDays, extend_notice_days: clean.extendNoticeDays, gap_days: clean.gapDays }
      }
    })
    .eq("id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/settings");
  revalidatePath(`/rent/${organization.slug}`);
  return { ok: true };
}
