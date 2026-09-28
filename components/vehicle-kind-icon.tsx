import { Bike, Bus, Car, Truck } from "lucide-react";
import type { VehicleKind } from "@/lib/vehicle-groups";

function Motorbike({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <circle cx="5" cy="16" r="3" />
      <circle cx="19" cy="16" r="3" />
      <path d="M8 16h5l3-6h-4l-2 3H7" />
      <path d="M16 10l3 6" />
      <path d="M14 6h3l1 4" />
    </svg>
  );
}

function Scooter({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width={size}>
      <circle cx="5.5" cy="17" r="2.5" />
      <circle cx="18.5" cy="17" r="2.5" />
      <path d="M8 17h7.5" />
      <path d="M16 17l-2-11h3" />
      <path d="M3 13h7l1 4" />
    </svg>
  );
}

const TINT: Record<VehicleKind, string> = {
  car: "bg-[#e7f3f1] text-[var(--primary)]",
  van: "bg-[#eef2fb] text-[#2f6fdb]",
  motorbike: "bg-[#fdf1e7] text-[#c2621a]",
  scooter: "bg-[#f4effb] text-[#7a4fc4]",
  ebike: "bg-[#ecf7ee] text-[#2f8a4a]",
  atv: "bg-[#f7f1e6] text-[#8a6a2f]",
  other: "bg-[#f1efeb] text-[#6b675f]"
};

export function VehicleKindIcon({ kind, size = 18, boxed = true }: { kind: VehicleKind; size?: number; boxed?: boolean }) {
  const icon =
    kind === "car" ? <Car size={size} /> :
    kind === "van" ? <Bus size={size} /> :
    kind === "motorbike" ? <Motorbike size={size} /> :
    kind === "scooter" ? <Scooter size={size} /> :
    kind === "ebike" ? <Bike size={size} /> :
    kind === "atv" ? <Truck size={size} /> :
    <Car size={size} />;
  if (!boxed) return icon;
  return <span className={`inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[10px] ${TINT[kind]}`}>{icon}</span>;
}

/** "● 3 out · ● 2 free" summary used in fleet section headers and the dashboard. */
export function OutFreeSummary({ out, free, other = 0 }: { out: number; free: number; other?: number }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#2f6fdb]" />{out} out</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#16a34a]" />{free} free</span>
      {other > 0 ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4a017]" />{other} booked / in shop</span> : null}
    </span>
  );
}
