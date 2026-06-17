const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

function amount(value: number) {
  return value < 0 ? `−${thb(Math.abs(value))}` : thb(value);
}

export function FleetPnLCard({
  fleetNetPnL,
  totalDepreciation,
  totalOperatingProfit
}: {
  fleetNetPnL: number;
  totalDepreciation: number;
  totalOperatingProfit: number;
}) {
  const valueChange = -totalDepreciation;

  return (
    <section style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}>
      <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[#717d86]">Fleet P&amp;L</p>
      <p className={`m-0 mt-1 text-[22px] font-medium tracking-[-0.02em] ${fleetNetPnL < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>
        {amount(fleetNetPnL)}
      </p>
      <p className="m-0 mb-2 text-[11px] text-[#717d86]">(Value − cost) + ops profit</p>
      <div className="flex flex-col gap-1 text-[11px]">
        <div className="flex justify-between gap-2">
          <span className="text-[#717d86]">Value change</span>
          <span className={`font-medium ${valueChange < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{amount(valueChange)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#717d86]">Ops profit</span>
          <span className={`font-medium ${totalOperatingProfit < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{amount(totalOperatingProfit)}</span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-[#717d86]">Net P&amp;L</span>
          <span className={`font-medium ${fleetNetPnL < 0 ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{amount(fleetNetPnL)}</span>
        </div>
      </div>
    </section>
  );
}
