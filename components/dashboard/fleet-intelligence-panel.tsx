"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Gauge } from "lucide-react";
import { useMemo, useState } from "react";
import type { Vehicle } from "@/lib/types";
import { Badge, Card, ProgressBar, SectionHeader } from "@/components/ui";

const pageSize = 10;
const collapsedRows = 5;

const vehicleStatusTone = {
  Rented: "blue",
  Available: "green",
  Maintenance: "red",
  Reserved: "amber"
} as const;

const money = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

export function FleetIntelligencePanel({ averageUtilization, vehicles }: { averageUtilization: number; vehicles: Vehicle[] }) {
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(vehicles.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);

  const pageVehicles = useMemo(() => {
    const start = safePage * pageSize;
    return vehicles.slice(start, start + pageSize);
  }, [safePage, vehicles]);

  const visibleVehicles = expanded ? pageVehicles : pageVehicles.slice(0, collapsedRows);
  const canExpand = pageVehicles.length > collapsedRows;
  const hasPages = vehicles.length > pageSize;

  const goToPage = (nextPage: number) => {
    setExpanded(false);
    setPage(Math.max(0, Math.min(nextPage, totalPages - 1)));
  };

  return (
    <Card className="analytics-panel self-start">
      <SectionHeader eyebrow="Fleet intelligence" title="Profitability, utilization and readiness" action={<Badge tone="blue">{averageUtilization}% avg utilization</Badge>} />
      <div className="relative mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase">
                <th className="py-2 pr-3">Vehicle</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Monthly</th>
                <th className="px-3 py-2">12 month util.</th>
                <th className="px-3 py-2">Lifecycle util.</th>
                <th className="px-3 py-2">Profit</th>
                <th className="px-3 py-2">Health</th>
                <th className="px-3 py-2">Risk</th>
              </tr>
            </thead>
            <tbody>
              {visibleVehicles.map((vehicle) => (
                <tr className="border-b last:border-0" key={vehicle.id}>
                  <td className="py-3 pr-3">
                    <div className="font-semibold text-white">
                      {vehicle.make} {vehicle.model}
                    </div>
                    <div className="analytics-muted">
                      {vehicle.plate} · {vehicle.year} · {vehicle.mileage.toLocaleString()} km
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={vehicleStatusTone[vehicle.status]}>{vehicle.status}</Badge>
                  </td>
                  <td className="px-3 py-3 font-semibold">{money(vehicle.monthlyRate)}</td>
                  <td className="px-3 py-3">
                    <div className="min-w-28">
                      <div className="analytics-muted mb-1 flex justify-between text-xs">
                        <span>{vehicle.utilization}%</span>
                      </div>
                      <ProgressBar value={vehicle.utilization} tone={vehicle.utilization > 80 ? "green" : "amber"} />
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="min-w-28">
                      <div className="analytics-muted mb-1 text-xs">{vehicle.lifecycleUtilization}%</div>
                      <ProgressBar value={vehicle.lifecycleUtilization} tone="blue" />
                    </div>
                  </td>
                  <td className="px-3 py-3 font-semibold">{money(vehicle.profit)}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-2">
                      <Gauge size={16} className={vehicle.healthScore < 70 ? "text-[var(--danger)]" : "text-[var(--primary)]"} />
                      <span className="font-semibold">{vehicle.healthScore}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={vehicle.healthScore < 70 ? "red" : vehicle.utilization < 78 ? "amber" : "green"}>
                      {vehicle.healthScore < 70 ? "High" : vehicle.utilization < 78 ? "Watch" : "Low"}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!expanded && canExpand ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-[#071b35] to-transparent" /> : null}
      </div>

      {canExpand || hasPages ? (
        <div className="mt-4 grid min-h-[56px] grid-cols-1 items-center gap-3 border-t border-white/10 pt-4 sm:grid-cols-[1fr_auto_1fr]">
          <div className="analytics-muted text-sm">
            Showing {visibleVehicles.length} of {pageVehicles.length} vehicles on this page
            {hasPages ? ` · Page ${safePage + 1} of ${totalPages}` : ""}
          </div>
          {canExpand ? (
            <button
              aria-label={expanded ? "Collapse fleet intelligence" : "Expand fleet intelligence"}
              className="pressable mx-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-white/12 text-white shadow-[0_12px_26px_rgba(0,0,0,0.22)] hover:bg-white/18"
              onClick={() => setExpanded((current) => !current)}
              type="button"
            >
              {expanded ? <ChevronUp size={22} /> : <ChevronDown size={22} />}
            </button>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
            {hasPages ? (
              <div className="flex items-center gap-2">
                <button
                  aria-label="Previous vehicle page"
                  className="pressable inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white disabled:opacity-40"
                  disabled={safePage === 0}
                  onClick={() => goToPage(safePage - 1)}
                  type="button"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  aria-label="Next vehicle page"
                  className="pressable inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white disabled:opacity-40"
                  disabled={safePage >= totalPages - 1}
                  onClick={() => goToPage(safePage + 1)}
                  type="button"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
