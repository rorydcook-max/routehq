import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const DAY = 86_400_000;

function shortDate(value: string | null | undefined) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${String(value).slice(0, 10)}T00:00:00Z`));
}

function daysFromToday(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`).getTime();
  return Math.round((new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime() - today) / DAY);
}

/** When it is due, in the words an owner would use, and whether it needs a nudge. */
function timing(type: string, rental: any): { text: string; tone: "late" | "today" | "later" } {
  const days = daysFromToday(type === "delivery" ? rental.start_date : rental.end_date);
  const verb = type === "delivery" ? "Goes out" : "Due back";
  if (days === null) return { text: "No return date set", tone: "later" };
  if (days < 0) return { text: `${verb === "Goes out" ? "Was due to go out" : "Was due back"} ${shortDate(type === "delivery" ? rental.start_date : rental.end_date)} - ${Math.abs(days)} day${days === -1 ? "" : "s"} late`, tone: "late" };
  if (days === 0) return { text: `${verb} today`, tone: "today" };
  if (days === 1) return { text: `${verb} tomorrow`, tone: "later" };
  return { text: `${verb} ${shortDate(type === "delivery" ? rental.start_date : rental.end_date)} - in ${days} days`, tone: "later" };
}

export default async function StartInspectionPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!["delivery", "return"].includes(type)) {
    notFound();
  }

  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const statuses = type === "delivery" ? ["booked"] : ["active", "due_soon", "overdue", "extended"];
  const { data, error } = await supabase
    .from("rentals")
    .select("id, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name, phone), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
    .eq("organization_id", organization.id)
    .in("status", statuses)
    .is("deleted_at", null)
    .order(type === "delivery" ? "start_date" : "end_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const rentals = (data || []) as any[];
  // A booking link nobody has filled in yet has no customer to hand a vehicle to.
  const ready = rentals.filter((rental) => type !== "delivery" || rental.customers);
  const waiting = rentals.filter((rental) => type === "delivery" && !rental.customers);
  const title = type === "delivery" ? "Hand over a vehicle" : "Take a vehicle back";
  const intro = type === "delivery" ? "Which booking is going out? Soonest first." : "Which vehicle is coming back? Soonest first.";
  const empty = type === "delivery" ? "No bookings are waiting to go out." : "No vehicles are out on rent.";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        <div className="mb-4">
          <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[var(--foreground)]">{title}</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">{intro}</p>
        </div>

        {ready.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-white p-5 text-center">
            <p className="text-sm font-semibold text-[var(--foreground-secondary)]">{empty}</p>
            <Link className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white" href={type === "delivery" ? "/bookings/new" : "/bookings"}>
              {type === "delivery" ? "Create a booking" : "See all bookings"}
            </Link>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]">
            {ready.map((rental) => {
              const when = timing(type, rental);
              return (
                <li className="border-b border-[var(--border)] last:border-0" key={rental.id}>
                  <Link className="pressable flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-[#fbfaf8]" href={`/inspections/${type}/${rental.id}` as Route}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {rental.vehicles?.make} {rental.vehicles?.model}
                        {rental.vehicles?.registration_number ? <span className="font-mono-data ml-2 text-[13px] font-medium text-[var(--muted)]">{rental.vehicles.registration_number}</span> : null}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--foreground-secondary)]">{rental.customers?.full_name || "Customer not added yet"}</p>
                      <p className={`mt-0.5 text-[13px] font-medium ${when.tone === "late" ? "text-[#dc2626]" : when.tone === "today" ? "text-[var(--primary)]" : "text-[var(--muted)]"}`}>{when.text}</p>
                    </div>
                    <ChevronRight className="shrink-0 text-[var(--muted)]" size={18} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {waiting.length > 0 ? (
          <div className="mt-5">
            <p className="mb-2 text-[13px] font-semibold text-[var(--foreground-secondary)]">Waiting for the customer to fill in their booking link</p>
            <ul className="overflow-hidden rounded-xl border border-[var(--border)] bg-white">
              {waiting.map((rental) => (
                <li className="border-b border-[var(--border)] last:border-0" key={rental.id}>
                  <Link className="pressable flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-[#fbfaf8]" href={`/bookings/${rental.id}` as Route}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-semibold text-[var(--foreground-secondary)]">
                        {rental.vehicles?.make} {rental.vehicles?.model}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--muted)]">Booked from {shortDate(rental.start_date)}. Open the booking to send the link again.</p>
                    </div>
                    <ChevronRight className="shrink-0 text-[var(--muted)]" size={18} />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
