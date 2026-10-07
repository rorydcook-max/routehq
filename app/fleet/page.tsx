import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { FileSpreadsheet, Plus } from "lucide-react";
import { bulkArchiveVehicles, bulkDeleteVehicles } from "@/app/actions/vehicles";
import { AppShell } from "@/components/app-shell";
import { Badge, EmptyState, ProgressBar } from "@/components/ui";
import { OutFreeSummary, VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { FleetBulkActions } from "@/app/fleet/fleet-actions";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
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
  if (!item) return <span className="text-xs text-[var(--muted)]">{t("noDates")}</span>;
  const tone = item.daysLeft < 0 ? "red" : item.daysLeft <= 30 ? "amber" : "green";
  const days = Math.abs(item.daysLeft);
  // Road tax, insurance and the rest are named in the reader's language.
  const label = item.key && c.has(`paper_${item.key}`) ? c(`paper_${item.key}`) : item.label;
  const isService = item.key === "next_service_date" || item.label === "Service";
  const text =
    item.daysLeft < 0
      ? isService
        ? t("serviceOverdue", { days })
        : t("expiredAgo", { label, days })
      : item.daysLeft === 0
        ? t("dueToday", { label })
        : t("dueIn", { label, days });
  const more = attention > 1 ? ` ${t("plusMore", { count: attention - 1 })}` : "";
  return <Badge tone={tone}>{text + more}</Badge>;
}

const primaryButton = "primary-action pressable";
const secondaryButton = "secondary-action pressable";

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const [{ vehicles }, categories] = await Promise.all([getDashboardData(), getVehicleCategories(organization.id)]);
  const groups = groupVehiclesByKind(vehicles, categories);
  const totalOut = vehicles.filter((vehicle) => vehicle.status === "Rented").length;
  const totalFree = vehicles.filter((vehicle) => vehicle.status === "Available" || Boolean(vehicle.freeUntil)).length;
  /** The longest period a vehicle is priced for: "฿18,000/mo", else per week, else per day. */
  const priceOf = (vehicle: { monthlyRate: number; weeklyRate: number; dailyRate: number }) =>
    vehicle.monthlyRate > 0 ? t("perMo", { amount: money(vehicle.monthlyRate) }) : vehicle.weeklyRate > 0 ? t("perWk", { amount: money(vehicle.weeklyRate) }) : vehicle.dailyRate > 0 ? t("perDay", { amount: money(vehicle.dailyRate) }) : "";
  const dayMonth = (value: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`, { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${value}T00:00:00Z`));
  const [t, c, locale] = await Promise.all([getTranslations("fleet"), getTranslations("common"), getLocale()]);
  const kindName = (group: { kind: string; label: string }) => (c.has(`kinds_${group.kind}`) ? c(`kinds_${group.kind}`) : group.label);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">{t("title")}</h1>
          <p className="mt-1 font-semibold text-[var(--foreground-secondary)]">
            {t("summary", { count: vehicles.length, out: totalOut, free: totalFree })}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondaryButton} href="/fleet/import">
            <FileSpreadsheet size={16} />
            {t("import")}
          </Link>
          <Link className={primaryButton} href="/fleet/new">
            <Plus size={16} />
            {t("addVehicle")}
          </Link>
        </div>
      </div>

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

      {groups.length > 1 ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {groups.map((group) => (
            <a
              className="card pressable flex items-start gap-3 p-4 transition"
              href={`#${group.kind}`}
              key={group.kind}
            >
              <VehicleKindIcon kind={group.kind} size={20} />
              <span className="min-w-0 flex-1">
                <span className="block text-[22px] font-bold leading-none text-[var(--foreground)]">{group.vehicles.length}</span>
                <span className="mt-1 block font-semibold leading-tight text-[var(--foreground)]">{locale === "en" ? kindLabel(group.kind, group.vehicles.length).toLowerCase() : kindName(group)}</span>
                <span className="block font-medium text-[var(--foreground-secondary)]">{t("outFree", { out: group.out, free: group.free })}</span>
              </span>
            </a>
          ))}
        </div>
      ) : null}

      <FleetBulkActions archiveAction={bulkArchiveVehicles} deleteAction={bulkDeleteVehicles} organizationId={organization.id} />

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
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="w-10 py-2.5 pl-4 pr-2"><span className="sr-only">{t("select")}</span></th>
                    <th className="py-2.5 pr-3">{t("th_vehicle")}</th>
                    <th className="px-3 py-2.5">{t("th_status")}</th>
                    <th className="px-3 py-2.5">{t("th_rate")}</th>
                    <th className="hidden px-3 py-2.5 xl:table-cell">{t("th_onRent")}</th>
                    <th className="px-3 py-2.5">{t("th_paperwork")}</th>
                    <th className="hidden px-3 py-2.5 pr-4 xl:table-cell">{t("th_profit")}</th>
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
                          <Link className="block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={href}>
                            <span className="whitespace-nowrap font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                              {vehicle.make} {vehicle.model}
                            </span>
                            <span className="block whitespace-nowrap text-[13px] text-[var(--muted)]">
                              <span className="font-mono-data">{vehicle.plate}</span> · {vehicle.year || t("yearUnknown")} · {vehicle.mileage.toLocaleString()} km
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          {vehicle.freeUntil ? <Badge tone="green">{t("status_freeUntil", { date: dayMonth(vehicle.freeUntil) })}</Badge> : <Badge tone={statusTone[vehicle.status]}>{t(`status_${vehicle.status}`)}</Badge>}
                        </td>
                        <td className="px-3 py-3">
                          <Link className="font-mono-data block" href={href}>{priceOf(vehicle) || <span className="text-[var(--muted)]">{t("notSet")}</span>}</Link>
                        </td>
                        <td className="hidden px-3 py-3 xl:table-cell">
                          <div className="min-w-28">
                            <div className="font-mono-data mb-1 text-xs text-[var(--muted)]">{vehicle.utilization}%</div>
                            <ProgressBar value={vehicle.utilization} tone={vehicle.utilization > 80 ? "green" : "amber"} />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                        </td>
                        <td className="hidden px-3 py-3 xl:table-cell">
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
                  <Link className="flex items-center gap-3 px-4 py-3.5 active:bg-[var(--panel-secondary)]" href={`/fleet/${vehicle.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[17px] font-bold text-[var(--foreground)]">
                        {vehicle.make} {vehicle.model}
                      </p>
                      {/* Plate and price each stay whole; on a narrow phone the price drops to its own line instead of being cut off. */}
                      <p className="mt-0.5 flex flex-wrap gap-x-1.5 font-medium text-[var(--foreground-secondary)]">
                        <span className="font-mono-data whitespace-nowrap">{vehicle.plate}</span>
                        {priceOf(vehicle) ? <span className="whitespace-nowrap">· {priceOf(vehicle)}</span> : null}
                      </p>
                      {vehicle.complianceNext && vehicle.complianceNext.daysLeft <= 30 ? (
                        <div className="mt-1.5">
                          <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                        </div>
                      ) : null}
                    </div>
                    {vehicle.freeUntil ? <Badge tone="green">{t("status_freeUntil", { date: dayMonth(vehicle.freeUntil) })}</Badge> : <Badge tone={statusTone[vehicle.status]}>{t(`status_${vehicle.status}`)}</Badge>}
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
