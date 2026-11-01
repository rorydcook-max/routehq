"use client";

import type { ReactNode } from "react";

/**
 * A link to a place on the same page ("#log-service"). Next's <Link> changes the address without a "hashchange",
 * so the tabs and folded sections listening for it never heard the tap, and a second tap on the same link changed nothing at all
 * (Rory, 1 Nov 2026: "Log a service or repair still doesn't seem to do anything"). This always tells them.
 */
export function HashLink({ hash, className, children }: { hash: string; className?: string; children: ReactNode }) {
  return (
    <a
      className={className}
      href={`#${hash}`}
      onClick={(event) => {
        event.preventDefault();
        const before = window.location.href;
        window.history.replaceState(window.history.state, "", `#${hash}`);
        window.dispatchEvent(new HashChangeEvent("hashchange", { oldURL: before, newURL: window.location.href }));
      }}
    >
      {children}
    </a>
  );
}
