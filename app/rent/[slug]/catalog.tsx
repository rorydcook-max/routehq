"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays, CheckCircle2 } from "lucide-react";
import { submitBookingRequest } from "@/app/actions/booking-requests";
import { VehicleKindIcon } from "@/components/vehicle-kind-icon";
import type { CatalogVehicle } from "@/lib/public-catalog";
import { overlaps } from "@/lib/rental-conflicts";
import { daysBetween, estimateRental, headlineRate } from "@/lib/rental-estimate";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

export function Catalog({
  slug,
  organizationName,
  vehicles,
  currency,
  holdHours,
  today
}: {
  slug: string;
  organizationName: string;
  vehicles: CatalogVehicle[];
  currency: string;
  holdHours: number;
  today: string;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [longTerm, setLongTerm] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [sent, setSent] = useState<{ vehicle: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const money = (value: number) => (currency === "THB" ? `฿${Math.round(value).toLocaleString("en-US")}` : `${currency} ${Math.round(value).toLocaleString("en-US")}`);
  const end = longTerm ? null : endDate || null;
  const datesReady = !!startDate && (longTerm || (!!endDate && endDate > startDate));
  const days = end ? daysBetween(startDate, end) : null;

  const rows = useMemo(
    () =>
      vehicles
        .map((vehicle) => {
          const clash = datesReady ? vehicle.busy.find((period) => overlaps(startDate, end, period)) : null;
          // When it is taken, say when it next comes free (if it has an end date).
          const freeFrom = clash?.endDate && clash.endDate > startDate ? clash.endDate : null;
          return { vehicle, free: !clash, freeFrom, openEndedClash: !!clash && !clash.endDate };
        })
        .sort((a, b) => Number(b.free) - Number(a.free)),
    [vehicles, startDate, end, datesReady]
  );
  const freeCount = rows.filter((row) => row.free).length;

  function send(formData: FormData, vehicle: CatalogVehicle) {
    setError(null);
    startTransition(async () => {
      try {
        formData.set("slug", slug);
        formData.set("vehicleId", vehicle.id);
        formData.set("startDate", startDate);
        formData.set("endDate", end || "");
        const result = await submitBookingRequest(formData);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setSent({ vehicle: vehicle.name });
        // Reload what is free: the vehicle just requested is now held.
        router.refresh();
        setOpenId(null);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch {
        setError("We couldn't send your request. Please try again.");
      }
    });
  }

  if (sent) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f0fdf4] text-[#16a34a]">
          <CheckCircle2 size={28} />
        </span>
        <h2 className="mt-4 text-2xl font-semibold">Request sent</h2>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
          {organizationName} has your request for the {sent.vehicle}
          {end ? ` from ${shortDate(startDate)} to ${shortDate(end)}` : ` from ${shortDate(startDate)}`}. It is held for you for {holdHours} hours while they confirm. They will contact you
          on the number you gave.
        </p>
        <button className="pressable mt-5 inline-flex min-h-11 items-center rounded-xl border border-[var(--border)] bg-white px-5 text-sm font-semibold text-[var(--foreground)]" onClick={() => setSent(null)} type="button">
          Look at other vehicles
        </button>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <CalendarDays className="text-[var(--primary)]" size={18} />
          When do you need it?
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
            From
            <input className={inputClass} min={today} onChange={(event) => setStartDate(event.target.value || today)} type="date" value={startDate} />
          </label>
          <label className={`block text-sm font-semibold text-[var(--foreground-secondary)] ${longTerm ? "opacity-50" : ""}`}>
            Until
            <input className={inputClass} disabled={longTerm} min={addDays(startDate, 1)} onChange={(event) => setEndDate(event.target.value)} type="date" value={longTerm ? "" : endDate} />
          </label>
        </div>
        <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2 text-sm text-[var(--foreground)]">
          <input checked={longTerm} className="h-4 w-4" onChange={(event) => setLongTerm(event.target.checked)} type="checkbox" />
          Long term, no fixed return date yet
        </label>
      </section>

      <p className="px-1 text-sm font-semibold text-[var(--foreground-secondary)]">
        {vehicles.length === 0
          ? "No vehicles are listed yet."
          : !datesReady
            ? "Choose your dates to see what is free."
            : `${freeCount} of ${vehicles.length} free${end ? ` · ${shortDate(startDate)} to ${shortDate(end)}` : ` from ${shortDate(startDate)}`}`}
      </p>

      <section className="space-y-3">
        {rows.map(({ vehicle, free, freeFrom, openEndedClash }) => {
          const headline = headlineRate(vehicle);
          const estimate = days ? estimateRental(vehicle, days) : null;
          const otherRates = [
            vehicle.dailyRate > 0 && headline?.per !== "day" ? `${money(vehicle.dailyRate)} / day` : null,
            vehicle.weeklyRate > 0 && headline?.per !== "week" ? `${money(vehicle.weeklyRate)} / week` : null
          ].filter(Boolean);
          const isOpen = openId === vehicle.id;
          return (
            <article className={`rounded-2xl border bg-white p-4 shadow-sm ${free ? "border-[var(--border)]" : "border-[var(--border)] opacity-70"}`} key={vehicle.id}>
              <div className="flex items-start gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                  <VehicleKindIcon boxed={false} kind={vehicle.kind} size={26} />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold leading-tight">{vehicle.name}</h3>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{[vehicle.year, vehicle.color, ...vehicle.details].filter(Boolean).join(" · ")}</p>
                  {headline ? (
                    <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                      {money(headline.amount)} <span className="text-sm font-medium text-[var(--muted)]">/ {headline.per}</span>
                      {otherRates.length ? <span className="ml-2 text-sm font-medium text-[var(--muted)]">{otherRates.join(" · ")}</span> : null}
                    </p>
                  ) : null}
                  {free && estimate && days ? (
                    <p className="mt-1 text-sm text-[var(--primary)]">
                      About {money(estimate)} for {days} {days === 1 ? "day" : "days"}
                    </p>
                  ) : null}
                  {!free ? (
                    <p className="mt-1 text-sm font-semibold text-[#b45309]">
                      {freeFrom ? `Taken for these dates · free from ${shortDate(freeFrom)}` : openEndedClash ? "On a long-term rental" : "Taken for these dates"}
                    </p>
                  ) : null}
                </div>
                {free && datesReady ? (
                  <button
                    className={`pressable min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${isOpen ? "border border-[var(--border)] bg-white text-[var(--foreground)]" : "bg-[var(--primary)] text-white"}`}
                    onClick={() => {
                      setError(null);
                      setOpenId(isOpen ? null : vehicle.id);
                    }}
                    type="button"
                  >
                    {isOpen ? "Close" : "Request"}
                  </button>
                ) : null}
              </div>

              {isOpen ? (
                <form action={(formData) => send(formData, vehicle)} className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
                      Your name
                      <input autoComplete="name" className={inputClass} name="name" required />
                    </label>
                    <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
                      Phone or WhatsApp
                      <input autoComplete="tel" className={inputClass} inputMode="tel" name="phone" placeholder="+66 ..." required />
                    </label>
                  </div>
                  <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
                    Anything we should know? <span className="font-normal text-[var(--muted)]">(optional)</span>
                    <textarea className={inputClass} name="message" placeholder="Where you are staying, delivery time, questions..." rows={2} />
                  </label>
                  {/* Hidden from people; bots fill it in and are ignored. */}
                  <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
                  {error ? <p className="text-sm font-semibold text-[#dc2626]">{error}</p> : null}
                  <button className="pressable min-h-12 w-full rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                    {isPending ? "Sending…" : "Send request"}
                  </button>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    No payment now. {organizationName} will confirm the price and send you a booking link. The vehicle is held for you for {holdHours} hours.
                  </p>
                </form>
              ) : null}
            </article>
          );
        })}
      </section>
    </>
  );
}
