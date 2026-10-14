"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export type PageTab = { id: string; label: string; count?: number; alert?: boolean; content: ReactNode };

/**
 * One row of tabs instead of a long stack of folded sections. Every panel stays
 * mounted (a half-filled form survives a tab switch); only the chosen one shows.
 * A link to "#money" (or an older anchor listed in `aliases`) opens that tab.
 */
export function PageTabs({ tabs, initial, aliases = {}, label }: { tabs: PageTab[]; initial: string; aliases?: Record<string, string>; label: string }) {
  const [active, setActive] = useState(initial);
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = (scroll: boolean) => {
      const raw = decodeURIComponent(window.location.hash.replace(/^#/, ""));
      const id = aliases[raw] || raw;
      if (!tabs.some((tab) => tab.id === id)) return;
      setActive(id);
      if (scroll) bar.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    fromHash(Boolean(window.location.hash));
    const onHash = () => fromHash(true);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the chosen tab in view on a phone, where the row scrolls sideways.
  useEffect(() => {
    const row = bar.current?.querySelector<HTMLElement>('[role="tablist"]');
    const chip = row?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    if (!row || !chip) return;
    if (chip.offsetLeft < row.scrollLeft || chip.offsetLeft + chip.offsetWidth > row.scrollLeft + row.clientWidth) {
      row.scrollTo({ left: Math.max(0, chip.offsetLeft - 16), behavior: "smooth" });
    }
  }, [active]);

  const choose = (id: string) => {
    setActive(id);
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div>
      <div className="scroll-mt-4" ref={bar}>
        <div aria-label={label} className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 py-1" role="tablist">
          {tabs.map((tab) => {
            const on = tab.id === active;
            return (
              <button
                aria-controls={`panel-${tab.id}`}
                aria-selected={on}
                className={`pressable inline-flex min-h-11 flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 font-bold transition ${on ? "bg-[var(--primary)] text-white shadow-[var(--shadow-card)]" : "bg-white text-[var(--foreground)] shadow-[var(--shadow-card)] hover:text-[var(--primary)]"}`}
                data-tab={tab.id}
                id={`tab-${tab.id}`}
                key={tab.id}
                onClick={() => choose(tab.id)}
                role="tab"
                type="button"
              >
                {tab.label}
                {tab.count ? (
                  <span className={`num inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[14px] ${on ? "bg-white/25 text-white" : tab.alert ? "bg-[var(--danger)] text-white" : "bg-[var(--primary-light)] text-[var(--primary)]"}`}>{tab.count}</span>
                ) : tab.alert ? (
                  <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--danger)]" />
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      {tabs.map((tab) => (
        <div aria-labelledby={`tab-${tab.id}`} className="tab-panel mt-3" hidden={tab.id !== active} id={`panel-${tab.id}`} key={tab.id} role="tabpanel">
          {tab.content}
        </div>
      ))}
    </div>
  );
}
