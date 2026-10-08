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
        navy={onDark ? "#ffffff" : "#1B2430"}
        teal="#D9784F"
      />
    );
  }

  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <RouteHqMark className="h-10 w-10 shrink-0" navy={onDark ? "#ffffff" : "#1B2430"} teal="#D9784F" />
      <div className="min-w-0">
        <div className="flex items-baseline whitespace-nowrap text-[1.35rem] font-black leading-none tracking-[-0.04em]">
          <span className={onDark ? "text-white" : "text-[#1B2430]"}>Route</span>
          <span className="text-[#D9784F]">HQ</span>
        </div>
        {/* No English strapline under the name: the name is enough, in every language. */}
      </div>
    </div>
  );
}

function RouteHqMark({ className, navy, teal }: { className?: string; navy: string; teal: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 47.5 9 32.5 26.5 50H11.5A2.5 2.5 0 0 1 9 47.5Z" fill={teal} />
      <path
        d="M8 15.5h35.5c7.8 0 12.8 4.6 12.8 11.3 0 6.1-4 10.4-10.3 11.1L57.5 50H41.6L29.4 36.8h10.9c3.5 0 5.8-1.8 5.8-4.9 0-3-2.3-4.8-5.8-4.8H19.6L8 15.5Z"
        fill={navy}
      />
    </svg>
  );
}
