"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { bookOnline } from "@/app/actions/online-booking";
import { VehicleKindIcon } from "@/components/vehicle-kind-icon";
import type { CatalogVehicle } from "@/lib/public-catalog";
import { clashes } from "@/lib/booking-rules";
import { daysBetween, estimateRental, headlineRate, minimumStay, planFor } from "@/lib/rental-estimate";

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
  deposit,
  holdHours,
  gapDays,
  today
}: {
  slug: string;
  organizationName: string;
  vehicles: CatalogVehicle[];
  currency: string;
  deposit: number;
  holdHours: number;
  gapDays: number;
  /** The first date a booking may start (today, or later when the business needs notice). */
  today: string;
}) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [longTerm, setLongTerm] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
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
          const clash = datesReady ? vehicle.busy.find((period) => clashes(startDate, end, period, gapDays)) : null;
          // When it is taken, say when it next comes free (if it has an end date).
          const freeFrom = clash?.endDate && clash.endDate > startDate ? clash.endDate : null;
          return { vehicle, free: !clash, freeFrom, openEndedClash: !!clash && !clash.endDate };
        })
        .sort((a, b) => Number(b.free) - Number(a.free)),
    [vehicles, startDate, end, datesReady, gapDays]
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
        const result = await bookOnline(formData);
        if (!result.ok) {
          setError(result.error);
          // Someone else may have taken it meanwhile: show what is free now.
          router.refresh();
          return;
        }
        // Straight on to their details and the agreement. A full page load, so the
        // customer never sees the staff app's loading screen in between.
        window.location.assign(result.href);
      } catch {
        setError("We couldn't start your booking. Please try again.");
      }
    });
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <CalendarDays className="text-[var(--primary)]" size={18} />
          When do you need it?
        </div>
        <div aria-label="Type of rental" className="mt-3 grid grid-cols-2 gap-1 rounded-xl bg-[#f5f4f1] p-1 text-sm font-semibold" role="group">
          <button aria-pressed={longTerm} className={`min-h-11 rounded-lg px-2 ${longTerm ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setLongTerm(true)} type="button">
            Monthly
          </button>
          <button aria-pressed={!longTerm} className={`min-h-11 rounded-lg px-2 ${!longTerm ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setLongTerm(false)} type="button">
            Set dates
          </button>
        </div>
        <p className="mt-2 text-xs leading-5 text-[var(--muted)]">
          {longTerm
            ? "Open-ended: pay the monthly rate each month and keep the vehicle for as long as you like. Tell us when you want to return it."
            : "Choose your return date. Priced by the day, week or month depending on how long you stay."}
        </p>
        <div className={`mt-3 grid gap-3 ${longTerm ? "" : "sm:grid-cols-2"}`}>
          <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
            {longTerm ? "Starting" : "From"}
            <input className={inputClass} min={today} onChange={(event) => setStartDate(event.target.value || today)} type="date" value={startDate} />
          </label>
          {longTerm ? null : (
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              Until
              <input className={inputClass} min={addDays(startDate, 1)} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            </label>
          )}
        </div>
      </section>

      <p className="px-1 text-sm font-semibold text-[var(--foreground-secondary)]">
        {vehicles.length === 0
          ? "No vehicles are listed yet."
          : !datesReady
            ? "Choose your dates to see what is free."
            : `${freeCount} of ${vehicles.length} free${end ? ` · ${shortDate(startDate)} to ${shortDate(end)}` : ` monthly from ${shortDate(startDate)}`}`}
      </p>

      <section className="space-y-3">
        {rows.map(({ vehicle, free, freeFrom, openEndedClash }) => {
          const headline = headlineRate(vehicle);
          const estimate = days ? estimateRental(vehicle, days) : null;
          // A monthly-only vehicle can't be booked for a weekend.
          const bookable = !!planFor(vehicle, days);
          const tooShort = datesReady && free && !bookable ? (longTerm ? "Not offered monthly: choose Set dates to book this one" : minimumStay(vehicle)) : null;
          const otherRates = [
            vehicle.dailyRate > 0 && headline?.per !== "day" ? `${money(vehicle.dailyRate)} / day` : null,
            vehicle.weeklyRate > 0 && headline?.per !== "week" ? `${money(vehicle.weeklyRate)} / week` : null
          ].filter(Boolean);
          const isOpen = openId === vehicle.id;
          return (
            <article className={`rounded-2xl border bg-white p-4 shadow-sm ${free ? "border-[var(--border)]" : "border-[var(--border)] opacity-70"}`} key={vehicle.id}>
              {vehicle.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={vehicle.name} className="mb-3 aspect-[16/9] w-full rounded-xl object-cover sm:hidden" src={vehicle.photoUrl} />
              ) : null}
              <div className="flex items-start gap-3">
                {vehicle.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="hidden h-24 w-36 shrink-0 rounded-xl object-cover sm:block" src={vehicle.photoUrl} />
                ) : (
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                    <VehicleKindIcon boxed={false} kind={vehicle.kind} size={26} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-semibold leading-tight">{vehicle.name}</h3>
                  <p className="mt-0.5 text-sm text-[var(--muted)]">{[vehicle.year, vehicle.color, ...vehicle.details].filter(Boolean).join(" · ")}</p>
                  {headline ? (
                    <p className="mt-2 text-base font-semibold text-[var(--foreground)]">
                      {money(headline.amount)} <span className="text-sm font-medium text-[var(--muted)]">/ {headline.per}</span>
                      {otherRates.length ? <span className="ml-2 text-sm font-medium text-[var(--muted)]">{otherRates.join(" · ")}</span> : null}
                    </p>
                  ) : null}
                  {vehicle.deposit > 0 ? <p className="mt-0.5 text-sm text-[var(--muted)]">{money(vehicle.deposit)} deposit, returned at the end</p> : null}
                  {free && estimate && days ? (
                    <p className="mt-1 text-sm text-[var(--primary)]">
                      About {money(estimate)} for {days} {days === 1 ? "day" : "days"}
                    </p>
                  ) : null}
                  {tooShort ? <p className="mt-1 text-sm font-semibold text-[#b45309]">{longTerm ? tooShort : `${tooShort} for this vehicle`}</p> : null}

                  {!free ? (
                    <p className="mt-1 text-sm font-semibold text-[#b45309]">
                      {freeFrom ? `Taken for these dates · free from ${shortDate(freeFrom)}` : openEndedClash ? "On a long-term rental" : "Taken for these dates"}
                    </p>
                  ) : null}
                </div>
                {free && datesReady && bookable ? (
                  <button
                    className={`pressable min-h-11 shrink-0 rounded-xl px-4 text-sm font-semibold ${isOpen ? "border border-[var(--border)] bg-white text-[var(--foreground)]" : "bg-[var(--primary)] text-white"}`}
                    onClick={() => {
                      setError(null);
                      setOpenId(isOpen ? null : vehicle.id);
                    }}
                    type="button"
                  >
                    {isOpen ? "Close" : "Book"}
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
                  {/* Hidden from people; bots fill it in and are ignored. */}
                  <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
                  {error ? <p className="text-sm font-semibold text-[#dc2626]">{error}</p> : null}
                  <button className="pressable min-h-12 w-full rounded-xl bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                    {isPending ? "Booking…" : "Book and continue"}
                  </button>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    {vehicle.deposit > 0 ? `A ${money(vehicle.deposit)} deposit applies. ` : ""}No payment is taken now: you can pay online or when you get the vehicle. Next you add your details and sign the
                    agreement. The vehicle is held for you for {holdHours} hours while you do that.
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
