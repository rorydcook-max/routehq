"use client";

import { customerDate } from "@/lib/i18n/customer-dates";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { bookOnline } from "@/app/actions/online-booking";
import { VehicleArt } from "@/components/vehicle-art";
import type { CatalogVehicle } from "@/lib/public-catalog";
import { clashes } from "@/lib/booking-rules";
import { daysBetween, headlineRate, minimumStay, planFor } from "@/lib/rental-estimate";
import { billingPeriodAmounts } from "@/lib/payment-schedule";
import { extrasFor, priceExtras, seasonalRate, type Extra, type Season } from "@/lib/price-rules";
import { isTwoWheeler } from "@/lib/vehicle-groups";

const inputClass = "mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDate(iso: string, locale = "en") {
  return customerDate(iso, locale, false);
}

export function Catalog({
  slug,
  organizationName,
  vehicles,
  currency,
  deposit,
  holdHours,
  gapDays,
  today,
  offer = "both_monthly",
  seasons = [],
  extras = [],
  initialStart,
  initialEnd,
  initialVehicleId,
  source,
  embedded = false
}: {
  /** Shown in the booking box on the business's own website (embed.js). */
  embedded?: boolean;
  slug: string;
  organizationName: string;
  vehicles: CatalogVehicle[];
  currency: string;
  deposit: number;
  holdHours: number;
  gapDays: number;
  /** The first date a booking may start (today, or later when the business needs notice). */
  today: string;
  /** Monthly, set dates, or both: the business decides in Settings. */
  offer?: string;
  seasons?: Season[];
  extras?: Extra[];
  /** Arriving from the directory: the dates and vehicle they already chose. */
  initialStart?: string | null;
  initialEnd?: string | null;
  initialVehicleId?: string | null;
  source?: string | null;
}) {
  const t = useTranslations("customer");
  const locale = useLocale();
  const router = useRouter();
  const [startDate, setStartDate] = useState(initialStart && initialStart >= today ? initialStart : today);
  const [endDate, setEndDate] = useState(initialEnd || "");
  const [longTerm, setLongTerm] = useState(initialEnd ? offer === "monthly" : offer === "monthly" || offer === "both_monthly");
  const bothOffered = offer === "both_monthly" || offer === "both_dates";
  const [openId, setOpenId] = useState<string | null>(initialVehicleId || null);
  const [error, setError] = useState<string | null>(null);
  const [chosen, setChosen] = useState<string[]>([]);
  const [isPending, startTransition] = useTransition();
  const [continueHref, setContinueHref] = useState<string | null>(null);

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
          // Vehicles the customer can book for these dates come first; ones that only rent by the month (or are taken) after.
          const bookable = !clash && !!planFor(vehicle, days);
          return { vehicle, free: !clash, bookable, freeFrom, openEndedClash: !!clash && !clash.endDate };
        })
        .sort((a, b) => Number(b.bookable) - Number(a.bookable) || Number(b.free) - Number(a.free) || (a.freeFrom || "9999").localeCompare(b.freeFrom || "9999")),
    [vehicles, startDate, end, days, datesReady, gapDays]
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
        formData.set("extraIds", JSON.stringify(chosen));
        if (source) formData.set("source", source);
        const result = await bookOnline(formData);
        if (!result.ok) {
          setError(result.error);
          // Someone else may have taken it meanwhile: show what is free now.
          router.refresh();
          return;
        }
        // Straight on to their details and the agreement. A full page load, so the
        // customer never sees the staff app's loading screen in between.
        if (embedded && window.parent !== window) {
          // In the booking box on the business's own site: the page around it carries on at RouteHQ (documents and
          // signing need the whole screen); a link stays here in case that page can't.
          const href = new URL(result.href, window.location.origin).toString();
          window.parent.postMessage({ type: "routehq:continue", href }, "*");
          setContinueHref(href);
          return;
        }
        window.location.assign(result.href);
      } catch {
        setError(t("bookingFailed"));
      }
    });
  }

  if (continueHref) {
    return (
      <section className="rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">{t("embedBooked")}</h2>
        <a className="primary-action pressable mt-4 inline-flex" href={continueHref} rel="noopener" target="_top">
          {t("embedContinue")}
        </a>
      </section>
    );
  }

  return (
    <>
      <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
          <CalendarDays className="text-[var(--primary)]" size={18} />
          {t("whenDoYouNeedIt")}
        </div>
        <div aria-label={t("typeOfRental")} className={`mt-3 grid-cols-2 gap-1 rounded-xl bg-[var(--panel-secondary)] p-1 text-sm font-semibold ${bothOffered ? "grid" : "hidden"}`} role="group">
          <button aria-pressed={longTerm} className={`min-h-11 rounded-lg px-2 ${longTerm ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setLongTerm(true)} type="button">
            {t("monthly")}
          </button>
          <button aria-pressed={!longTerm} className={`min-h-11 rounded-lg px-2 ${!longTerm ? "bg-white text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]"}`} onClick={() => setLongTerm(false)} type="button">
            {t("setDates")}
          </button>
        </div>
        <p className="mt-2 text-sm leading-5 text-[var(--muted)]">
          {longTerm
            ? t("monthlyExplain")
            : t("setDatesExplain")}
        </p>
        <div className={`mt-3 grid gap-3 ${longTerm ? "" : "sm:grid-cols-2"}`}>
          <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
            {longTerm ? t("starting") : t("from")}
            <input className={inputClass} min={today} onChange={(event) => setStartDate(event.target.value || today)} type="date" value={startDate} />
          </label>
          {longTerm ? null : (
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("until")}
              <input className={inputClass} min={addDays(startDate, 1)} onChange={(event) => setEndDate(event.target.value)} type="date" value={endDate} />
            </label>
          )}
        </div>
      </section>

      <p className="px-1 text-sm font-semibold text-[var(--foreground-secondary)]">
        {vehicles.length === 0
          ? t("noVehiclesListed")
          : !datesReady
            ? t("chooseDatesToSee")
            : end
              ? t("freeCountDates", { free: freeCount, total: vehicles.length, start: shortDate(startDate, locale), end: shortDate(end, locale) })
              : t("freeCountMonthly", { free: freeCount, total: vehicles.length, start: shortDate(startDate, locale) })}
      </p>

      <section className="grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ vehicle, free, freeFrom, openEndedClash }) => {
          const headline = headlineRate(vehicle);
          // A monthly-only vehicle can't be booked for a weekend.
          const basePlan = planFor(vehicle, days);
          // High season: the price for these dates, not the usual one.
          const season = basePlan ? seasonalRate(basePlan.rate, basePlan.pricingModel, seasons, startDate, end) : null;
          const plan = basePlan && season ? { ...basePlan, rate: season.rate } : basePlan;
          const offered = extrasFor(extras, isTwoWheeler(vehicle.kind));
          const pricedExtras = priceExtras(offered.filter((extra) => chosen.includes(extra.id)), days);
          const bookable = !!plan;
          // Exactly what this booking will be charged, worked out the way the payments are: a day price for each day,
          // or one payment for each week or month started. Never an "about" figure the booking then disagrees with.
          const amounts = plan && days && end ? (plan.pricingModel === "daily" ? [days * plan.rate] : billingPeriodAmounts(startDate, end, plan.pricingModel, plan.rate, 52)) : [];
          const stayTotal = amounts.length > 0 ? amounts.reduce((sum, amount) => sum + amount, 0) : null;
          const lastPart = amounts.length > 1 && amounts[amounts.length - 1] !== plan?.rate ? amounts[amounts.length - 1] : null;
          const wholePeriods = plan?.pricingModel === "daily" ? days || 0 : amounts.length - (lastPart !== null ? 1 : 0);
          const tooShort = datesReady && free && !bookable ? (longTerm ? t("notOfferedMonthly") : minimumStay(vehicle) === "Minimum 1 week" ? t("minimumOneWeek") : minimumStay(vehicle) ? t("minimumOneMonth") : null) : null;
          const otherRates = [
            // A business that only rents by the month does not show prices customers cannot book at.
            offer !== "monthly" && vehicle.dailyRate > 0 && headline?.per !== "day" ? t("perDay", { rate: money(vehicle.dailyRate) }) : null,
            offer !== "monthly" && vehicle.weeklyRate > 0 && headline?.per !== "week" ? t("perWeek", { rate: money(vehicle.weeklyRate) }) : null
          ].filter(Boolean);
          const isOpen = openId === vehicle.id;
          const headlineKey = headline ? (headline.per === "day" ? "perDay" : headline.per === "week" ? "perWeek" : "perMonth") : null;
          // "฿11,000" big, "/ month" small: the unit is whatever the translation puts around the amount.
          const unit = headlineKey ? t(headlineKey, { rate: "" }).trim() : "";
          const canBook = free && datesReady && bookable;
          return (
            <article className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-white shadow-sm ${isOpen ? "sm:col-span-2 lg:col-span-3" : ""}`} key={vehicle.id}>
              <div className={`relative ${isOpen ? "sm:flex sm:items-start sm:gap-5 sm:p-5" : ""}`}>
                <div className={`relative aspect-[16/10] bg-[var(--panel-secondary)] ${isOpen ? "sm:w-64 sm:shrink-0 sm:overflow-hidden sm:rounded-xl" : ""} ${!free ? "opacity-70" : ""}`}>
                  {vehicle.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={vehicle.name} className="h-full w-full object-cover" src={vehicle.photoUrl} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <VehicleArt className="!h-full !w-full !rounded-none" colour={vehicle.color} kind={vehicle.kind} model={vehicle.name} size="xl" />
                    </div>
                  )}
                  {!free ? (
                    <span className="absolute left-3 top-3 rounded-full bg-[var(--foreground)]/80 px-3 py-1 text-xs font-bold text-white">
                      {openEndedClash ? t("onLongTermRental") : t("takenForDates")}
                    </span>
                  ) : null}
                </div>
                <div className={`flex min-w-0 flex-1 flex-col ${isOpen ? "p-4 sm:p-0" : "p-4"}`}>
                  <h3 className="text-[17px] font-bold leading-tight text-[var(--foreground)]">{vehicle.name}</h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">{[vehicle.year, vehicle.color, ...vehicle.details].filter(Boolean).join(" · ")}</p>
                  {headline ? (
                    <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                      <span className="text-[22px] font-bold leading-none text-[var(--foreground)]">{money(headline.amount)}</span>
                      {unit ? <span className="text-sm font-semibold text-[var(--muted)]">{unit}</span> : null}
                    </p>
                  ) : null}
                  {otherRates.length ? <p className="mt-1 text-sm text-[var(--muted)]">{otherRates.join(" · ")}</p> : null}
                  {vehicle.deposit > 0 ? <p className="mt-1 text-sm text-[var(--muted)]">{t("depositReturnedAtEnd", { amount: money(vehicle.deposit) })}</p> : null}
                  {/* No price for a stay the vehicle can't be booked for: a slice of the monthly rate is not on offer. */}
                  {free && plan && stayTotal && !tooShort ? (
                    <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
                      {money(stayTotal)} = {wholePeriods} × {t(plan.pricingModel === "daily" ? "perDay" : plan.pricingModel === "weekly" ? "perWeek" : "perMonth", { rate: money(plan.rate) })}
                      {lastPart !== null ? ` + ${money(lastPart)}` : ""}
                    </p>
                  ) : null}
                  {free && plan && season?.pct && !tooShort ? (
                    <p className="mt-0.5 text-sm font-semibold text-[var(--warning)]">
                      {season.seasonDays > 0 && season.seasonDays < season.days
                          ? t(season.pct > 0 ? "seasonPricePart" : "seasonDiscountPart", { pct: Math.abs(season.pct), names: season.names.join(", ") || t("highSeason"), inDays: season.seasonDays, days: season.days })
                          : t(season.pct > 0 ? "seasonPrice" : "seasonDiscount", { pct: Math.abs(season.pct), names: season.names.join(", ") || t("highSeason") })}
                    </p>
                  ) : null}
                  {tooShort ? <p className="mt-2 text-sm font-semibold text-[var(--warning)]">{tooShort}</p> : null}
                  {!free && freeFrom ? (
                    <button
                      className="pressable mt-3 inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-full border-2 border-[var(--primary)] bg-white px-4 text-sm font-bold text-[var(--primary)]"
                      onClick={() => {
                        // Keep the length of stay they asked for, starting when this vehicle is free.
                        const length = end ? daysBetween(startDate, end) : 0;
                        setStartDate(freeFrom);
                        if (end && length > 0) setEndDate(addDays(freeFrom, length));
                        window.scrollTo({ top: 0, behavior: "smooth" });
                      }}
                      type="button"
                    >
                      {t("startFrom", { date: shortDate(freeFrom, locale) })}
                    </button>
                  ) : null}
                  {canBook ? (
                    <div className="mt-auto pt-4">
                      <button
                        className={`pressable inline-flex min-h-12 w-full items-center justify-center rounded-full px-4 text-[15px] font-bold ${isOpen ? "border-2 border-[var(--border)] bg-white text-[var(--foreground)] sm:w-auto sm:px-8" : "bg-[var(--primary)] text-white"}`}
                        onClick={() => {
                          setError(null);
                          setChosen([]);
                          setOpenId(isOpen ? null : vehicle.id);
                        }}
                        type="button"
                      >
                        {isOpen ? t("close") : t("book")}
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              {isOpen ? (
                <form action={(formData) => send(formData, vehicle)} className="space-y-3 border-t border-[var(--border)] p-4 sm:p-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
                      {t("yourName")}
                      <input autoComplete="name" className={inputClass} name="name" required />
                    </label>
                    <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
                      {t("phoneOrWhatsApp")}
                      <input autoComplete="tel" className={inputClass} inputMode="tel" name="phone" placeholder="+66 ..." required />
                    </label>
                  </div>
                  {offered.length ? (
                    <fieldset>
                      <legend className="text-sm font-semibold text-[var(--foreground-secondary)]">{t("addExtras")}</legend>
                      <div className="mt-2 grid gap-2 sm:grid-cols-2">
                        {offered.map((extra) => (
                          <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--border)] px-3 py-2 text-sm font-semibold text-[var(--foreground)]" key={extra.id}>
                            <input checked={chosen.includes(extra.id)} onChange={(event) => setChosen((list) => (event.target.checked ? [...list, extra.id] : list.filter((id) => id !== extra.id)))} type="checkbox" />
                            <span className="min-w-0 flex-1">{extra.name}</span>
                            <span className="shrink-0 text-xs text-[var(--muted)]">{t(extra.per === "day" ? "extraPerDay" : "extraOnce", { amount: money(extra.price) })}</span>
                          </label>
                        ))}
                      </div>
                      {pricedExtras.upfront > 0 || pricedExtras.monthly > 0 ? (
                        <p className="mt-2 text-xs text-[var(--muted)]">
                          {pricedExtras.upfront > 0 ? t("extrasAtStart", { amount: money(pricedExtras.upfront) }) : ""}
                          {pricedExtras.monthly > 0 ? ` ${t("extrasEachMonth", { amount: money(pricedExtras.monthly) })}` : ""}
                        </p>
                      ) : null}
                    </fieldset>
                  ) : null}
                  {/* Hidden from people; bots fill it in and are ignored. */}
                  <input aria-hidden="true" autoComplete="off" className="hidden" name="website" tabIndex={-1} />
                  {error ? <p className="text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
                  <button className="pressable min-h-12 w-full rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white disabled:opacity-60" disabled={isPending} type="submit">
                    {isPending ? t("booking") : t("bookAndContinue")}
                  </button>
                  <p className="text-xs leading-5 text-[var(--muted)]">
                    {vehicle.deposit > 0 ? `${t("depositApplies", { amount: money(vehicle.deposit) })} ` : ""}{t("noPaymentNow", { hours: holdHours })}
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
