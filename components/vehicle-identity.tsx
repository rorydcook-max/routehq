import type { ReactNode } from "react";

/**
 * One way to show which vehicle this is, everywhere: the name, then the year, then the number plate as a chip.
 * "Honda City  2023  [TEST-7894]". Pages that list vehicles and pages about one vehicle both use it.
 */

/** The number plate as a small plate-like chip. `size="lg"` is the big plate on a vehicle's own page. */
export function PlateChip({ plate, province, size = "sm", className = "" }: { plate?: string | null; province?: string | null; size?: "sm" | "lg"; className?: string }) {
  if (!plate) return null;
  if (size === "lg") {
    return (
      <span className={`thai-plate ${className}`}>
        <span className="thai-plate-number font-mono-data">{plate}</span>
        {province ? <span className="thai-plate-province">{province}</span> : null}
      </span>
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-[5px] border-[1.5px] border-[#1a1d21] bg-white px-1.5 py-[3px] text-[12px] font-bold leading-none tracking-[0.06em] text-[#1a1d21] tabular-nums ${className}`}
      title={province || undefined}
    >
      {plate}
    </span>
  );
}

/** "Honda City" (make, model, version) without the year: the year sits beside it in grey. */
export function vehicleName(vehicle: { make?: string | null; model?: string | null; trim?: string | null }) {
  return [vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ");
}

/** Name, year and plate on one line (wrapping on phones). `as` sets the heading level of the name. */
export function VehicleTitle({
  name,
  year,
  plate,
  province,
  as: Tag = "span",
  className = "",
  nameClassName = "font-semibold text-[var(--foreground)]",
  plateClassName = "",
  children
}: {
  name: ReactNode;
  year?: string | number | null;
  plate?: string | null;
  province?: string | null;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  className?: string;
  nameClassName?: string;
  /** Extra classes for the plate chip, e.g. a larger size beside a page title. */
  plateClassName?: string;
  children?: ReactNode;
}) {
  // Inline (inside links and rows) it is all spans; as a page heading the wrapper is a block.
  const Wrap = Tag === "span" ? "span" : "div";
  return (
    <Wrap className={`flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 ${className}`}>
      <Tag className={`min-w-0 ${nameClassName}`}>
        {name}
        {year ? <span className="ms-1.5 font-medium text-[var(--muted)]">{year}</span> : null}
      </Tag>
      <PlateChip className={plateClassName} plate={plate} province={province} />
      {children}
    </Wrap>
  );
}
