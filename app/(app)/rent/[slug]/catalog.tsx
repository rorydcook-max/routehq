"use client";

import { customerDate } from "@/lib/i18n/customer-dates";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { CalendarDays } from "lucide-react";
import { bookOnline } from "@/app/actions/online-booking";
import { VehicleArt } from "@/components/vehicle-art";
import { PhotoGallery } from "@/components/photo-gallery";
import type { CatalogVehicle } from "@/lib/public-catalog";
import { clashes } from "@/lib/booking-rules";
import { daysBetween, headlineRate, minimumStay, planFor } from "@/lib/rental-estimate";
import { billingPeriodAmounts } from "@/lib/payment-schedule";
import { extrasFor, priceExtras, seasonalRate, type Extra, type Season } from "@/lib/price-rules";
import { isTwoWheeler } from "@/lib/vehicle-groups";
import { formatMoney as formatRegionalMoney } from "@/lib/regional";

// The app's standard 44px field: the same height on every public page.
const inputClass = "mt-1.5 w-full text-base";

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
  referrer = null,
  embedded = false,
  rates = {},
  visitorCurrency = null,
  layout = "grid",
  monthlyFocus = false,
  demo = false
}: {
  /** How the booking page's template lays the vehicles out (lib/booking-site.ts): cards, a dense list, or small tiles two to a row on phones. */
  layout?: "grid" | "list" | "tiles";
  /** The monthly-rentals template: a rough price per day under each monthly price. */
  monthlyFocus?: boolean;
  /** An example page (rovehq.io/booking-pages): everything works except making the booking. */
  demo?: boolean;
  /** One unit of the business's currency in other currencies, for the "about" price beside each one. */
  rates?: Record<string, number>;
  /** The renter's likely currency (from their country or language); they can change it. */
  visitorCurrency?: string | null;
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
  /** A partner business that sent this customer (?ref=): checked on the server when they book. */
  referrer?: string | null;
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

  // Baht as before; pounds and euros with their symbol (£1,250, €45.50).
  const money = (value: number) => (currency === "THB" ? `฿${Math.round(value).toLocaleString("en-US")}` : formatRegionalMoney(value, currency, "en-GB"));
  // Beside each price, roughly what it is in the renter's own currency (Rory, 2 Nov 2026). They pay in the business's currency;
  // this is a guide. Their pick is remembered on this device.
  const otherCodes = Object.keys(rates).sort();
  const [shownCurrency, setShownCurrency] = useState<string>(() => (visitorCurrency && rates[visitorCurrency] ? visitorCurrency : ""));
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("rove.currency");
      if (saved !== null && (saved === "" || rates[saved])) setShownCurrency(saved);
    } catch {
      // Private browsing: the guess from their country stands.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const pickCurrency = (code: string) => {
    setShownCurrency(code);
    try {
      window.localStorage.setItem("rove.currency", code);
    } catch {
      // Not remembered; still shown for this visit.
    }
  };
  const approx = (value: number) => {
    const rate = shownCurrency ? rates[shownCurrency] : 0;
    if (!rate || !value) return "";
    const converted = value * rate;
    try {
      return `≈ ${new Intl.NumberFormat(locale, { style: "currency", currency: shownCurrency, maximumFractionDigits: converted >= 100 ? 0 : 2 }).format(converted)}`;
    } catch {
      return `≈ ${shownCurrency} ${Math.round(converted).toLocaleString("en-US")}`;
    }
  };
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
  // The first vehicle to come free when none are (rows are sorted by that date).
  const earliest = rows.find((row) => row.freeFrom) || null;

  const list = layout === "list";
  const tiles = layout === "tiles";

  function send(formData: FormData, vehicle: CatalogVehicle) {
    setError(null);
    if (demo) {
      // An example business: say so instead of booking anything.
      setError(t("bs_demoNoBooking"));
      return;
    }
    startTransition(async () => {
      try {
        formData.set("slug", slug);
        formData.set("vehicleId", vehicle.id);
        formData.set("startDate", startDate);
        formData.set("endDate", end || "");
        formData.set("extraIds", JSON.stringify(chosen));
        if (source) formData.set("source", source);
        if (referrer) formData.set("ref", referrer);
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
          // In the booking box on the business's own site: the page around it carries on at RoveHQ (documents and
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
        {/* The app's one segmented control: tinted track, the chosen option white, the other in readable ink. */}
        <div aria-label={t("typeOfRental")} className={`mt-3 w-full grid-cols-2 gap-1 rounded-full bg-[var(--panel-tertiary)] p-1 text-sm font-bold sm:w-auto ${bothOffered ? "grid sm:inline-grid" : "hidden"}`} role="group">
          <button aria-pressed={longTerm} className={`min-h-10 rounded-full px-5 ${longTerm ? "bg-white text-[var(--foreground)] shadow-[0_1px_3px_rgba(19,38,43,0.12)]" : "text-[var(--foreground-secondary)]"}`} onClick={() => setLongTerm(true)} type="button">
            {t("monthly")}
          </button>
          <button aria-pressed={!longTerm} className={`min-h-10 rounded-full px-5 ${!longTerm ? "bg-white text-[var(--foreground)] shadow-[0_1px_3px_rgba(19,38,43,0.12)]" : "text-[var(--foreground-secondary)]"}`} onClick={() => setLongTerm(false)} type="button">
            {t("setDates")}
          </button>
        </div>
        <p className="measure mt-2 text-sm leading-5 text-[var(--muted)]">
          {longTerm
            ? t("monthlyExplain")
            : t("setDatesExplain")}
        </p>
        {/* Two columns either way, so a lone start date isn't stretched across the whole card. */}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
        {/* Prices are in the business's currency; the renter can also see roughly what that is in theirs (Rory, 2 Nov 2026). */}
        {otherCodes.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-[var(--border)] pt-3 text-sm text-[var(--muted)]">
            <label className="flex items-center gap-2 font-semibold text-[var(--foreground-secondary)]">
              {t("cur_also")}
              <select className="min-h-9 rounded-lg border border-[var(--border)] bg-white px-2 text-sm text-[var(--foreground)]" onChange={(event) => pickCurrency(event.target.value)} value={shownCurrency}>
                <option value="">{t("cur_off")}</option>
                {otherCodes.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
            </label>
            {shownCurrency ? <span>{t("cur_note", { currency: currency === "THB" ? "฿ (THB)" : currency })}</span> : null}
          </div>
        ) : null}
      </section>

      {datesReady && vehicles.length > 0 && freeCount === 0 ? (
        // Nothing free: say so plainly, with the earliest date anything comes free, in a notice rather than a grey line.
        <div className="rounded-2xl bg-[var(--warning-light)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
          {earliest
            ? t("noneFreeEarliest", { start: shortDate(startDate, locale), date: shortDate(earliest.freeFrom as string, locale), vehicle: earliest.vehicle.name })
            : t("noneFree", { start: shortDate(startDate, locale) })}
        </div>
      ) : (
        <p className="px-1 text-sm font-semibold text-[var(--foreground-secondary)]">
          {vehicles.length === 0
            ? t("noVehiclesListed")
            : !datesReady
              ? t("chooseDatesToSee")
              : end
                ? t("freeCountDates", { free: freeCount, total: vehicles.length, start: shortDate(startDate, locale), end: shortDate(end, locale) })
                : t("freeCountMonthly", { free: freeCount, total: vehicles.length, start: shortDate(startDate, locale) })}
        </p>
      )}

      <section className={list ? "grid gap-2.5" : tiles ? "grid grid-cols-2 items-stretch gap-3 lg:grid-cols-4" : "grid items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"}>
        {rows.map(({ vehicle, free, freeFrom, openEndedClash }) => {
          const headline = headlineRate(vehicle);
          // A monthly-only vehicle can't be booked for a weekend.
          const basePlan = planFor(vehicle, days);
          // High season: the price for these dates, not the usual one.
          const season = basePlan ? seasonalRate(basePlan.rate, basePlan.pricingModel, seasons, startDate, end) : null;
          const plan = basePlan && season ? { ...basePlan, rate: season.rate } : basePlan;
          const offered = extrasFor(extras, isTwoWheeler(vehicle.kind), vehicle.id);
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
            <article className={`flex flex-col overflow-hidden border border-[var(--border)] bg-white shadow-sm ${list ? "rounded-xl" : "rounded-2xl"} ${isOpen ? (tiles ? "col-span-2 lg:col-span-4" : list ? "" : "sm:col-span-2 lg:col-span-3") : ""}`} key={vehicle.id}>
              <div className={`relative ${isOpen ? "sm:flex sm:items-start sm:gap-5 sm:p-5" : list ? "flex flex-1 flex-row" : "flex flex-1 flex-col"}`}>
                {/* Opened: the main photo large with the others as thumbnails, any of them full screen with a tap.
                    Closed: the main photo in the 4:3 shape phone cameras take, so cars aren't cropped to a strip (Rory, 1 Nov 2026). */}
                {isOpen && vehicle.photoUrls.length > 0 ? (
                  <div className="relative p-3 pb-0 sm:w-80 sm:shrink-0 sm:p-0">
                    <PhotoGallery
                      alt={vehicle.name}
                      dimmed={!free}
                      overlay={
                        !free ? (
                          <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[var(--foreground)] shadow-sm">
                            {openEndedClash ? t("onLongTermRental") : freeFrom ? t("bookedUntil", { date: shortDate(freeFrom, locale) }) : t("takenForDates")}
                          </span>
                        ) : null
                      }
                      photos={vehicle.photoUrls}
                    />
                  </div>
                ) : (
                <div className={`relative bg-[var(--panel-secondary)] ${list && !isOpen ? "w-28 shrink-0 self-stretch sm:w-44" : "aspect-[4/3] w-full"} ${isOpen ? "sm:w-80 sm:shrink-0 sm:overflow-hidden sm:rounded-xl" : ""} ${!free ? "[&>div]:opacity-60 [&>img]:opacity-60" : ""}`}>
                  {vehicle.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt={vehicle.name} className={`h-full w-full object-cover ${list && !isOpen ? "absolute inset-0" : ""}`} src={vehicle.photoUrl} />
                  ) : (
                    <div className={`flex h-full w-full items-center justify-center ${list && !isOpen ? "absolute inset-0" : ""}`}>
                      <VehicleArt className="!h-full !w-full !rounded-none" colour={vehicle.color} kind={vehicle.kind} model={vehicle.name} size="xl" />
                    </div>
                  )}
                  {!free ? (
                    // A light, neutral badge with dark ink (readable on any photo), saying until when rather than just "taken".
                    <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-bold text-[var(--foreground)] shadow-sm">
                      {openEndedClash ? t("onLongTermRental") : freeFrom ? t("bookedUntil", { date: shortDate(freeFrom, locale) }) : t("takenForDates")}
                    </span>
                  ) : null}
                </div>
                )}
                <div className={`flex min-w-0 flex-1 flex-col ${isOpen ? "p-4 sm:p-0" : list || tiles ? "p-3" : "p-4"}`}>
                  <h3 className={`font-bold leading-tight text-[var(--foreground)] ${tiles && !isOpen ? "text-[15px]" : list && !isOpen ? "text-base" : "text-[17px]"}`}>{vehicle.name}</h3>
                  {/* Every card has the same lines in the same places (a dash where something is missing), so prices and buttons line up across a row. */}
                  <p className={`mt-1 min-h-5 text-[var(--muted)] ${(list || tiles) && !isOpen ? "truncate text-xs leading-5" : "text-sm"}`}>{[vehicle.year, vehicle.color, ...vehicle.details].filter(Boolean).join(" · ") || "—"}</p>
                  {headline ? (
                    <p className={`flex flex-wrap items-baseline gap-x-1.5 ${(list || tiles) && !isOpen ? "mt-2" : "mt-3"}`}>
                      <span className={`font-bold leading-none text-[var(--foreground)] ${tiles && !isOpen ? "text-[19px]" : "text-[22px]"}`}>{money(headline.amount)}</span>
                      {unit ? <span className="text-sm font-semibold text-[var(--muted)]">{unit}</span> : null}
                      {/* Small tiles have no room for the "about" price; it shows once the vehicle is opened. */}
                      {approx(headline.amount) && !(tiles && !isOpen) ? <span className="text-sm font-semibold text-[var(--foreground-secondary)]">· {approx(headline.amount)}</span> : null}
                    </p>
                  ) : null}
                  {/* Monthly rentals: roughly what a month comes to each day, worked out from the monthly price (30 days). */}
                  {monthlyFocus && headline?.per === "month" ? (
                    <p className="mt-1 text-sm font-semibold text-[var(--primary)]">{t("bs_aboutPerDay", { amount: money(headline.amount / 30) })}</p>
                  ) : null}
                  <p className={`mt-1 min-h-5 text-sm text-[var(--muted)] ${(list || tiles) && !isOpen && !otherRates.length ? "hidden" : ""}`}>{otherRates.length ? otherRates.join(" · ") : " "}</p>
                  {/* The dense list leaves the deposit to the booking form, where it is spelled out before booking. */}
                  <p className={`mt-1 text-[var(--muted)] ${tiles && !isOpen ? "text-xs" : "text-sm"} ${list && !isOpen ? "hidden" : ""}`}>{vehicle.deposit > 0 ? t("depositReturnedAtEnd", { amount: money(vehicle.deposit) }) : t("noDeposit")}</p>
                  {/* No price for a stay the vehicle can't be booked for: a slice of the monthly rate is not on offer. */}
                  {free && plan && stayTotal && !tooShort ? (
                    <p className="mt-1 text-sm font-semibold text-[var(--primary)]">
                      {money(stayTotal)} = {wholePeriods} × {t(plan.pricingModel === "daily" ? "perDay" : plan.pricingModel === "weekly" ? "perWeek" : "perMonth", { rate: money(plan.rate) })}
                      {lastPart !== null ? ` + ${money(lastPart)}` : ""}
                      {approx(stayTotal) ? <span className="font-medium text-[var(--foreground-secondary)]"> ({approx(stayTotal)})</span> : null}
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
                    // Pinned to the bottom of the card, like Book, so the buttons in a row share one line.
                    <div className="mt-auto pt-4">
                    <button
                      className="pressable inline-flex min-h-12 w-full items-center justify-center whitespace-nowrap rounded-full border-2 border-[var(--primary)] bg-white px-4 text-[15px] font-bold text-[var(--primary)]"
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
                    </div>
                  ) : null}
                  {canBook ? (
                    <div className={`mt-auto ${(list || tiles) && !isOpen ? "pt-3" : "pt-4"}`}>
                      <button
                        className={`pressable inline-flex ${(list || tiles) && !isOpen ? "min-h-11" : "min-h-12"} ${list && !isOpen ? "w-auto self-start px-7" : "w-full px-4"} items-center justify-center rounded-full text-[15px] font-bold ${isOpen ? "border-2 border-[var(--border)] bg-white text-[var(--foreground)] sm:w-auto sm:px-8" : "bg-[var(--primary)] text-white"}`}
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
                            <span className="shrink-0 text-xs text-[var(--muted)]">{extra.price > 0 ? t(extra.per === "day" ? "extraPerDay" : "extraOnce", { amount: money(extra.price) }) : t("extraFree")}</span>
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
