"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { BadgeCheck, CalendarX, CreditCard, MapPin, ShieldCheck, Truck, Wallet } from "lucide-react";
import { Catalog } from "@/app/(app)/rent/[slug]/catalog";
import { headlineRate } from "@/lib/rental-estimate";
import { bookingPanelVars } from "@/lib/sites/palettes";
import { kindsOffered } from "@/lib/sites/format";
import type { SitePolicy } from "@/lib/sites/types";
import { useSite } from "../site-context";
import { SectionHead } from "./parts";
import s from "../site.module.css";

const POLICY_ICONS: Record<SitePolicy["id"], typeof Truck> = { delivery: Truck, deposit: Wallet, insurance: ShieldCheck, requirements: BadgeCheck, payment: CreditCard, cancellation: CalendarX };

/** Rounds up to a tidy figure for the budget choices (1,240 → 1,300; 380 → 400). */
function tidy(value: number) {
  const step = value >= 10000 ? 1000 : value >= 1000 ? 100 : value >= 100 ? 50 : 10;
  return Math.ceil(value / step) * step;
}

/**
 * The booking section: what the renter is after (kind of vehicle, budget), then the real availability and booking
 * flow (the shared Catalog, the same one every RoveHQ booking page uses), and the business's policies from Settings.
 */
