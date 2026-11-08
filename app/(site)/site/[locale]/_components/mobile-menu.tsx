"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import s from "../site.module.css";

/**
 * The website menu on phones: a button that opens a full-screen ink panel, closed again on every page change.
 * Its links arrive drawn by the server (site-header.tsx; task perf2, 8 Nov 2026), so the website's link code and
 * next-intl stay out of the browser bundle; a tap on any of them closes the panel.
 */
export function MobileMenu({ links, actions, logo, openLabel, closeLabel }: { links: ReactNode; actions: ReactNode; logo: ReactNode; openLabel: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    if ((event.target as Element).closest("a")) setOpen(false);
  };

  const button = (
    <button aria-controls="site-menu" aria-expanded={open} aria-label={open ? closeLabel : openLabel} className={`no-press ${s.menuButton}`} onClick={() => setOpen((value) => !value)} type="button">
      {open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
    </button>
  );

  return (
    <>
      {button}
      {open ? (
        <div className={s.menu} id="site-menu">
          <div className={s.menuTop}>
            {logo}
            {button}
          </div>
          <nav onClick={closeOnLink}>{links}</nav>
          <div className={s.menuActions}>{actions}</div>
        </div>
      ) : null}
    </>
  );
}
