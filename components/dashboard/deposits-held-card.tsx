const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

export function DepositsHeldCard({
  depositsHeld,
  depositsHeldCount,
  depositsByVehicle
}: {
  depositsHeld: number;
  depositsHeldCount: number;
  depositsByVehicle: Array<{ vehicle: string; amount: number }>;
}) {
  return (
    <section style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}>
      <p className="m-0 text-[10px] font-medium uppercase tracking-[0.08em] text-[#717d86]">Deposits held</p>
      <p className="m-0 mt-1 text-[22px] font-medium tracking-[-0.02em] text-[#d97706]">{thb(depositsHeld)}</p>
      <p className="m-0 mb-2 text-[11px] text-[#717d86]">
        {depositsHeldCount === 0 ? "No deposits currently held" : `Across ${depositsHeldCount} active rentals`}
      </p>
      {depositsHeld > 0 ? (
        <>
          <div className="mb-1.5 rounded-md px-[9px] py-1.5" style={{ background: "#fffbeb", border: "0.5px solid #fde68a" }}>
            <p className="m-0 text-[10px] font-medium text-[#d97706]">Liability — not revenue</p>
          </div>
          <div className="flex flex-col gap-1">
            {depositsByVehicle.slice(0, 2).map((row, index) => (
              <div className="flex justify-between gap-2 text-[11px]" key={`${row.vehicle}-${index}`}>
                <span className="truncate text-[#454d54]">{row.vehicle}</span>
                <span className="shrink-0 font-medium text-[#d97706]">{thb(row.amount)}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  );
}