export function Booking() {
  const { data, template, palette, t, money, picked } = useSite();
  const layout = template.layout.booking;
  const kinds = kindsOffered(data.vehicles.map((vehicle) => vehicle.kind));
  const [kind, setKind] = useState<string>("all");
  const [budget, setBudget] = useState(0);

  // The unit most prices are in (a day, a week or a month), for the budget choices.
  const rates = data.vehicles.map((vehicle) => headlineRate(vehicle)).filter(Boolean) as Array<{ amount: number; per: "day" | "week" | "month" }>;
  const per = (["day", "month", "week"] as const).map((unit) => ({ unit, n: rates.filter((rate) => rate.per === unit).length })).sort((a, b) => b.n - a.n)[0]?.unit || "day";
  const budgets = useMemo(() => {
    const amounts = rates.filter((rate) => rate.per === per).map((rate) => rate.amount).sort((a, b) => a - b);
    if (amounts.length < 4) return [];
    const picks = [0.34, 0.67].map((q) => tidy(amounts[Math.min(amounts.length - 1, Math.floor(q * amounts.length))]));
    return picks.filter((value, index) => value > 0 && picks.indexOf(value) === index && value < amounts[amounts.length - 1]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.vehicles, per]);

  // A fleet card's Book shows every vehicle again, so the one picked is in the list.
  useEffect(() => {
    if (!picked) return;
    setKind("all");
    setBudget(0);
  }, [picked]);

  const vehicles = data.vehicles.filter((vehicle) => {
    if (kind !== "all" && vehicle.kind !== kind) return false;
    if (budget) {
      const rate = headlineRate(vehicle);
      if (!rate || rate.per !== per || rate.amount > budget) return false;
    }
    return true;
  });

  const chip = (on: boolean) =>
    `${s.focus} inline-flex min-h-11 items-center rounded-full px-4 text-[15px] font-semibold transition-colors ${on ? "bg-[var(--s-accent)] text-[var(--s-accent-ink)]" : "bg-[var(--s-surface)] text-[var(--s-ink)] shadow-[inset_0_0_0_1.5px_var(--s-line)]"}`;
  const filters =
    kinds.length > 1 || budgets.length ? (
      <div className="flex flex-wrap items-center gap-2">
        {kinds.length > 1 ? (
          <div aria-label={t("filter_kind")} className="flex flex-wrap gap-2" role="group">
            {["all", ...kinds].map((value) => (
              <button aria-pressed={kind === value} className={chip(kind === value)} key={value} onClick={() => setKind(value)} type="button">
                {value === "all" ? t("filter_all") : t(`kind_${value}`)}
              </button>
            ))}
          </div>
        ) : null}
        {budgets.length ? (
          <label className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--s-surface)] ps-4 pe-2 text-[15px] font-semibold shadow-[inset_0_0_0_1.5px_var(--s-line)]">
            <span className={s.muted}>{t("filter_budget")}</span>
            <select
              className="!h-auto !min-h-0 !w-auto cursor-pointer !border-0 !bg-transparent !py-1 !pe-6 !ps-0 !text-[15px] font-semibold !text-[var(--s-ink)] !shadow-none outline-none"
              style={{ colorScheme: palette.dark ? "dark" : "light" }}
              onChange={(event) => setBudget(Number(event.target.value))}
              value={budget}
            >
              <option value={0}>{t("filter_anyBudget")}</option>
              {budgets.map((value) => (
                <option key={value} value={value}>
                  {t(`filter_upTo_${per}`, { amount: money(value) })}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
    ) : null;

  const where = data.areas.length ? (
    <p className={`${s.soft} flex flex-wrap items-center gap-x-4 gap-y-1 text-[15px]`}>
      {data.areas.map((area) => (
        <span className="inline-flex items-center gap-1.5" key={area.name}>
          <MapPin aria-hidden="true" className="text-[var(--s-accent)]" size={16} />
          {area.radiusKm && area.radiusKm > 0 ? t("pol_deliveryWithin", { km: area.radiusKm, place: area.name }) : t("pol_pickupAt", { place: area.name })}
        </span>
      ))}
    </p>
  ) : null;

  // The booking part always sits on a light panel; on light pages it simply blends in.
  const panelStyle = bookingPanelVars(palette) as CSSProperties;
  const boxed = palette.dark || layout === "ticket";
  const catalog = (
    <div className={boxed ? "rounded-[var(--s-r-card)] bg-[#f6f7f8] p-3 text-[var(--foreground)] sm:p-5" : ""} style={panelStyle}>
      <div className="space-y-4">
        <Catalog
          currency={data.catalog.currency}
          demo={data.demo}
          deposit={data.catalog.deposit}
          extras={data.catalog.extras}
          gapDays={data.catalog.gapDays}
          holdHours={data.catalog.holdHours}
          initialEnd={data.catalog.initialEnd}
          initialStart={data.catalog.initialStart}
          initialVehicleId={picked?.id || data.catalog.initialVehicleId}
          key={picked ? `${picked.id}-${picked.n}` : "catalog"}
          offer={data.catalog.offer}
          organizationName={data.business.name}
          rates={data.catalog.rates}
          referrer={data.catalog.referrer}
          seasons={data.catalog.seasons}
          slug={data.slug}
          source={data.catalog.source}
          today={data.catalog.today}
          vehicles={vehicles}
          visitorCurrency={data.catalog.visitorCurrency}
        />
      </div>
    </div>
  );

  const policies = data.policies.length ? (
    <div aria-labelledby="policies-title">
      <h3 className={`${s.display} text-[26px] sm:text-[30px]`} id="policies-title">
        {t("policies_title")}
      </h3>
      <ul className={`mt-6 grid gap-x-10 gap-y-8 ${layout === "panel" ? "" : "sm:grid-cols-2 lg:grid-cols-3"}`}>
        {data.policies.map((policy) => {
          const Icon = POLICY_ICONS[policy.id];
          return (
            <li className={layout === "ticket" ? `${s.card} p-5` : ""} key={policy.id}>
              <p className="flex items-center gap-2.5 text-[17px] font-bold">
                <Icon aria-hidden="true" className="shrink-0 text-[var(--s-accent)]" size={20} />
                {policy.title}
              </p>
              <ul className={`${s.soft} mt-2 space-y-1.5 text-[15.5px] leading-relaxed`}>
                {policy.lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  ) : null;

  return (
    <section aria-labelledby="book-title" className={`${s.section} ${layout === "open" ? s.raised : ""}`} id="book">
      <div className={s.wrap}>
        <SectionHead id="book" sub="booking.subline" title="booking.title" />
        <div className="mt-6 space-y-3">
          {filters}
          {where}
        </div>
        {layout === "panel" ? (
          <div className="mt-8 grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
            {catalog}
            <aside className={`${s.card} p-6 lg:sticky lg:top-24`}>{policies}</aside>
          </div>
        ) : (
          <>
            <div className="mt-8">{catalog}</div>
            {policies ? <div className={`mt-16 border-t pt-12 ${s.line}`}>{policies}</div> : null}
          </>
        )}
      </div>
    </section>
  );
}
