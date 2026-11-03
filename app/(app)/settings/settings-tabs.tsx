"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useRef } from "react";

/**
 * The settings tab bar. On a phone it is one line that scrolls sideways (chip-row), so the tab
 * you are on is scrolled into view when the page opens; otherwise it can sit off-screen and no
 * tab looks selected.
 */
export function SettingsTabs({ label, tabs }: { label: string; tabs: Array<{ key: string; label: string; href: string; className: string; active: boolean }> }) {
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active || nav.scrollWidth <= nav.clientWidth) return;
    // Centre the active tab inside the bar only: scrollIntoView would also scroll the page.
    nav.scrollLeft = Math.max(0, active.offsetLeft - (nav.clientWidth - active.offsetWidth) / 2);
  }, [tabs]);

  return (
    <nav aria-label={label} className="chip-row scrollbar-none relative -mx-[14px] -my-1.5 flex gap-2 px-[14px] py-1.5 sm:mx-0 sm:flex-wrap sm:px-0" ref={navRef}>
      {tabs.map((tab) => (
        <Link aria-current={tab.active ? "page" : undefined} className={tab.className} href={tab.href as Route} key={tab.key}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
