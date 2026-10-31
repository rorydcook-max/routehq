import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { AdminHeader } from "../admin-nav";
import { AppShell } from "@/components/app-shell";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { isPlatformAdmin } from "@/lib/support";
import { listRenters, renterStats, type RenterRental } from "@/lib/renters-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Say = (key: string, values?: Record<string, string | number>) => string;
type Query = { q?: string; town?: string; nationality?: string; now?: string; rate?: string };

/**
 * RoveHQ's own list of renters who said yes to partner offers, with their rental history across every business:
 * for planning partner offers and retargeting. RoveHQ team (platform admins) only; operators never see it.
 */
export default async function RentersPage({ searchParams }: { searchParams: Promise<Query> }) {
  const [query, userEmail, membership, tRaw, locale] = await Promise.all([searchParams, getCurrentUserEmail(), getCurrentMembership(), getTranslations("renters"), getLocale()]);
  const t = tRaw as unknown as Say;
  const has = (key: string) => tRaw.has(key as never);
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership?.userId))) notFound();
  const filters = { q: query.q, town: query.town, nationality: query.nationality, now: query.now === "1", rate: query.rate };
  const [{ renters, towns, nationalities }, stats] = await Promise.all([listRenters(filters), renterStats()]);
  const intl = locale === "en" ? "en-GB" : locale;
  const day = (iso: string | null) => (iso ? new Intl.DateTimeFormat(intl, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)) : "—");
  const money = (value: number | null, currency = "THB") => (value === null ? "—" : `${currency === "THB" ? "฿" : `${currency} `}${Math.round(value).toLocaleString("en-US")}`);
  const exportQuery = new URLSearchParams(Object.entries(query).filter(([, value]) => value) as Array<[string, string]>).toString();
  const rateLabel = (rental: RenterRental) => (rental.open_ended ? t("rate_open") : has(`rate_${rental.rate_type}`) ? t(`rate_${rental.rate_type}`) : rental.rate_type || "—");
  const deposit = (rental: RenterRental) =>
    rental.deposit_outcome === "partly_kept"
      ? t("dep_partly_kept", { kept: money(rental.deposit_kept, rental.currency || "THB") })
      : rental.deposit_outcome && has(`dep_${rental.deposit_outcome}`)
        ? t(`dep_${rental.deposit_outcome}`)
        : "—";
  const status = (rental: RenterRental) => (rental.active ? t("active") : has(`status_${rental.status}`) ? t(`status_${rental.status}`) : rental.status || "");
  const via = (rental: RenterRental) => (rental.booked_via && has(`via_${rental.booked_via}`) ? t(`via_${rental.booked_via}`) : t("via_operator"));
  const age = (dob: string | null) => (dob ? Math.floor((Date.now() - Date.parse(`${dob}T00:00:00Z`)) / 31_557_600_000) : null);

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/renters" subtitle={t("subtitle")} title={t("title")} />
      <div className="space-y-4">
        <div className="flex justify-end">
          <a className="secondary-action pressable shrink-0" href={`/platform/renters/export${exportQuery ? `?${exportQuery}` : ""}`}>
            <Download size={17} />
            {t("export")}
          </a>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {[
            [t("statOptedIn"), stats.optedIn.toLocaleString("en-US")],
            [t("statRate"), stats.bookedThroughRouteHQ ? `${Math.round((stats.optedIn / stats.bookedThroughRouteHQ) * 100)}%` : "—"],
            [t("statNow"), stats.rentingNow.toLocaleString("en-US")],
            [t("statPaid"), money(stats.paid)],
            [t("statDays"), stats.averageDays ? t("days", { count: stats.averageDays }) : "—"]
          ].map(([label, value]) => (
            <div className="card p-3.5" key={label}>
              <p className="text-[13px] font-semibold text-[var(--muted)]">{label}</p>
              <p className="mt-1 text-[22px] font-bold text-[var(--foreground)]">{value}</p>
            </div>
          ))}
        </div>

        <form className="card grid gap-2 p-3 md:grid-cols-[1fr_auto_auto_auto_auto_auto] md:items-center" method="get">
          <input className="w-full" defaultValue={query.q || ""} name="q" placeholder={t("search")} />
          <select defaultValue={query.town || ""} name="town">
            <option value="">{t("anyPlace")}</option>
            {towns.map((town) => (
              <option key={town} value={town}>
                {town}
              </option>
            ))}
          </select>
          <select defaultValue={query.nationality || ""} name="nationality">
            <option value="">{t("anyNationality")}</option>
            {nationalities.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
          <select defaultValue={query.rate || ""} name="rate">
            <option value="">{t("anyRate")}</option>
            {["daily", "weekly", "monthly", "open"].map((value) => (
              <option key={value} value={value}>
                {t(`rate_${value}`)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 px-1 font-semibold text-[var(--foreground)]">
            <input defaultChecked={query.now === "1"} name="now" type="checkbox" value="1" />
            {t("rentingNow")}
          </label>
          <button className="primary-action pressable" type="submit">
            {t("filter")}
          </button>
        </form>

        <p className="font-semibold text-[var(--muted)]">{t("showing", { count: renters.length })}</p>

        {renters.length ? (
          <ul className="space-y-3">
            {renters.map((renter) => {
              const current = renter.rentals.find((rental) => rental.active);
              const paid = renter.rentals.reduce((sum, rental) => sum + Number(rental.total_paid || 0), 0);
              const years = age(renter.date_of_birth);
              return (
                <li className="card p-4" key={renter.id}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[17px] font-bold text-[var(--foreground)]">{renter.full_name || t("noName")}</p>
                      <p className="text-[14px] font-medium text-[var(--muted)]">
                        {[renter.nationality, renter.language ? t("speaks", { language: renter.language.toUpperCase() }) : null, years ? t("age", { count: years }) : null, renter.licence_country ? t("licence", { country: renter.licence_country }) : null].filter(Boolean).join(" · ")}
                      </p>
                      <p className="mt-0.5 break-all text-[14px] text-[var(--foreground-secondary)]">{[renter.phone, renter.whatsapp && renter.whatsapp !== renter.phone ? `WhatsApp ${renter.whatsapp}` : null, renter.line_id ? `LINE ${renter.line_id}` : null, renter.email].filter(Boolean).join(" · ")}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {current ? <span className="rounded-full bg-[var(--success-light)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--success)]">{t("nowAt", { business: current.operator_name || "", town: current.town || "" })}</span> : null}
                      <span className="rounded-full bg-[var(--panel-secondary)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--foreground-secondary)]">{t("rentals", { count: renter.rentals.length })}</span>
                      <span className="rounded-full bg-[var(--panel-secondary)] px-2.5 py-0.5 text-[13px] font-bold text-[var(--foreground-secondary)]">{t("paidTotal", { amount: money(paid) })}</span>
                    </div>
                  </div>
                  <details className="mt-2">
                    <summary className="cursor-pointer font-bold text-[var(--primary)]">{t("history")}</summary>
                    <div className="mt-2 space-y-2">
                      {renter.rentals.map((rental) => (
                        <div className="rounded-xl bg-[var(--panel-secondary)] p-3 text-[14px]" key={rental.rental_id}>
                          <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="font-bold text-[var(--foreground)]">
                              {rental.vehicle || t("vehicle")}
                              {rental.vehicle_year ? ` ${rental.vehicle_year}` : ""} · {rental.operator_name}
                              {rental.town ? `, ${rental.town}` : ""}
                            </p>
                            <span className={`text-[13px] font-bold ${rental.active ? "text-[var(--success)]" : "text-[var(--muted)]"}`}>{status(rental)}</span>
                          </div>
                          <dl className="mt-1.5 grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
                            {[
                              [t("f_dates"), `${day(rental.start_date)} – ${rental.open_ended && rental.active ? t("noEnd") : day(rental.end_date)} · ${t("days", { count: rental.days || 0 })}`],
                              [t("f_rate"), `${rateLabel(rental)} · ${money(rental.rate, rental.currency || "THB")}`],
                              [t("f_paid"), money(rental.total_paid, rental.currency || "THB")],
                              [t("f_extras"), rental.extras.length ? rental.extras.map((extra) => extra.name).filter(Boolean).join(", ") : t("none")],
                              [t("f_deposit"), rental.deposit ? `${money(rental.deposit, rental.currency || "THB")} · ${deposit(rental)}` : t("none")],
                              [t("f_early"), rental.ended_early ? (rental.days_early ? t("earlyBy", { count: rental.days_early }) : t("yes")) : t("no")],
                              [t("f_damage"), rental.damage_items ? `${t("damageItems", { count: rental.damage_items })}${rental.damage_charged ? ` · ${money(rental.damage_charged, rental.currency || "THB")}` : ""}` : t("none")],
                              [t("f_km"), rental.km_driven ? `${rental.km_driven.toLocaleString("en-US")} km` : "—"],
                              [t("f_via"), via(rental)]
                            ].map(([label, value]) => (
                              <div key={label}>
                                <dt className="text-[12px] font-semibold uppercase text-[var(--muted)]">{label}</dt>
                                <dd className="font-medium text-[var(--foreground)]">{value}</dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      ))}
                    </div>
                  </details>
                  <p className="mt-2 text-[12px] text-[var(--muted)]">{t("agreed", { date: day(renter.consented_at) })}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="card p-4 font-medium text-[var(--foreground-secondary)]">{t("empty")}</p>
        )}
      </div>
    </AppShell>
  );
}
