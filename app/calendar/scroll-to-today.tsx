"use client";

import { useEffect } from "react";

/** On a phone the month is wider than the screen; start with today in view. */
export function ScrollToToday({ targetId }: { targetId: string }) {
  useEffect(() => {
    const cell = document.getElementById(targetId);
    const scroller = cell?.closest("[data-scroller]") as HTMLElement | null;
    if (!cell || !scroller) return;
    const sticky = Number(scroller.dataset.sticky || 0);
    // Leave two days of history visible to the left of today.
    scroller.scrollLeft = Math.max(0, cell.offsetLeft - sticky - cell.offsetWidth * 2);
  }, [targetId]);
  return null;
}
