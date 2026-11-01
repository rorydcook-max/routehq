"use client";

import { useEffect } from "react";

/**
 * When the address ends in #<hash>, opens the folded sections with these ids (outer first) and scrolls to the last.
 * A link like "Log a service or repair" then lands on the open form, not on a closed card.
 */
export function OpenFoldsOnHash({ hash, ids }: { hash: string; ids: string[] }) {
  useEffect(() => {
    const open = () => {
      if (decodeURIComponent(window.location.hash.replace(/^#/, "")) !== hash) return;
      // After the tab has switched (PageTabs reacts to the same hash).
      window.setTimeout(() => {
        let last: HTMLElement | null = null;
        for (const id of ids) {
          const element = document.getElementById(id);
          if (element instanceof HTMLDetailsElement) element.open = true;
          if (element) last = element;
        }
        last?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
    };
    open();
    window.addEventListener("hashchange", open);
    return () => window.removeEventListener("hashchange", open);
  }, [hash, ids]);
  return null;
}
