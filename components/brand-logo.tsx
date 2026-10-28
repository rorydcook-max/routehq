import { clsx } from "clsx";

type RouteHqLogoProps = {
  variant?: "full" | "mark";
  tone?: "light" | "dark";
  className?: string;
  showDescriptor?: boolean;
  /** "fleet": Lokalfleet, the operator software. "keys": Lokalkeys, the renter booking site (same mark). */
  product?: "fleet" | "keys";
};

export function RouteHqLogo({ className, product = "fleet", showDescriptor = true, tone = "light", variant = "full" }: RouteHqLogoProps) {
  const onDark = tone === "dark";

  if (variant === "mark") {
    return (
      <RouteHqMark
        className={clsx("h-9 w-9", className)}
        navy={onDark ? "#ffffff" : "var(--logo-ink, #1B2430)"}
        teal={onDark ? "var(--band-logo-accent, #12BCB8)" : "#06B6B6"}
      />
    );
  }

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <RouteHqMark className="h-10 w-10 shrink-0" navy={onDark ? "#ffffff" : "var(--logo-ink, #1B2430)"} teal={onDark ? "var(--band-logo-accent, #12BCB8)" : "#06B6B6"} />
      <div className="min-w-0">
        <div className="flex items-baseline whitespace-nowrap text-[1.35rem] font-black leading-none tracking-[-0.04em]">
          <span className={onDark ? "text-white" : "text-[var(--logo-ink,#1B2430)]"}>Lokal</span>
          <span className={onDark ? "text-[var(--band-logo-accent,#12BCB8)]" : "text-[#06B6B6]"}>{product === "keys" ? "keys" : "fleet"}</span>
        </div>
        {/* No English strapline under the name: the name is enough, in every language. */}
      </div>
    </div>
  );
}

function RouteHqMark({ className, navy, teal }: { className?: string; navy: string; teal: string }) {
  return (
    // Lokalfleet mark (Rory, 28 Oct): an L of two tiles, one free vehicle (the grey tile) and one on the move (the teal arc).
    <svg aria-hidden="true" className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <rect height="21" rx="6" style={{ fill: navy }} width="21" x="8" y="8" />
      <rect height="21" rx="6" style={{ fill: navy }} width="21" x="8" y="35" />
      <rect height="21" rx="6" style={{ fill: navy, opacity: 0.22 }} width="21" x="35" y="35" />
      <path d="M35 8h1a20 20 0 0 1 20 20v1H44a3 3 0 0 1-3-3a6 6 0 0 0-6-6Z" style={{ fill: teal }} />
    </svg>
  );
}
