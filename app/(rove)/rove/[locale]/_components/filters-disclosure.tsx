"use client";

import { useEffect, useState, type ReactNode } from "react";

/** The search filters: folded away on a phone (results first), open beside the results on a wide screen. */
export function FiltersDisclosure({ summary, className, children }: { summary: ReactNode; className?: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(min-width: 960px)").matches) setOpen(true);
  }, []);
  return (
    <details className={className} onToggle={(event) => setOpen((event.target as HTMLDetailsElement).open)} open={open}>
      <summary style={{ cursor: "pointer", fontWeight: 700, listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {summary}
        <i aria-hidden="true" className={`ti ${open ? "ti-chevron-up" : "ti-adjustments-horizontal"}`} style={{ fontSize: 18 }} />
      </summary>
      {children}
    </details>
  );
}
