import { businessToday } from "@/lib/business-time";
import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { VehicleArt } from "@/components/vehicle-art";
import { initialsOf } from "@/components/glance";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { shortDate } from "@/lib/i18n/dates";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { kindFromCategory } from "@/lib/vehicle-groups";

const DAY = 86_400_000;

function daysFromToday(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date(`${businessToday()}T00:00:00Z`).getTime();
  return Math.round((new Date(`${String(value).slice(0, 10)}T00:00:00Z`).getTime() - today) / DAY);
}

type Say = (key: string, values?: Record<string, string | number>) => string;

/** When it is due, in the words an owner would use, and whether it needs a nudge. */
function timing(type: string, rental: any, say: Say, locale: string): { text: string; tone: "late" | "today" | "later" } {
  const date = type === "delivery" ? rental.start_date : rental.end_date;
  const days = daysFromToday(date);
  const out = type === "delivery";
  if (days === null) return { text: say("noReturnDate"), tone: "later" };
  if (days < 0) return { text: say(out ? "lateOut" : "lateBack", { date: shortDate(date, locale), days: Math.abs(days) }), tone: "late" };
  if (days === 0) return { text: say(out ? "outToday" : "backToday"), tone: "today" };
  if (days === 1) return { text: say(out ? "outTomorrow" : "backTomorrow"), tone: "later" };
  return { text: say(out ? "outOn" : "backOn", { date: shortDate(date, locale), days }), tone: "later" };
}

const TONE: Record<"late" | "today" | "later", string> = {
  late: "bg-[var(--danger-light)] text-[var(--danger)]",
  today: "bg-[var(--primary-light)] text-[var(--primary)]",
  later: "bg-[var(--panel-tertiary)] text-[var(--foreground-secondary)]"
};

export default async function StartInspectionPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!["delivery", "return"].includes(type)) {
    notFound();
  }
  const [userEmail, organization, t, locale] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("inspectStart"), getLocale()]);
  const say = t as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const statuses = type === "delivery" ? ["booked"] : ["active", "due_soon", "overdue", "extended"];
  const { data, error } = await supabase
    .from("rentals")
    .select("id, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name, phone), vehicles!rentals_vehicle_id_fkey(make, model, registration_number, color, vehicle_categories(code, name))")
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
  const out = type === "delivery";

  return (
    <AppShell hero={<PageBand subtitle={say(out ? "introOut" : "introBack")} keepSubtitle title={say(out ? "titleOut" : "titleBack")} />} userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        {ready.length === 0 ? (
          <div className="card p-6 text-center">
            <p className="text-[17px] font-semibold text-[var(--foreground)]">{say(out ? "emptyOut" : "emptyBack")}</p>
            <Link className="primary-action pressable mt-4 inline-flex" href={out ? "/bookings/new" : "/bookings"}>
              {say(out ? "createBooking" : "seeBookings")}
            </Link>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {ready.map((rental, index) => {
              const when = timing(type, rental, say, locale);
              return (
                <li className="rise" key={rental.id} style={{ ["--d" as string]: `${Math.min(index, 8) * 50}ms` } as React.CSSProperties}>
                  <Link className="card pressable flex items-center gap-3.5 p-3" href={`/inspections/${type}/${rental.id}` as Route}>
                    <VehicleArt colour={rental.vehicles?.color} kind={kindFromCategory(rental.vehicles?.vehicle_categories)} model={rental.vehicles?.model} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-bold text-[var(--foreground)]">
                        {rental.vehicles?.make} {rental.vehicles?.model}
                        {rental.vehicles?.registration_number ? <span className="font-mono-data ml-2 font-medium text-[var(--muted)]">{rental.vehicles.registration_number}</span> : null}
                      </p>
                      <p className="mt-0.5 flex items-center gap-2 truncate font-medium text-[var(--foreground-secondary)]">
                        <span aria-hidden="true" className="num inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[12px] text-[var(--primary)]">{initialsOf(rental.customers?.full_name)}</span>
                        <span className="truncate">{rental.customers?.full_name || say("noCustomer")}</span>
                      </p>
                      <span className={`mt-1.5 inline-flex rounded-full px-2.5 py-0.5 font-bold ${TONE[when.tone]}`}>{when.text}</span>
                    </div>
                    <ChevronRight className="shrink-0 text-[var(--muted)]" size={20} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {waiting.length > 0 ? (
          <div className="mt-6">
            <h2 className="mb-2 px-1 text-[18px] text-[var(--foreground)]">{say("waitingTitle")}</h2>
            <ul className="space-y-2">
              {waiting.map((rental) => (
                <li key={rental.id}>
                  <Link className="card pressable flex items-center gap-3.5 p-3" href={`/bookings/${rental.id}` as Route}>
                    <VehicleArt colour={rental.vehicles?.color} kind={kindFromCategory(rental.vehicles?.vehicle_categories)} model={rental.vehicles?.model} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-[var(--foreground)]">
                        {rental.vehicles?.make} {rental.vehicles?.model}
                      </p>
                      <p className="mt-0.5 text-[var(--foreground-secondary)]">{say("waitingLine", { date: shortDate(rental.start_date, locale) })}</p>
                    </div>
                    <ChevronRight className="shrink-0 text-[var(--muted)]" size={20} />
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
