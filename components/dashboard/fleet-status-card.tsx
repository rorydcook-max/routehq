import Link from "next/link";

export function FleetStatusCard({
  totalVehicles,
  rentedCount,
  availableCount,
  maintenanceCount,
  fleetUtilization
}: {
  totalVehicles: number;
  rentedCount: number;
  availableCount: number;
  maintenanceCount: number;
  fleetUtilization: number;
}) {
  const tiles = [
    { label: "Rented", value: rentedCount },
    { label: "Available", value: availableCount },
    { label: "Maintenance", value: maintenanceCount },
    { label: "Utilization", value: `${fleetUtilization}%` }
  ];

  return (
    <section style={{ background: 'linear-gradient(135deg, #12BCB8 0%, #1EBFBA 100%)', borderRadius: 11, padding: "14px 16px" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
        {tiles.map((tile) => (
          <div
            key={tile.label}
            style={{
              background: "rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "10px 12px",
              textAlign: "center" as const
            }}
          >
            <p style={{ fontSize: "22px", fontWeight: 500, color: "#ffffff", margin: 0, letterSpacing: "-0.02em" }}>
              {tile.value}
            </p>
            <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.65)", margin: "3px 0 0", fontWeight: 500 }}>
              {tile.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
