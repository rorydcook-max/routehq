import Link from "next/link";
import { Archive, FileSpreadsheet, Plus } from "lucide-react";
import { archiveVehicle, bulkArchiveVehicles, bulkDeleteVehicles, deleteVehicle } from "@/app/actions/vehicles";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, EmptyState, ProgressBar } from "@/components/ui";
import { OutFreeSummary, VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { ConfirmDeleteVehicleButton, FleetBulkActions } from "@/app/fleet/fleet-actions";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { groupVehiclesByKind, kindLabel } from "@/lib/vehicle-groups";

const statusTone = {
  Rented: "blue",
  Available: "green",
  Maintenance: "red",
  Reserved: "amber"
} as const;

/** Plain names for vehicle statuses. */
function statusLabel(status: string) {
  if (status === "Rented") return "On rent";
  if (status === "Reserved") return "Booked";
  if (status === "Maintenance") return "In the shop";
  return status;
}

function ComplianceBadge({ item, attention = 0 }: { item?: { label: string; date: string; daysLeft: number } | null; attention?: number }) {
  if (!item) return <span className="text-xs text-[var(--muted)]">No dates recorded</span>;
  const tone = item.daysLeft < 0 ? "red" : item.daysLeft <= 30 ? "amber" : "green";
  const days = Math.abs(item.daysLeft);
  const plural = days === 1 ? "" : "s";
  const overdueWord = item.label === "Service" ? "overdue by" : "expired";
  const text =
    item.daysLeft < 0
      ? item.label === "Service"
        ? `Service overdue by ${days} day${plural}`
        : `${item.label} ${overdueWord} ${days} day${plural} ago`
      : item.daysLeft === 0
        ? `${item.label} due today`
        : `${item.label} due in ${days} day${plural}`;
  const more = attention > 1 ? ` +${attention - 1} more` : "";
  return <Badge tone={tone}>{text + more}</Badge>;
}

const primaryButton = "pressable inline-flex items-center justify-center gap-2 rounded-[9px] bg-[var(--primary)] px-3.5 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]";
const secondaryButton = "pressable inline-flex items-center justify-center gap-2 rounded-[9px] border border-[var(--border)] bg-white px-3.5 py-2 text-sm font-semibold text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]";

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const [{ vehicles }, categories] = await Promise.all([getDashboardData(), getVehicleCategories(organization.id)]);
  const groups = groupVehiclesByKind(vehicles, categories);
  const totalOut = vehicles.filter((vehicle) => vehicle.status === "Rented").length;
  const totalFree = vehicles.filter((vehicle) => vehicle.status === "Available").length;

  return (
    <AppShell userEmail={userEmail}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="page-title">Fleet</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {vehicles.length} {vehicles.length === 1 ? "vehicle" : "vehicles"} · {totalOut} out on rent · {totalFree} free now
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link className={secondaryButton} href="/fleet/import">
            <FileSpreadsheet size={16} />
            Import
          </Link>
          <Link className={primaryButton} href="/fleet/new">
            <Plus size={16} />
            Add vehicle
          </Link>
        </div>
      </div>

      {notice === "vehicle-has-bookings" ? (
        <p className="mb-4 rounded-xl border border-[#f3dfb0] bg-[#fdf7e9] p-3 text-sm font-medium text-[#8a5a12]" role="alert">
          That vehicle is out on rent or has a booking coming up, so it wasn&apos;t deleted. Finish or cancel its bookings first, or archive it instead.
        </p>
      ) : null}

      {vehicles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-sm)]">
          <EmptyState
            title="No vehicles yet"
            description="Add your first car or bike to start taking bookings."
            action={
              <Link className={primaryButton} href="/fleet/new">
                <Plus size={16} />
                Add vehicle
              </Link>
            }
          />
        </div>
      ) : null}

      {groups.length > 1 ? (
        <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {groups.map((group) => (
            <a
              className="pressable flex items-center gap-3 rounded-xl border border-[var(--border)] bg-white p-3.5 shadow-[var(--shadow-sm)] transition hover:border-[var(--primary)]"
              href={`#${group.kind}`}
              key={group.kind}
            >
              <VehicleKindIcon kind={group.kind} size={20} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight text-[var(--foreground)]">
                  {group.vehicles.length} <span className="font-normal text-[var(--foreground-secondary)]">{kindLabel(group.kind, group.vehicles.length).toLowerCase()}</span>
                </span>
                <span className="mt-0.5 block text-[12px] text-[var(--muted)]">{group.out} out · {group.free} free</span>
              </span>
            </a>
          ))}
        </div>
      ) : null}

      <FleetBulkActions archiveAction={bulkArchiveVehicles} deleteAction={bulkDeleteVehicles} organizationId={organization.id} />

      <div className="space-y-5">
        {groups.map((group) => (
          <section className="scroll-mt-4 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-sm)]" id={group.kind} key={group.kind}>
            <header className="flex flex-wrap items-center gap-3 border-b border-[var(--border)] bg-[#fbfaf8] px-4 py-3">
              <VehicleKindIcon kind={group.kind} />
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--foreground)]">
                  {group.label} <span className="font-normal text-[var(--muted)]">· {group.vehicles.length}</span>
                </h2>
                <OutFreeSummary free={group.free} other={group.other} out={group.out} />
              </div>
            </header>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                    <th className="w-10 py-2.5 pl-4 pr-2"><span className="sr-only">Select</span></th>
                    <th className="py-2.5 pr-3">Vehicle</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Monthly rate</th>
                    <th className="px-3 py-2.5">Rented (12 mo)</th>
                    <th className="px-3 py-2.5">Paperwork</th>
                    <th className="px-3 py-2.5">Profit</th>
                    <th className="px-3 py-2.5 pr-4"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {group.vehicles.map((vehicle) => {
                    const href = `/fleet/${vehicle.id}` as const;
                    return (
                      <tr className="group border-b border-[var(--border)] last:border-0 hover:bg-[#fbfaf8]" key={vehicle.id}>
                        <td className="py-3 pl-4 pr-2">
                          <input aria-label={`Select ${vehicle.make} ${vehicle.model}`} className="flex-shrink-0" form="fleetBulkForm" name="vehicleIds" type="checkbox" value={vehicle.id} />
                        </td>
                        <td className="py-3 pr-3">
                          <Link className="block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={href}>
                            <span className="font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                              {vehicle.make} {vehicle.model}
                            </span>
                            <span className="block text-[13px] text-[var(--muted)]">
                              <span className="font-mono-data">{vehicle.plate}</span> · {vehicle.year || "Year unknown"} · {vehicle.mileage.toLocaleString()} km
                            </span>
                          </Link>
                        </td>
                        <td className="px-3 py-3">
                          <Badge tone={statusTone[vehicle.status]}>{statusLabel(vehicle.status)}</Badge>
                        </td>
                        <td className="px-3 py-3">
                          <Link className="font-mono-data block" href={href}>{vehicle.monthlyRate > 0 ? money(vehicle.monthlyRate) : <span className="text-[var(--muted)]">Not set</span>}</Link>
                        </td>
                        <td className="px-3 py-3">
                          <div className="min-w-28">
                            <div className="font-mono-data mb-1 text-xs text-[var(--muted)]">{vehicle.utilization}%</div>
                            <ProgressBar value={vehicle.utilization} tone={vehicle.utilization > 80 ? "green" : "amber"} />
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                        </td>
                        <td className="px-3 py-3">
                          <span className={`font-mono-data ${vehicle.profit < 0 ? "text-[var(--danger)]" : ""}`}>{money(vehicle.profit)}</span>
                        </td>
                        <td className="px-3 py-3 pr-4">
                          <div className="flex justify-end gap-1.5 opacity-60 transition group-hover:opacity-100">
                            <form action={archiveVehicle}>
                              <input name="vehicleId" type="hidden" value={vehicle.id} />
                              <input name="organizationId" type="hidden" value={organization.id} />
                              <PendingButton aria-label={`Archive ${vehicle.make} ${vehicle.model}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Archive vehicle" type="submit">
                                <Archive size={15} />
                              </PendingButton>
                            </form>
                            <ConfirmDeleteVehicleButton deleteAction={deleteVehicle} label={`${vehicle.make} ${vehicle.model}`} organizationId={organization.id} vehicleId={vehicle.id} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[var(--border)] md:hidden">
              {group.vehicles.map((vehicle) => (
                <li key={vehicle.id}>
                  <Link className="flex items-center gap-3 px-4 py-3 active:bg-[#fbfaf8]" href={`/fleet/${vehicle.id}`}>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                        {vehicle.make} {vehicle.model}
                      </p>
                      <p className="mt-0.5 truncate text-[13px] text-[var(--muted)]">
                        <span className="font-mono-data">{vehicle.plate}</span>
                        {vehicle.monthlyRate > 0 ? <> · {money(vehicle.monthlyRate)}/mo</> : null}
                      </p>
                      {vehicle.complianceNext && vehicle.complianceNext.daysLeft <= 30 ? (
                        <div className="mt-1.5">
                          <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                        </div>
                      ) : null}
                    </div>
                    <Badge tone={statusTone[vehicle.status]}>{statusLabel(vehicle.status)}</Badge>
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
