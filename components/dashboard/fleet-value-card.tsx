const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

export function FleetValueCard({
  totalPurchasePrice,
  totalFleetValue,
  totalDepreciation,
  valuedCount,
  vehicleCount
}: {
  totalPurchasePrice: number;
  totalFleetValue: number;
  totalDepreciation: number;
  valuedCount: number;
  vehicleCount: number;
}) {
  return (
    <section style={{ background: "#ffffff", border: "1px solid var(--border)", borderRadius: 12, boxShadow: "var(--shadow-sm)", padding: "13px 14px" }}>
      <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[var(--muted)]">Fleet value</p>
      <p className="m-0 mt-1 text-[22px] font-medium tracking-[-0.02em] text-[var(--foreground)]">{thb(totalFleetValue)}</p>
      <p className="m-0 mb-2 text-[11px] text-[var(--muted)]">
        {vehicleCount} vehicles · cost {thb(totalPurchasePrice)}
      </p>
      <div className="flex flex-col gap-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-[var(--muted)]">Purchase cost</span>
          <span className="font-medium text-[var(--foreground-secondary)]">{thb(totalPurchasePrice)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[var(--muted)]">Est. current value</span>
          <span className="font-medium text-[var(--foreground-secondary)]">{thb(totalFleetValue)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[var(--muted)]">{totalDepreciation < 0 ? "Gain in value" : "Depreciation"}</span>
          <span className={`font-medium ${totalDepreciation > 0 ? "text-[var(--danger)]" : totalDepreciation < 0 ? "text-[var(--success)]" : "text-[var(--foreground-secondary)]"}`}>
            {totalDepreciation > 0 ? `−${thb(totalDepreciation)}` : totalDepreciation < 0 ? `+${thb(Math.abs(totalDepreciation))}` : thb(0)}
          </span>
        </div>
      </div>
      {valuedCount < vehicleCount ? (
        <a className="mt-2 block text-[11px] font-medium text-[var(--warning)] underline-offset-2 hover:underline" href="/fleet">
          {valuedCount === 0 ? "No vehicle has a current value yet" : `Current value set for ${valuedCount} of ${vehicleCount} vehicles`} - others count at cost
        </a>
      ) : null}
    </section>
  );
}
