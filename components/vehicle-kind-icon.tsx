import { Bike, Bus, Car, Truck } from "lucide-react";
import { useTranslations } from "next-intl";
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
  car: "bg-[var(--primary-light)] text-[var(--primary)]",
  van: "bg-[var(--info-light)] text-[var(--info)]",
  motorbike: "bg-[var(--warning-light)] text-[var(--warning)]",
  scooter: "bg-[var(--purple-light)] text-[var(--purple)]",
  ebike: "bg-[var(--success-light)] text-[var(--success)]",
  atv: "bg-[var(--warning-light)] text-[var(--warning)]",
  other: "bg-[var(--panel-tertiary)] text-[var(--muted)]"
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
  const t = useTranslations("common");
  return (
    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--muted)]">
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--info)]" />{t("countOut", { count: out })}</span>
      <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--success)]" />{t("countFree", { count: free })}</span>
      {other > 0 ? <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[var(--warning)]" />{t("countBookedOrShop", { count: other })}</span> : null}
    </span>
  );
}
