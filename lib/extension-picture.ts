import { addDaysIso, bookingRules, clashes } from "@/lib/booking-rules";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { quoteStay, rentalRateCard } from "@/lib/rental-estimate";
import { syncVehicleStatusFromBookings } from "@/lib/vehicle-status";

/**
 * When a customer's request to stay longer can't be applied because another
 * booking is on the same vehicle, the owner decides. This gathers both sides
 * for that decision: what the longer stay is worth, which booking is in the
 * way and what it is worth, how long the vehicle is free without touching
 * anything, and which other vehicles the booking in the way could move to.
 */

export type MoveOption = { vehicleId: string; label: string; plate: string | null; sameKind: boolean };

export type ExtensionBlocker = {
  rentalId: string;
  code: string | null;
  customerName: string | null;
  startDate: string;
  endDate: string | null;
  signed: boolean;
  /** Rent on the booking, deposit left out. */
  total: number;
  paid: number;
  vehicle: string;
  /** Only a booking that hasn't been handed over can move to another vehicle. */
  options: MoveOption[];
};

export type ExtensionPicture = {
  openEnded: boolean;
  currency: string;
  currentEnd: string | null;
  requestedEnd: string | null;
  /** What saying yes brings in: the extra days, or the monthly rate. */
  worth: { amount: number; explain: string | null; perMonth: boolean } | null;
  /** The latest return date that needs nothing moved. Null when there is none later than today's. */
  freeUntil: string | null;
  blockers: ExtensionBlocker[];
};

const HIDDEN_STATUS = /sold|retired|inactive|archived|written|maintenance/i;
const iso = (value: unknown) => (value ? String(value).slice(0, 10) : null);
const nameOf = (vehicle: any) => [vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "vehicle";

function daysBetween(from: string, to: string) {
  return Math.round((new Date(`${to}T00:00:00Z`).getTime() - new Date(`${from}T00:00:00Z`).getTime()) / 86_400_000);
}

/** Vehicles free for the whole of a booking's dates, closest match first. */
async function freeVehiclesFor(admin: any, organizationId: string, booking: { vehicleId: string; startDate: string; endDate: string | null; categoryId: string | null }, gapDays: number): Promise<MoveOption[]> {
  const [{ data: vehicles }, { data: rentals }] = await Promise.all([
    admin.from("vehicles").select("id, make, model, registration_number, status, category_id, monthly_rate").eq("organization_id", organizationId).is("deleted_at", null),
    admin.from("rentals").select("vehicle_id, start_date, end_date").eq("organization_id", organizationId).is("deleted_at", null).in("status", BLOCKING_RENTAL_STATUSES as unknown as string[])
  ]);
  const busy = new Map<string, Array<{ startDate: string; endDate: string | null }>>();
  for (const row of rentals || []) {
    if (!row.vehicle_id || !row.start_date) continue;
    const list = busy.get(row.vehicle_id) || [];
    list.push({ startDate: String(row.start_date).slice(0, 10), endDate: iso(row.end_date) });
    busy.set(row.vehicle_id, list);
  }
  return ((vehicles || []) as any[])
    .filter((vehicle) => vehicle.id !== booking.vehicleId && !HIDDEN_STATUS.test(String(vehicle.status || "")))
    .filter((vehicle) => !(busy.get(vehicle.id) || []).some((period) => clashes(booking.startDate, booking.endDate, period, gapDays)))
    .map((vehicle) => ({ vehicleId: String(vehicle.id), label: nameOf(vehicle), plate: vehicle.registration_number || null, sameKind: !!booking.categoryId && vehicle.category_id === booking.categoryId }))
    .sort((a, b) => Number(b.sameKind) - Number(a.sameKind) || a.label.localeCompare(b.label));
}

export async function extensionPicture(admin: any, organizationId: string, rentalId: string, content: any): Promise<ExtensionPicture | null> {
  const { data: rental } = await admin
    .from("rentals")
    .select("id, organization_id, vehicle_id, start_date, end_date, rental_rate, pricing_model, billing_interval, currency, vehicles!rentals_vehicle_id_fkey(make, model, category_id, daily_rate, weekly_rate, monthly_rate)")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!rental) return null;

  const openEnded = !!content?.open_ended;
  const currentEnd = iso(rental.end_date);
  const requestedEnd = openEnded ? null : iso(content?.new_end_date);
  const card = rentalRateCard(rental.vehicles, rental);

  let worth: ExtensionPicture["worth"] = null;
  if (openEnded && card.monthlyRate > 0) worth = { amount: card.monthlyRate, explain: null, perMonth: true };
  else if (!openEnded && currentEnd && requestedEnd && requestedEnd > currentEnd) {
    const quote = quoteStay(card, daysBetween(currentEnd, requestedEnd));
    if (quote && quote.amount > 0) worth = { amount: quote.amount, explain: quote.explain || null, perMonth: false };
  }

  const { data: organization } = await admin.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
  const gapDays = bookingRules(organization?.settings).gapDays;
  const start = String(rental.start_date).slice(0, 10);

  const { data: others } = await admin
    .from("rentals")
    .select("id, display_code, reference, status, start_date, end_date, rental_document_executed_at, customers!rentals_customer_id_fkey(full_name)")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", rental.vehicle_id)
    .neq("id", rental.id)
    .is("deleted_at", null)
    .in("status", BLOCKING_RENTAL_STATUSES as unknown as string[])
    .order("start_date", { ascending: true });

  const later = ((others || []) as any[]).filter((row) => String(row.start_date).slice(0, 10) >= (currentEnd || start));
  const inTheWay = later.filter((row) => clashes(start, requestedEnd, { startDate: String(row.start_date).slice(0, 10), endDate: iso(row.end_date) }, gapDays));

  const firstStart = later[0] ? String(later[0].start_date).slice(0, 10) : null;
  const lastFree = firstStart ? addDaysIso(firstStart, -gapDays) : null;
  const freeUntil = inTheWay.length && lastFree && currentEnd && lastFree > currentEnd ? lastFree : null;

  const ids = inTheWay.map((row) => row.id);
  const [{ data: payments }, { data: links }] = ids.length
    ? await Promise.all([
        admin.from("rental_payments").select("rental_id, amount, status, metadata").in("rental_id", ids).is("deleted_at", null),
        admin.from("booking_links").select("rental_id, contract_signed_at").in("rental_id", ids).is("deleted_at", null)
      ])
    : [{ data: [] }, { data: [] }];

  const blockers: ExtensionBlocker[] = [];
  for (const row of inTheWay) {
    const rows = ((payments || []) as any[]).filter((payment) => payment.rental_id === row.id && !payment.metadata?.is_deposit && payment.metadata?.type !== "deposit");
    const live = rows.filter((payment) => !["cancelled", "voided", "refunded", "waived"].includes(String(payment.status)));
    const startDate = String(row.start_date).slice(0, 10);
    const endDate = iso(row.end_date);
    blockers.push({
      rentalId: row.id,
      code: row.display_code || row.reference || null,
      customerName: row.customers?.full_name || null,
      startDate,
      endDate,
      signed: !!row.rental_document_executed_at || ((links || []) as any[]).some((link) => link.rental_id === row.id && link.contract_signed_at),
      total: live.reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      paid: live.filter((payment) => ["paid", "reconciled"].includes(String(payment.status))).reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
      vehicle: nameOf(rental.vehicles),
      options: row.status === "booked" ? await freeVehiclesFor(admin, organizationId, { vehicleId: rental.vehicle_id, startDate, endDate, categoryId: rental.vehicles?.category_id || null }, gapDays) : []
    });
  }

  return { openEnded, currency: String(rental.currency || "THB"), currentEnd, requestedEnd, worth, freeUntil, blockers };
}

