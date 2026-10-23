import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { FileSpreadsheet, Plus } from "lucide-react";
import { bulkArchiveVehicles, bulkDeleteVehicles } from "@/app/actions/vehicles";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState } from "@/components/ui";
import { OutFreeSummary, VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { VehicleArt } from "@/components/vehicle-art";
import { Dot, Ring, TileHead } from "@/components/glance";
import { Wrench } from "lucide-react";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { FleetBulkActions } from "@/app/fleet/fleet-actions";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { planById, planForFleet, vehiclesOverLimit } from "@/lib/plans";
import { groupVehiclesByKind, kindLabel } from "@/lib/vehicle-groups";

const statusTone = {
  Rented: "blue",
  Available: "green",
  Maintenance: "red",
  Reserved: "amber"
} as const;

function ComplianceBadge({ item, attention = 0 }: { item?: { key?: string; label: string; date: string; daysLeft: number } | null; attention?: number }) {
  const t = useTranslations("fleet");
  const c = useTranslations("common");
  if (!item) return <span className="text-[13px] font-medium text-[var(--muted)]">{t("noDates")}</span>;
  const tone = item.daysLeft < 0 ? "red" : item.daysLeft <= 30 ? "amber" : "green";
  const days = Math.abs(item.daysLeft);
  // Road tax, insurance and the rest are named in the reader's language.
  const label = item.key && c.has(`paper_${item.key}`) ? c(`paper_${item.key}`) : item.label;
  const isService = item.key === "next_service_date" || item.label === "Service";
  // Two tidy lines instead of a pill whose sentence wrapped mid-phrase:
  // "Road tax expired" (coloured) over "53 days ago · +1 more" (quiet).
  const what = item.daysLeft < 0 ? (isService ? t("p_serviceLate") : t("p_expired", { label })) : t("p_due", { label });
  const when = item.daysLeft < 0 ? t("p_ago", { days }) : item.daysLeft === 0 ? t("p_today") : t("p_in", { days });
  const colour = tone === "red" ? "var(--danger)" : tone === "amber" ? "var(--warning)" : "var(--success)";
  return (
    <span className="flex min-w-0 items-start gap-2">
      <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full" style={{ background: colour }} />
      <span className="min-w-0 leading-tight">
        <span className="line-clamp-2 block text-[14px] font-semibold" style={{ color: tone === "green" ? "var(--foreground)" : colour }}>{what}</span>
        <span className="block truncate text-[13px] font-medium text-[var(--muted)]">
          {when}
          {attention > 1 ? ` · ${t("plusMore", { count: attention - 1 })}` : ""}
        </span>
      </span>
    </span>
  );
}

const primaryButton = "primary-action pressable";
// "3 on rent · 6 free" may wrap at the dot, never inside a phrase.
const glue = (text: string) => text.split(" · ").map((part) => part.replace(/ /g, "\u00a0")).join(" · ");

type FleetFilter = "out" | "free" | "attention";

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ notice?: string; show?: string }> }) {
  const { notice, show } = await searchParams;
  const filter: FleetFilter | null = show === "out" || show === "free" || show === "attention" ? show : null;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const [{ vehicles }, categories] = await Promise.all([getDashboardData(), getVehicleCategories(organization.id)]);
  // The counts at the top are filters: tap "4 out earning" to see just those.
  const matches = (vehicle: (typeof vehicles)[number]) =>
    filter === "out"
      ? vehicle.status === "Rented"
      : filter === "free"
        ? vehicle.status === "Available" || Boolean(vehicle.freeUntil)
        : filter === "attention"
          ? (vehicle.complianceAttentionCount || 0) > 0
          : true;
  const allGroups = groupVehiclesByKind(vehicles, categories);
  const groups = filter ? groupVehiclesByKind(vehicles.filter(matches), categories) : allGroups;
  // Over the plan's vehicle limit: a nudge, never a block (Rory, 11 Oct).
  const plan = planById(organization.subscription_tier);
  const over = vehiclesOverLimit(plan, vehicles.length, organization.subscription_status);
  const fitting = planForFleet(vehicles.length);
  const totalOut = vehicles.filter((vehicle) => vehicle.status === "Rented").length;
  const totalFree = vehicles.filter((vehicle) => vehicle.status === "Available" || Boolean(vehicle.freeUntil)).length;
  /** The longest period a vehicle is priced for: "฿18,000/mo", else per week, else per day. */
  const priceOf = (vehicle: { monthlyRate: number; weeklyRate: number; dailyRate: number }) =>
    vehicle.monthlyRate > 0 ? t("perMo", { amount: money(vehicle.monthlyRate) }) : vehicle.weeklyRate > 0 ? t("perWk", { amount: money(vehicle.weeklyRate) }) : vehicle.dailyRate > 0 ? t("perDay", { amount: money(vehicle.dailyRate) }) : "";
  // "overdue since 1 Dec" a year back would read as a date still to come, so far-off dates keep the year.
  // The year only when the date is far enough off to be ambiguous: "Free until 9 Feb" in October needs no
  // "2027" (which pushed the status pill into the price column).
  const dayMonth = (value: string) =>
    new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`, {
      day: "numeric",
      month: "short",
      ...(Math.abs(new Date(`${value.slice(0, 10)}T00:00:00Z`).getTime() - Date.now()) > 300 * 86_400_000 ? { year: "numeric" } : {}),
      timeZone: "UTC"
    }).format(new Date(`${value}T00:00:00Z`));
  const [t, c, locale] = await Promise.all([getTranslations("fleet"), getTranslations("common"), getLocale()]);
  // At a glance (Look G): how busy the fleet is, and the next piece of paperwork or service due.
  const busy = vehicles.length > 0 ? Math.round(vehicles.reduce((sum, vehicle) => sum + Number(vehicle.utilization || 0), 0) / vehicles.length) : 0;
  const attention = vehicles.filter((vehicle) => (vehicle.complianceAttentionCount || 0) > 0).length;
  const nextPaper = vehicles
    .filter((vehicle) => vehicle.complianceNext && vehicle.complianceNext.daysLeft <= 30)
    .sort((a, b) => (a.complianceNext!.daysLeft || 0) - (b.complianceNext!.daysLeft || 0))[0];
  const noDates = vehicles.filter((vehicle) => !(vehicle as { compliance?: unknown[] }).compliance?.length);
  const paperName = (item: { key?: string; label: string }) => (item.key && c.has(`paper_${item.key}`) ? c(`paper_${item.key}`) : item.label);
  const kindName = (group: { kind: string; label: string }) => (c.has(`kinds_${group.kind}`) ? c(`kinds_${group.kind}`) : group.label);

  return (
    <AppShell
      heroOverlap
      hero={
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[32px] leading-tight text-white">{t("title")}</h1>
            <div className="flex flex-wrap gap-2">
              <Link className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--band-soft)] px-4 font-bold text-white" href="/fleet/import">
                <FileSpreadsheet size={16} />
                {t("import")}
              </Link>
              <Link className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--band-action)] px-4 font-bold text-[var(--band-action-ink)]" href="/fleet/new">
                <Plus size={16} />
                {t("addVehicle")}
              </Link>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2 pb-6 lg:pb-0">
            {(
              [
                { key: null, count: vehicles.length, label: t("bandVehicles", { count: vehicles.length }), dot: null },
                { key: "out", count: totalOut, label: t("bandOut"), dot: "var(--band-dot)" },
                // Free is green everywhere else (the list legend, the dashboard); orange means going out.
                { key: "free", count: totalFree, label: t("bandFree"), dot: "#7ee2a8" },
                ...(attention > 0 ? [{ key: "attention", count: attention, label: t("bandAttention"), dot: "var(--band-alert)" }] : [])
              ] as Array<{ key: FleetFilter | null; count: number; label: string; dot: string | null }>
            ).map((pill) => {
              const active = pill.key === filter;
              // Tapping the active filter again clears it.
              const href = pill.key && !active ? `/fleet?show=${pill.key}` : "/fleet";
              return (
                <Link
                  aria-current={active ? "true" : undefined}
                  className={`band-chip pressable inline-flex min-h-11 items-center gap-1.5 rounded-2xl px-3 py-2 ${active ? "band-chip-on" : ""}`}
                  href={href as never}
                  key={pill.label}
                  scroll={false}
                >
                  {pill.dot ? <Dot color={pill.dot} /> : null}
                  <span className="num text-[22px] leading-none">{pill.count}</span>
                  <span className="font-semibold">{pill.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      }
      userEmail={userEmail}
    >
      {vehicles.length > 0 ? (
        <div className="relative -mt-12 mb-5 grid grid-cols-2 gap-3 lg:mt-0 lg:grid-cols-4">
          <Link className="card pressable tile p-4 text-[var(--foreground)]" href="/calendar">
            <TileHead title={t("busyTitle")} />
            <span className="flex items-center gap-3">
              <Ring label={`${busy}%`} pct={busy} />
              <span className="text-[14px] font-semibold leading-snug text-[var(--foreground-secondary)] lg:text-[15px]">{t("busyDetail")}</span>
            </span>
          </Link>
          {nextPaper ? (
            <Link className="card pressable tile tile-brick p-4" href={`/fleet/${nextPaper.id}`}>
              <TileHead icon={<Wrench size={22} />} title={paperName(nextPaper.complianceNext!)} />
              <span>
                <span className="num block text-[24px] leading-tight">{[nextPaper.make, nextPaper.model].filter(Boolean).join(" ")}</span>
                <span className="font-semibold">{nextPaper.complianceNext!.daysLeft < 0 ? t("paperLate", { date: dayMonth(nextPaper.complianceNext!.date).replace(/ /g, "\u00a0") }) : t("paperDueOn", { date: dayMonth(nextPaper.complianceNext!.date).replace(/ /g, "\u00a0") })}</span>
              </span>
            </Link>
          ) : noDates.length > 0 ? (
            <Link className="card pressable tile p-4 text-[var(--foreground)]" href={`/fleet/${noDates[0].id}/edit` as never}>
              <TileHead icon={<Wrench size={22} />} title={t("papersMissingTitle")} />
              <span>
                <span className="num block text-[28px] leading-tight">{noDates.length}</span>
                <span className="font-semibold text-[var(--foreground-secondary)]">{t("papersMissingDetail", { count: noDates.length })}</span>
              </span>
            </Link>
          ) : (
            <span className="card tile tile-green p-4">
              <TileHead title={t("papersOk")} />
              <span className="font-semibold">{t("papersOkDetail")}</span>
            </span>
          )}
          {allGroups.length > 1
            ? allGroups.map((group) => (
                <div className="hidden lg:block" key={`tile-${group.kind}`}>
                <a className="card pressable tile h-full p-4 text-[var(--foreground)]" href={`#${group.kind}`}>
                  <span className="flex items-center justify-between gap-2">
                    <span className="tile-title">{kindName(group)}</span>
                    <VehicleKindIcon kind={group.kind} size={20} />
                  </span>
                  <span>
                    <span className="num block text-[32px] leading-none">{group.vehicles.length}</span>
                    <span className="font-semibold text-[var(--foreground-secondary)]">{glue(t("outFree", { out: group.out, free: group.free }))}</span>
                  </span>
                </a>
                </div>
              ))
            : null}
        </div>
      ) : (
        <div className="mb-5" />
      )}

      {over > 0 ? (
        <p className="mb-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm font-medium text-[var(--foreground)]" role="status">
          {t("overPlan", { count: over, plan: c.has(`plans_${fitting.id}`) ? c(`plans_${fitting.id}`) : fitting.id })}{" "}
          <Link className="font-bold text-[var(--primary)]" href="/settings/billing">
            {t("seePlans")}
          </Link>
        </p>
      ) : null}
      {notice === "vehicle-has-bookings" ? (
        <p className="mb-4 rounded-xl border border-[var(--warning-line)] bg-[var(--warning-light)] p-3 text-sm font-medium text-[var(--warning)]" role="alert">
          {t("noticeBookings")}
        </p>
      ) : null}

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <EmptyState
            title={t("emptyTitle")}
            description={t("emptyBody")}
            action={
              <Link className={primaryButton} href="/fleet/new">
                <Plus size={16} />
                {t("addVehicle")}
              </Link>
            }
          />
        </div>
      ) : null}

      {allGroups.length > 1 && !filter ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:hidden">
          {allGroups.map((group) => (
            <a
              className="card pressable flex items-start gap-3 p-4 transition"
              href={`#${group.kind}`}
              key={group.kind}
            >
              <VehicleKindIcon kind={group.kind} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block text-[22px] font-bold leading-none text-[var(--foreground)]">{group.vehicles.length}</span>
                <span className="mt-1 block font-semibold leading-tight text-[var(--foreground)]">{locale === "en" ? kindLabel(group.kind, group.vehicles.length).toLowerCase() : kindName(group)}</span>
                <span className="block text-[14px] font-medium leading-snug text-[var(--foreground-secondary)]">{glue(t("outFree", { out: group.out, free: group.free }))}</span>
              </span>
            </a>
          ))}
        </div>
      ) : null}

      <FleetBulkActions archiveAction={bulkArchiveVehicles} deleteAction={bulkDeleteVehicles} organizationId={organization.id} />

      {filter && groups.length === 0 ? (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <p className="font-semibold text-[var(--foreground-secondary)]">{t("filterEmpty")}</p>
          <Link className="pressable inline-flex min-h-11 items-center rounded-full border border-[var(--border)] bg-white px-5 font-bold text-[var(--foreground)]" href="/fleet">
            {t("filterAll")}
          </Link>
        </div>
      ) : null}

      <div className="space-y-5">
        {groups.map((group) => (
          <section className="card scroll-mt-4 overflow-hidden" id={group.kind} key={group.kind}>
            <header className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3.5">
              <VehicleKindIcon kind={group.kind} />
              <div className="min-w-0 flex-1">
                <h2 className="text-[18px] font-bold tracking-[-0.01em] text-[var(--foreground)]">
                  {kindName(group)} <span className="font-semibold text-[var(--muted)]">· {group.vehicles.length}</span>
                </h2>
                <OutFreeSummary free={group.free} other={group.other} out={group.out} />
              </div>
            </header>

            {/* The full table needs a laptop's width. Tablets get the same tidy list as phones, and narrow laptops drop the two "nice to know" columns rather than scroll sideways. */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full table-fixed text-left text-sm">
                <thead>
                  <tr className="whitespace-nowrap border-b border-[var(--border)] text-[13px] font-semibold text-[var(--muted)]">
                    <th className="w-10 py-2.5 pl-4 pr-2"><span className="sr-only">{t("select")}</span></th>
                    <th className="py-2.5 pr-3">{t("th_vehicle")}</th>
                    {/* Status fits "Free until 8 Nov" on one line; paperwork gets the room for its chip, so rows stay one or two lines tall. */}
                    <th className="w-[148px] px-3 py-2.5">{t("th_status")}</th>
                    <th className="w-[116px] px-3 py-2.5">{t("th_rate")}</th>
                    <th className="w-[140px] px-3 py-2.5 xl:w-[160px]">{t("th_onRent")}</th>
                    <th className="w-[190px] px-3 py-2.5 xl:w-[230px]">{t("th_paperwork")}</th>
                    <th className="hidden w-[120px] py-2.5 pl-3 pr-5 text-right xl:table-cell">{t("th_profit")}</th>
                  </tr>
                </thead>
                <tbody>
                  {group.vehicles.map((vehicle) => {
                    const href = `/fleet/${vehicle.id}` as const;
                    return (
                      <tr className="group border-b border-[var(--border)] last:border-0 hover:bg-[var(--panel-secondary)]" key={vehicle.id}>
                        <td className="py-3 pl-4 pr-2">
                          <input aria-label={t("selectAria", { vehicle: `${vehicle.make} ${vehicle.model}` })} className="flex-shrink-0" form="fleetBulkForm" name="vehicleIds" type="checkbox" value={vehicle.id} />
                        </td>
                        <td className="py-3 pr-3">
                          <Link className="flex min-w-0 items-center gap-3 rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={href}>
                            <VehicleArt colour={vehicle.color} kind={group.kind} model={vehicle.model} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                                {vehicle.make} {vehicle.model}
                              </span>
                              <span className="block truncate text-[14px] text-[var(--muted)]">
                                <span className="font-mono-data">{vehicle.plate}</span> · {vehicle.year || t("yearUnknown")}
                                {/* A mileage nobody has entered yet isn't "0 km". */}
                                {vehicle.mileage > 0 ? ` · ${vehicle.mileage.toLocaleString()} km` : ""}
                              </span>
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <span className="inline-block whitespace-nowrap">
                            {vehicle.freeUntil ? <Badge tone="green">{t("status_freeUntil", { date: dayMonth(vehicle.freeUntil) })}</Badge> : <Badge tone={statusTone[vehicle.status]}>{t(`status_${vehicle.status}`)}</Badge>}
                          </span>
                        </td>
                        <td className="px-3 py-3">
                          {/* No price yet: the cell is the way to set one. */}
                          {priceOf(vehicle) ? (
                            <Link className="font-mono-data block" href={href}>{priceOf(vehicle)}</Link>
                          ) : (
                            <Link className="block whitespace-nowrap font-semibold text-[var(--primary)] hover:underline" href={`/fleet/${vehicle.id}/edit` as never}>{t("setPrice")}</Link>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex min-w-32 items-center gap-2">
                            <span aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
                              <span className="grow-x block h-full rounded-full bg-[var(--chart-in)]" style={{ width: `${Math.max(0, Math.min(100, vehicle.utilization))}%` }} />
                            </span>
                            <span className="num w-11 text-right text-[var(--foreground)]">{vehicle.utilization}%</span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                        </td>
                        <td className="hidden py-3 pl-3 pr-5 text-right xl:table-cell">
                          <span className={`font-mono-data ${vehicle.profit < 0 ? "text-[var(--danger)]" : ""}`}>{money(vehicle.profit)}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] lg:hidden">
              {group.vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <Link className="flex items-center gap-3 px-3 py-3 active:bg-[var(--panel-secondary)]" href={`/fleet/${vehicle.id}`}>
                    <VehicleArt colour={vehicle.color} kind={group.kind} model={vehicle.model} size="sm" />
                    <div className="min-w-0 flex-1">
                      {/* Name and status share the top line, so a row is three short lines rather than five. */}
                      <div className="flex items-start justify-between gap-2">
                        <p className="line-clamp-2 min-w-0 text-[17px] font-bold leading-tight text-[var(--foreground)]">
                          {vehicle.make} {vehicle.model}
                        </p>
                        <span className="shrink-0 whitespace-nowrap">
                          {vehicle.freeUntil ? <Badge tone="green">{t("status_freeUntil", { date: dayMonth(vehicle.freeUntil) })}</Badge> : <Badge tone={statusTone[vehicle.status]}>{t(`status_${vehicle.status}`)}</Badge>}
                        </span>
                      </div>
                      {/* Plate and price each stay whole; on a narrow phone the price drops to its own line instead of being cut off. */}
                      <p className="mt-0.5 flex flex-wrap gap-x-1.5 font-medium text-[var(--foreground-secondary)]">
                        <span className="font-mono-data whitespace-nowrap">{vehicle.plate}</span>
                        {priceOf(vehicle) ? <span className="whitespace-nowrap">· {priceOf(vehicle)}</span> : null}
                      </p>
                      {vehicle.complianceNext && vehicle.complianceNext.daysLeft <= 30 ? (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2.5">
                        <span aria-hidden="true" className="h-2.5 flex-1 overflow-hidden rounded-full bg-[var(--panel-tertiary)]">
                          <span className="grow-x block h-full rounded-full bg-[var(--chart-in)]" style={{ width: `${Math.max(0, Math.min(100, vehicle.utilization))}%` }} />
                        </span>
                        <span className="num flex-shrink-0 whitespace-nowrap text-right text-[15px] text-[var(--foreground)]">{t("utilShort", { pct: vehicle.utilization })}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </AppShell>
  );
}
