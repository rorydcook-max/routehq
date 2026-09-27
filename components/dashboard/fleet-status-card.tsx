import Link from "next/link";

export function FleetStatusCard({
  totalVehicles,
  rentedCount,
  reservedCount = 0,
  availableCount,
  maintenanceCount,
  fleetUtilization
}: {
  totalVehicles: number;
  rentedCount: number;
  /** Booked for an upcoming rental, not yet handed over. */
  reservedCount?: number;
  availableCount: number;
  maintenanceCount: number;
  fleetUtilization: number;
}) {
  // Every vehicle is in exactly one tile, so the tiles add up to the total.
  const tiles = [
    { label: "Rented", value: rentedCount },
    ...(reservedCount > 0 ? [{ label: "Booked", value: reservedCount }] : []),
    { label: "Available", value: availableCount },
    { label: "Maintenance", value: maintenanceCount },
    { label: "Utilization", value: `${fleetUtilization}%` }
  ];

  return (
    <section className="rounded-xl p-4" style={{ background: "var(--gradient-teal)" }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-white/60">Fleet status</p>
          <p className="m-0 text-[15px] font-medium text-white">
            {totalVehicles} vehicles · {rentedCount} currently rented
          </p>
        </div>
        <Link className="inline-flex items-center gap-1 text-[11px] font-medium text-white/70" href="/fleet">
          View fleet
          <i className="ti ti-arrow-right text-[11px]" aria-hidden="true" />
        </Link>
      </div>
      <div className={`grid gap-2 ${tiles.length > 4 ? "grid-cols-3 sm:grid-cols-5" : "grid-cols-4"}`}>
        {tiles.map((tile) => (
          <div className="rounded-lg bg-white/10 p-2.5 text-center" key={tile.label}>
            <p className="m-0 text-[22px] font-medium text-white" style={{ letterSpacing: "-0.02em" }}>
              {tile.value}
            </p>
            <p className="mt-0.5 text-[10px] font-medium text-white/65">
              {tile.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