/** Vehicles a booking that hasn't been handed over could move to: free for all of its dates. */
export async function moveOptionsFor(admin: any, organizationId: string, rentalId: string): Promise<MoveOption[]> {
  const { data: booking } = await admin
    .from("rentals")
    .select("vehicle_id, status, start_date, end_date, vehicles!rentals_vehicle_id_fkey(category_id)")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!booking || booking.status !== "booked" || !booking.start_date) return [];
  const { data: organization } = await admin.from("organizations").select("settings").eq("id", organizationId).maybeSingle();
  return freeVehiclesFor(admin, organizationId, { vehicleId: booking.vehicle_id, startDate: String(booking.start_date).slice(0, 10), endDate: iso(booking.end_date), categoryId: booking.vehicles?.category_id || null }, bookingRules(organization?.settings).gapDays);
}

/**
 * Moves a booking that hasn't been handed over to another vehicle, keeping its
 * dates and price. Refuses if the new vehicle isn't free for those dates.
 */
export async function moveBookingToVehicle(admin: any, input: { organizationId: string; rentalId: string; vehicleId: string }): Promise<{ ok: true; from: string; to: string } | { ok: false; error: string }> {
  const { data: booking } = await admin
    .from("rentals")
    .select("id, vehicle_id, original_vehicle_id, status, start_date, end_date, vehicles!rentals_vehicle_id_fkey(make, model, category_id)")
    .eq("id", input.rentalId)
    .eq("organization_id", input.organizationId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!booking) return { ok: false, error: "The other booking could not be found." };
  if (booking.status !== "booked") return { ok: false, error: "The other booking has already been handed over, so it can't be moved." };

  const { data: organization } = await admin.from("organizations").select("settings").eq("id", input.organizationId).maybeSingle();
  const gapDays = bookingRules(organization?.settings).gapDays;
  const options = await freeVehiclesFor(admin, input.organizationId, { vehicleId: booking.vehicle_id, startDate: String(booking.start_date).slice(0, 10), endDate: iso(booking.end_date), categoryId: booking.vehicles?.category_id || null }, gapDays);
  const target = options.find((option) => option.vehicleId === input.vehicleId);
  if (!target) return { ok: false, error: "That vehicle is no longer free for the other booking's dates. Pick another." };

  const from = booking.vehicle_id as string;
  // The database refuses this if another booking took the vehicle meanwhile.
  const { error } = await admin.from("rentals").update({ vehicle_id: input.vehicleId, original_vehicle_id: booking.original_vehicle_id || from }).eq("id", booking.id).eq("vehicle_id", from);
  if (error) return { ok: false, error: "That vehicle is no longer free for the other booking's dates. Pick another." };

  const quiet = (query: any) => query.then(() => null, () => null);
  await Promise.all([
    quiet(admin.from("rental_payments").update({ vehicle_id: input.vehicleId }).eq("rental_id", booking.id)),
    quiet(admin.from("booking_links").update({ vehicle_id: input.vehicleId }).eq("rental_id", booking.id)),
    quiet(admin.from("tasks").update({ vehicle_id: input.vehicleId }).eq("rental_id", booking.id).is("completed_at", null)),
    quiet(admin.from("transactions").update({ vehicle_id: input.vehicleId }).eq("rental_id", booking.id).eq("vehicle_id", from))
  ]);
  await syncVehicleStatusFromBookings(admin, input.organizationId, from).catch(() => null);
  await syncVehicleStatusFromBookings(admin, input.organizationId, input.vehicleId).catch(() => null);

  return { ok: true, from: nameOf(booking.vehicles), to: target.label };
}
