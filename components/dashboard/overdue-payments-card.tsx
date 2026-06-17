import Link from "next/link";

const thb = (value: number) =>
  new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);

export function OverduePaymentsCard({
  overdueTotal,
  overdueCount,
  overdueRows
}: {
  overdueTotal: number;
  overdueCount: number;
  overdueRows: Array<{ customer: string; balance: number; vehicle: string; daysOverdue: number }>;
}) {
  return (
    <Link className="block" href="/bookings">
      <section style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}>
        <p className="m-0 mb-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#717d86]">Overdue payments</p>
        <p className="m-0 text-[22px] font-medium tracking-[-0.02em] text-[#dc2626]">{thb(overdueTotal)}</p>
        <p className="m-0 mb-2 text-[11px] text-[#717d86]">{overdueCount} rentals with balance</p>
        <div className="flex flex-col gap-1">
          {overdueRows.length === 0 ? (
            <p className="m-0 text-[11px] text-[#717d86]">No overdue payments</p>
          ) : (
            overdueRows.slice(0, 3).map((row, index) => (
              <div className="flex justify-between gap-2 text-[11px]" key={`${row.customer}-${row.vehicle}-${index}`}>
                <span className="max-w-[60%] truncate text-[#454d54]">{row.customer}</span>
                <span className="shrink-0 font-medium text-[#dc2626]">{thb(row.balance)}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </Link>
  );
}
