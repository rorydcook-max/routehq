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
  vehicleCount
}: {
  totalPurchasePrice: number;
  totalFleetValue: number;
  totalDepreciation: number;
  vehicleCount: number;
}) {
  return (
    <section style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}>
      <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[#717d86]">Fleet value</p>
      <p className="m-0 mt-1 text-[22px] font-medium tracking-[-0.02em] text-[#1a1d21]">{thb(totalFleetValue)}</p>
      <p className="m-0 mb-2 text-[11px] text-[#717d86]">
        {vehicleCount} vehicles · cost {thb(totalPurchasePrice)}
      </p>
      <div className="flex flex-col gap-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-[#717d86]">Purchase cost</span>
          <span className="font-medium text-[#454d54]">{thb(totalPurchasePrice)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#717d86]">Est. current value</span>
          <span className="font-medium text-[#454d54]">{thb(totalFleetValue)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#717d86]">Depreciation</span>
          <span className={`font-medium ${totalDepreciation > 0 ? "text-[#dc2626]" : "text-[#454d54]"}`}>
            {totalDepreciation > 0 ? `−${thb(totalDepreciation)}` : thb(Math.abs(totalDepreciation))}
          </span>
        </div>
      </div>
    </section>
  );
}
