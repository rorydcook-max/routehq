import Link from "next/link";
import { Archive, FileSpreadsheet, Plus, Trash2 } from "lucide-react";
import { archiveVehicle, bulkArchiveVehicles, bulkDeleteVehicles, deleteVehicle } from "@/app/actions/vehicles";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Badge, Card, EmptyState, ProgressBar, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDashboardData, money } from "@/lib/dashboard";
import { ConfirmDeleteVehicleButton, FleetBulkActions } from "@/app/fleet/fleet-actions";
import { getDefaultOrganization } from "@/lib/organization";

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

export default async function FleetPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const { vehicles } = await getDashboardData();

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">Fleet</p>
          <h1 className="page-title">Your fleet</h1>
          <p className="page-subtitle mt-1">Every vehicle with its rate, how often it's rented, paperwork and profit.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link className="pressable inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)] shadow-sm hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]" href="/fleet/import">
            <FileSpreadsheet size={18} />
            Import spreadsheet
          </Link>
          <Link className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white shadow-[0_14px_28px_rgba(18,184,200,0.24)] hover:bg-[var(--primary-hover)]" href="/fleet/new">
            <Plus size={18} />
            Add vehicle
          </Link>
        </div>
      </div>

      {notice === "vehicle-has-bookings" ? (
        <p className="mb-4 rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3 text-sm font-semibold text-[#92400e]" role="alert">
          That vehicle is out on rent or has a booking coming up, so it wasn&apos;t deleted. Finish or cancel its bookings first, or archive it instead.
        </p>
      ) : null}

      <Card>
        <SectionHeader eyebrow="Live fleet" title={`${vehicles.length} vehicles`} />
        <FleetBulkActions archiveAction={bulkArchiveVehicles} deleteAction={bulkDeleteVehicles} organizationId={organization.id} />
        {vehicles.length === 0 ? (
          <div className="card-section">
            <EmptyState
              title="No vehicles yet"
              description="Add your first vehicle to start tracking bookings, utilization, and profitability."
              action={
                <Link className="pressable inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-3 py-2 text-sm font-bold text-white" href="/fleet/new">
                  <Plus size={16} />
                  Add vehicle
                </Link>
              }
            />
          </div>
        ) : null}
        {vehicles.length > 0 ? (
        <div className="card-section hidden overflow-x-auto md:block">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-xs uppercase text-[var(--muted)]">
                <th className="w-10 py-2 pr-3">Select</th>
                <th className="py-2 pr-3">Vehicle</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Monthly rate</th>
                <th className="px-3 py-2">12 month utilization</th>
                <th className="px-3 py-2">Paperwork</th>
                <th className="px-3 py-2">Profit</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((vehicle) => (
                <tr className="group border-b border-[var(--border)] last:border-0 hover:bg-[var(--primary-blue-light)]/45" key={vehicle.id}>
                  <td className="py-3 pr-3">
                    <input aria-label={`Select ${vehicle.make} ${vehicle.model}`} className="flex-shrink-0" form="fleetBulkForm" name="vehicleIds" type="checkbox" value={vehicle.id} />
                  </td>
                  <td className="py-3 pr-3">
                    <Link className="block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={`/fleet/${vehicle.id}`}>
                      <span className="font-bold text-[var(--foreground)] group-hover:text-[var(--primary)]">
                      {vehicle.make} {vehicle.model}
                      </span>
                      <span className="font-mono-data block text-[var(--muted)]">
                        {vehicle.plate} / {vehicle.year || "Year unknown"} / {vehicle.mileage.toLocaleString()} km
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link className="block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={`/fleet/${vehicle.id}`}>
                      <Badge tone={statusTone[vehicle.status]}>{statusLabel(vehicle.status)}</Badge>
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-semibold">
                    <Link className="font-mono-data block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={`/fleet/${vehicle.id}`}>{vehicle.monthlyRate > 0 ? money(vehicle.monthlyRate) : "Not set"}</Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link className="block min-w-32 rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={`/fleet/${vehicle.id}`}>
                      <div className="font-mono-data mb-1 text-xs text-[var(--muted)]">{vehicle.utilization}%</div>
                      <ProgressBar value={vehicle.utilization} tone={vehicle.utilization > 80 ? "green" : "amber"} />
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link className="block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={`/fleet/${vehicle.id}`}>
                      <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                    </Link>
                  </td>
                  <td className="px-3 py-3 font-semibold">
                    <Link className="font-mono-data block rounded-md outline-none focus:ring-2 focus:ring-[var(--primary)]/25" href={`/fleet/${vehicle.id}`}>{money(vehicle.profit)}</Link>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <form action={archiveVehicle}>
                        <input name="vehicleId" type="hidden" value={vehicle.id} />
                        <input name="organizationId" type="hidden" value={organization.id} />
                        <PendingButton aria-label={`Archive ${vehicle.make} ${vehicle.model}`} className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)] bg-white text-[var(--foreground-secondary)] hover:border-[var(--primary)] hover:text-[var(--primary)]" title="Archive vehicle" type="submit">
                          <Archive size={16} />
                        </PendingButton>
                      </form>
                      <ConfirmDeleteVehicleButton deleteAction={deleteVehicle} label={`${vehicle.make} ${vehicle.model}`} organizationId={organization.id} vehicleId={vehicle.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        ) : null}
        {vehicles.length > 0 ? (
          <div className="card-section block space-y-3 md:hidden">
            {vehicles.map((vehicle) => (
              <Link
                className="block rounded-xl border border-[var(--border)] bg-white p-3 transition hover:border-[var(--primary)]"
                href={`/fleet/${vehicle.id}`}
                key={vehicle.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-[var(--foreground)]">
                      {vehicle.make} {vehicle.model}
                    </p>
                    <p className="font-mono-data mt-1 text-xs text-[var(--muted)]">
                      {vehicle.plate} / {vehicle.year || "Year unknown"} / {vehicle.mileage.toLocaleString()} km
                    </p>
                  </div>
                  <Badge tone={statusTone[vehicle.status]}>{statusLabel(vehicle.status)}</Badge>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                  <div className="rounded-lg bg-[var(--panel-secondary)] p-2">
                    <span className="block font-semibold uppercase tracking-[0.08em]">Monthly</span>
                    <span className="font-mono-data mt-1 block text-sm font-black text-[var(--foreground)]">{vehicle.monthlyRate > 0 ? money(vehicle.monthlyRate) : "Not set"}</span>
                  </div>
                  <div className="rounded-lg bg-[var(--panel-secondary)] p-2">
                    <span className="block font-semibold uppercase tracking-[0.08em]">Profit</span>
                    <span className="font-mono-data mt-1 block text-sm font-black text-[var(--foreground)]">{money(vehicle.profit)}</span>
                  </div>
                </div>
                <div className="mt-3">
                  <ComplianceBadge attention={vehicle.complianceAttentionCount} item={vehicle.complianceNext} />
                </div>
                <div className="mt-3">
                  <div className="font-mono-data mb-1 text-xs text-[var(--muted)]">{vehicle.utilization}% rented in the last 12 months</div>
                  <ProgressBar value={vehicle.utilization} tone={vehicle.utilization > 80 ? "green" : "amber"} />
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </Card>
    </AppShell>
  );
}
