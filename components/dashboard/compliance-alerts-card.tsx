import Link from "next/link";
import type { Reminder } from "@/lib/types";

type AlertBuckets = {
  high: Reminder[];
  medium: Reminder[];
  low: Reminder[];
};

function daysLabel(due: string) {
  const dueTime = new Date(due).getTime();
  if (Number.isNaN(dueTime)) return due;
  const days = Math.ceil((dueTime - Date.now()) / 86_400_000);
  return days < 0 ? "Expired" : `${days} days`;
}

function alertRow(reminder: Reminder) {
  const isHigh = reminder.severity === "High";
  const color = isHigh ? "#dc2626" : "#d97706";
  const border = isHigh ? "#fecaca" : "#fde68a";
  const background = isHigh ? "#fef2f2" : "#fffbeb";

  return (
    <div
      key={reminder.id}
      style={{
        background,
        border: `0.5px solid ${border}`,
        borderRadius: "7px",
        padding: "8px 10px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}
    >
      <div className="min-w-0">
        <p className="m-0 truncate text-[12px] font-medium" style={{ color }}>{reminder.title}</p>
        <p className="m-0 truncate text-[11px]" style={{ color, opacity: 0.7 }}>{reminder.target}</p>
      </div>
      <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold" style={{ color, border: `0.5px solid ${border}`, flexShrink: 0, marginLeft: "8px" }}>
        {daysLabel(reminder.due)}
      </span>
    </div>
  );
}

export function ComplianceAlertsCard({
  alertCounts,
  alertBuckets
}: {
  alertCounts: { high: number; medium: number; low: number };
  alertBuckets: AlertBuckets;
}) {
  const rows = alertBuckets.high.length > 0 ? alertBuckets.high.slice(0, 2) : alertBuckets.medium.slice(0, 2);

  return (
    <Link className="block" href="/calendar">
      <section style={{ background: "#ffffff", border: "0.5px solid #e2e8f0", borderRadius: 10, padding: "13px 14px" }}>
        <p className="m-0 mb-2.5 text-[10px] font-medium uppercase tracking-[0.08em] text-[#717d86]">Compliance alerts</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "7px", marginBottom: "10px" }}>
          <div className="text-center" style={{ background: "#fef2f2", border: "0.5px solid #fecaca", borderRadius: "7px", padding: "9px 6px" }}>
            <p className="m-0 text-[22px] font-medium text-[#dc2626]">{alertCounts.high}</p>
            <p className="m-0 text-[10px] font-medium text-[#dc2626]">High</p>
            <p className="m-0 text-[10px] text-[#dc2626]/65">≤7 days</p>
          </div>
          <div className="text-center" style={{ background: "#fffbeb", border: "0.5px solid #fde68a", borderRadius: "7px", padding: "9px 6px" }}>
            <p className="m-0 text-[22px] font-medium text-[#d97706]">{alertCounts.medium}</p>
            <p className="m-0 text-[10px] font-medium text-[#d97706]">Medium</p>
            <p className="m-0 text-[10px] text-[#d97706]/65">≤14 days</p>
          </div>
          <div className="text-center" style={{ background: "#f0fdf4", border: "0.5px solid #bbf7d0", borderRadius: "7px", padding: "9px 6px" }}>
            <p className="m-0 text-[22px] font-medium text-[#16a34a]">{alertCounts.low}</p>
            <p className="m-0 text-[10px] font-medium text-[#16a34a]">Low</p>
            <p className="m-0 text-[10px] text-[#16a34a]/65">≤28 days</p>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column" as const, gap: "6px" }}>
          {rows.length > 0 ? rows.map(alertRow) : <p className="m-0 text-[11px] text-[#717d86]">No active alerts</p>}
        </div>
      </section>
    </Link>
  );
}
