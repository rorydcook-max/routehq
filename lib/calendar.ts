import { businessToday } from "@/lib/business-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  tone: "blue" | "amber" | "red" | "green" | "purple";
  href: string;
  type: "rental_start" | "rental_end" | "rental_due" | "compliance" | "maintenance" | "payment" | "custom";
};

const COMPLIANCE_ITEMS: Array<{ key: string; label: string }> = [
  { key: "tax_expiry_date", label: "Road tax" },
  { key: "porbor_expiry_date", label: "พรบ" },
  { key: "insurance_expiry_date", label: "Insurance" },
  { key: "next_service_date", label: "Service" }
];

function lastDayOfMonth(year: number, month: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(value);
}

/**
 * Everything dated in one month: deliveries, returns, payments due and
 * vehicle paperwork. (This used to query an "organisation_id" column that
 * rentals and vehicles don't have, and a "-31" date that doesn't exist in
 * shorter months, so the calendar was always empty.)
 */
export async function getCalendarEvents(organizationId: string, year: number, month: number): Promise<CalendarEvent[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const events: CalendarEvent[] = [];
  const mm = String(month).padStart(2, "0");
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`;
  const today = businessToday();

  const [rentalsResult, paymentsResult, vehiclesResult] = await Promise.all([
    supabase
      .from("rentals")
      .select("id, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,draft)")
      .lte("start_date", endDate)
      .or(`end_date.gte.${startDate},end_date.is.null`),
    supabase
      .from("rental_payments")
      .select("id, rental_id, amount, due_date, status, voided, metadata, rentals!inner(status, customers!rentals_customer_id_fkey(full_name))")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", ["scheduled", "pending", "overdue"])
      .gte("due_date", startDate)
      .lte("due_date", endDate),
    supabase.from("vehicles").select("id, make, model, registration_number, metadata").eq("organization_id", organizationId).is("deleted_at", null)
  ]);

  for (const rental of rentalsResult.data || []) {
    const vehicle = rental.vehicles as any;
    const label = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";
    const customer = rental.customers?.full_name ? ` · ${rental.customers.full_name}` : "";
    const start = String(rental.start_date || "").slice(0, 10);
    const end = String(rental.end_date || "").slice(0, 10);

    if (start >= startDate && start <= endDate) {
      const notDelivered = rental.status === "booked";
      events.push({
        id: `rental-start-${rental.id}`,
        date: start,
        title: `${notDelivered && start < today ? "Delivery overdue" : "Delivery"}: ${label}${customer}`,
        tone: notDelivered && start < today ? "red" : "blue",
        href: `/bookings/${rental.id}`,
        type: "rental_start"
      });
    }

    if (end && end >= startDate && end <= endDate) {
      const returned = rental.status === "completed";
      const late = !returned && end < today;
      events.push({
        id: `rental-end-${rental.id}`,
        date: end,
        title: `${returned ? "Returned" : late ? "Return overdue" : "Return"}: ${label}${customer}`,
        tone: returned ? "green" : late ? "red" : "amber",
        href: `/bookings/${rental.id}`,
        type: "rental_end"
      });
    }
  }

  for (const payment of paymentsResult.data || []) {
    if (payment.voided || payment.metadata?.voided || payment.rentals?.status === "cancelled") continue;
    const due = String(payment.due_date).slice(0, 10);
    const who = payment.rentals?.customers?.full_name || "Customer";
    events.push({
      id: `payment-${payment.id}`,
      date: due,
      title: `${due < today ? "Unpaid" : "Payment"} ${money(Number(payment.amount || 0))}: ${who}`,
      tone: due < today ? "red" : "purple",
      href: `/bookings/${payment.rental_id}#payment-schedule`,
      type: "payment"
    });
  }

  for (const vehicle of vehiclesResult.data || []) {
    const compliance = vehicle.metadata?.compliance || {};
    const label = `${vehicle.make} ${vehicle.model}`;
    for (const item of COMPLIANCE_ITEMS) {
      const date = String(compliance[item.key] || "").slice(0, 10);
      if (date && date >= startDate && date <= endDate) {
        events.push({
          id: `compliance-${vehicle.id}-${item.key}`,
          date,
          title: `${item.label} ${date < today ? "expired" : "due"}: ${label}`,
          tone: "red",
          href: `/fleet/${vehicle.id}`,
          type: "compliance"
        });
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date) || a.type.localeCompare(b.type));
}

export type AvailabilityBooking = {
  id: string;
  /** First and last day shown in this month (the rental may run beyond it). */
  from: string;
  to: string;
  customer: string;
  state: "booked" | "out" | "late" | "returned";
  startsBefore: boolean;
  /** Runs past the end of the month, or has no end date. */
  runsOn: boolean;
};

export type AvailabilityVehicle = {
  id: string;
  name: string;
  plate: string;
  category: { code: string; name: string } | null;
  inShop: boolean;
  bookings: AvailabilityBooking[];
};

/**
 * One row per vehicle with its bookings across the month, so gaps (days a
 * vehicle is free) can be seen at a glance.
 */
export async function getAvailability(organizationId: string, year: number, month: number): Promise<AvailabilityVehicle[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const mm = String(month).padStart(2, "0");
  const startDate = `${year}-${mm}-01`;
  const endDate = `${year}-${mm}-${String(lastDayOfMonth(year, month)).padStart(2, "0")}`;
  const today = businessToday();

  const [vehiclesResult, rentalsResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, registration_number, status, availability_status, vehicle_categories(code, name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("make", { ascending: true }),
    supabase
      .from("rentals")
      .select("id, vehicle_id, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .not("status", "in", "(cancelled,draft)")
      .lte("start_date", endDate)
      .order("start_date", { ascending: true })
  ]);
  if (vehiclesResult.error) throw new Error(vehiclesResult.error.message);

  const byVehicle = new Map<string, AvailabilityBooking[]>();
  for (const rental of rentalsResult.data || []) {
    const start = String(rental.start_date || "").slice(0, 10);
    const plannedEnd = String(rental.end_date || "").slice(0, 10);
    const returned = rental.status === "completed";
    const stillOut = !returned && rental.status !== "booked";
    // A vehicle that hasn't come back is still out today, whatever the end date said.
    const late = stillOut && !!plannedEnd && plannedEnd < today;
    const end = !plannedEnd ? "9999-12-31" : late ? (today > plannedEnd ? today : plannedEnd) : plannedEnd;
    if (!start || end < startDate) continue;
    const list = byVehicle.get(rental.vehicle_id) || [];
    list.push({
      id: rental.id,
      from: start < startDate ? startDate : start,
      to: end > endDate ? endDate : end,
      customer: rental.customers?.full_name || "Booking link sent",
      state: returned ? "returned" : late ? "late" : rental.status === "booked" ? "booked" : "out",
      startsBefore: start < startDate,
      runsOn: end > endDate
    });
    byVehicle.set(rental.vehicle_id, list);
  }

  return ((vehiclesResult.data || []) as any[]).map((vehicle) => ({
    id: vehicle.id,
    name: [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle",
    plate: vehicle.registration_number || "",
    category: vehicle.vehicle_categories || null,
    inShop: /maint|repair|shop|service/i.test(`${vehicle.status || ""} ${vehicle.availability_status || ""}`),
    bookings: byVehicle.get(vehicle.id) || []
  }));
}
