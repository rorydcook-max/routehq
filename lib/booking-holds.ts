import { completeRentalJobs, remindRentalCustomerOnce, tellRentalCustomer } from "@/lib/customer-messages";
import { bookingRules, clashes } from "@/lib/booking-rules";

export { clashes };
import { notifyOperator } from "@/lib/notify-operator";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { syncVehicleStatusFromBookings } from "@/lib/vehicle-status";

/**
 * Holds. A booking link keeps its vehicle for a limited time. Signing confirms
 * the booking. If the hold runs out first, the rental goes back to "draft"
 * (which blocks nothing) so the dates open up, but the link keeps working:
 * opening it again takes the vehicle back if it is still free.
 *
 * All functions take a service-role client: holds are released by whoever
 * happens to load a page, including customers who aren't signed in.
 */

const OPEN_LINK_STATUSES = ["pending", "sent", "viewed", "expired"];

export function holdDeadline(holdHours: number, from = Date.now()) {
  return new Date(from + holdHours * 3_600_000).toISOString();
}

/** Opens up the dates of every booking whose hold has run out without a signature. */
export async function releaseExpiredHolds(admin: any, organizationId: string) {
  const { data: stale } = await admin
    .from("booking_links")
    .select("id, rental_id, vehicle_id, customer_id, rentals!inner(status, display_code, reference), vehicles(make, model), customers(full_name)")
    .eq("organization_id", organizationId)
    .in("status", OPEN_LINK_STATUSES)
    .is("hold_released_at", null)
    .not("hold_until", "is", null)
    .lt("hold_until", new Date().toISOString())
    .eq("rentals.status", "booked");

  for (const link of stale || []) {
    const now = new Date().toISOString();
    const { error } = await admin.from("rentals").update({ status: "draft" }).eq("id", link.rental_id).eq("organization_id", organizationId).eq("status", "booked");
    if (error) continue;
    await admin.from("booking_links").update({ hold_released_at: now }).eq("id", link.id);
    await syncVehicleStatusFromBookings(admin, organizationId, link.vehicle_id).catch(() => null);
    const vehicle = [link.vehicles?.make, link.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
    const who = link.customers?.full_name || "The customer";
    await recordActivityEvent(admin, {
      organization_id: organizationId,
      entity_type: "rental",
      entity_id: link.rental_id,
      vehicle_id: link.vehicle_id,
      rental_id: link.rental_id,
      customer_id: link.customer_id,
      event_type: "booking_hold_released",
      title: "Hold ended",
      detail: `${who} did not finish the booking form in time, so the ${vehicle} is open for those dates again. Their link still works if it is free when they come back.`
    } as any).catch(() => null);
    await tellRentalCustomer(admin, link.rental_id, ({ say }) => say("holdReleased", { vehicle }));
    notifyOperator(organizationId, `⏳ Hold ended: ${who} hasn't finished the booking form for the ${vehicle}. The dates are open again; their link still works if the vehicle is free.`, "operator_notification").catch(() => null);
  }
  return (stale || []).length;
}

/** The same, for every business at once. Run by the daily job so holds end even when nobody opens a page. */
export async function releaseExpiredHoldsEverywhere(admin: any) {
  const { data: stale } = await admin
    .from("booking_links")
    .select("organization_id")
    .in("status", OPEN_LINK_STATUSES)
    .is("hold_released_at", null)
    .not("hold_until", "is", null)
    .lt("hold_until", new Date().toISOString());
  const organizations = Array.from(new Set<string>((stale || []).map((row: any) => String(row.organization_id))));
  let released = 0;
  for (const organizationId of organizations) released += await releaseExpiredHolds(admin, organizationId).catch(() => 0);
  return released;
}

/**
 * A customer comes back to a link whose hold ran out. Takes the vehicle again
 * if nothing else has been booked for those dates. Returns false when the
 * dates have gone.
 */
export async function retakeHold(admin: any, bookingLink: any): Promise<boolean> {
  const { data: rental } = await admin.from("rentals").select("id, organization_id, vehicle_id, start_date, end_date, status").eq("id", bookingLink.rental_id).maybeSingle();
  if (!rental) return false;
  if (rental.status !== "draft") {
    // Already live again (or cancelled / finished): nothing to retake.
    return (BLOCKING_RENTAL_STATUSES as readonly string[]).includes(rental.status);
  }

  const { data: organization } = await admin.from("organizations").select("settings").eq("id", rental.organization_id).maybeSingle();
  const rules = bookingRules(organization?.settings);
  const start = String(rental.start_date).slice(0, 10);
  const end = rental.end_date ? String(rental.end_date).slice(0, 10) : null;

  const { data: others } = await admin
    .from("rentals")
    .select("start_date, end_date")
    .eq("organization_id", rental.organization_id)
    .eq("vehicle_id", rental.vehicle_id)
    .neq("id", rental.id)
    .is("deleted_at", null)
    .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[]);
  const taken = (others || []).some((row: any) =>
    clashes(start, end, { startDate: String(row.start_date).slice(0, 10), endDate: row.end_date ? String(row.end_date).slice(0, 10) : null }, rules.gapDays)
  );
  if (taken) return false;

  const { error } = await admin.from("rentals").update({ status: "booked" }).eq("id", rental.id).eq("status", "draft");
  // Someone booked the dates between the check and the update.
  if (error) return false;
  await admin.from("booking_links").update({ hold_until: holdDeadline(rules.holdHours), hold_released_at: null }).eq("id", bookingLink.id);
  await syncVehicleStatusFromBookings(admin, rental.organization_id, rental.vehicle_id).catch(() => null);
  return true;
}

export type EndingHold = { rentalId: string; vehicle: string; who: string; holdUntil: string };

const clock = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" }).format(new Date(iso));

/**
 * Unsigned bookings whose hold runs out within the next few hours, soonest
 * first, for the dashboard. A customer with under three hours left is told
 * once, so the dates are not lost by surprise.
 */
export async function holdsEndingSoon(admin: any, organizationId: string, withinHours = 6): Promise<EndingHold[]> {
  const now = Date.now();
  const { data: links } = await admin
    .from("booking_links")
    .select("id, rental_id, hold_until, rentals!inner(status), vehicles(make, model), customers(full_name)")
    .eq("organization_id", organizationId)
    .in("status", OPEN_LINK_STATUSES)
    .is("hold_released_at", null)
    .is("contract_signed_at", null)
    .gt("hold_until", new Date(now).toISOString())
    .lt("hold_until", new Date(now + withinHours * 3_600_000).toISOString())
    .eq("rentals.status", "booked")
    .order("hold_until", { ascending: true });

  const ending: EndingHold[] = [];
  for (const link of links || []) {
    const vehicle = [link.vehicles?.make, link.vehicles?.model].filter(Boolean).join(" ") || "vehicle";
    ending.push({ rentalId: link.rental_id, vehicle, who: String(link.customers?.full_name || ""), holdUntil: String(link.hold_until) });
    if (new Date(link.hold_until).getTime() - now < 3 * 3_600_000) {
      await remindRentalCustomerOnce(admin, link.rental_id, `hold-ending:${link.id}:${String(link.hold_until).slice(0, 16)}`, ({ say }) => say("holdEnding", { vehicle, time: clock(link.hold_until) })).catch(() => false);
    }
  }
  return ending;
}
