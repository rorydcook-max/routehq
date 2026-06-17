import { clsx } from "clsx";

type RouteHqLogoProps = {
  variant?: "full" | "mark";
  tone?: "light" | "dark";
  className?: string;
  showDescriptor?: boolean;
};

export function RouteHqLogo({ className, showDescriptor = true, tone = "light", variant = "full" }: RouteHqLogoProps) {
  const onDark = tone === "dark";

  if (variant === "mark") {
    return (
      <RouteHqMark
        className={clsx("h-9 w-9", className)}
        navy={onDark ? "#ffffff" : "#0B1320"}
        teal="#06B6B6"
      />
    );
  }

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <RouteHqMark className="h-10 w-10 shrink-0" navy={onDark ? "#ffffff" : "#0B1320"} teal="#06B6B6" />
      <div className="min-w-0">
        <div className="flex items-baseline whitespace-nowrap text-[1.35rem] font-black leading-none tracking-[-0.04em]">
          <span className={onDark ? "text-white" : "text-[#0B1320]"}>Route</span>
          <span className="text-[#06B6B6]">HQ</span>
        </div>
        {showDescriptor ? (
          <div className={clsx("mt-1 text-[8px] font-bold uppercase tracking-[0.36em]", onDark ? "text-white/70" : "text-[#0B1320]/70")}>
            Rental Operations OS
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RouteHqMark({ className, navy, teal }: { className?: string; navy: string; teal: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="routehq-teal" x1="10" x2="38" y1="44" y2="62" gradientUnits="userSpaceOnUse">
          <stop stopColor={teal} />
          <stop offset="1" stopColor="#0EA5FF" />
        </linearGradient>
      </defs>
      <path d="M9 47.5 9 32.5 26.5 50H11.5A2.5 2.5 0 0 1 9 47.5Z" fill="url(#routehq-teal)" />
      <path
        d="M8 15.5h35.5c7.8 0 12.8 4.6 12.8 11.3 0 6.1-4 10.4-10.3 11.1L57.5 50H41.6L29.4 36.8h10.9c3.5 0 5.8-1.8 5.8-4.9 0-3-2.3-4.8-5.8-4.8H19.6L8 15.5Z"
        fill={navy}
      />
    </svg>
  );
}
