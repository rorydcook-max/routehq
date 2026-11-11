"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * A "More" fold that is only a fold on a phone: on a desktop-width screen it is always open, so its buttons sit
 * in the row with the others (Rory, 11 Nov 2026: "they can all fit on the same line"). Hide the summary with lg:hidden.
 */
export function DesktopOpenDetails({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const wide = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (ref.current && wide.matches) ref.current.open = true;
    };
    sync();
    wide.addEventListener("change", sync);
    return () => wide.removeEventListener("change", sync);
  }, []);
  return (
    <details className={className} ref={ref}>
      {children}
    </details>
  );
}
