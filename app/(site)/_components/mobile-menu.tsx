"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { SiteLink } from "./site-ui";
import s from "../site.module.css";

type Item = { href: string; label: string };

/** The website menu on phones: a button that opens a full-screen ink panel, closed again on every page change. */
export function MobileMenu({ items, signIn, start, logo, language, openLabel, closeLabel }: { items: Item[]; signIn: Item; start: Item; logo: ReactNode; language: ReactNode; openLabel: string; closeLabel: string }) {
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
          <nav>
            {items.map((item) => (
              <SiteLink className={s.menuLink} href={item.href} key={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </SiteLink>
            ))}
          </nav>
          <div className={s.menuActions}>
            {language}
            <SiteLink className={`${s.btn} ${s.btnOutline}`} href={signIn.href}>
              {signIn.label}
            </SiteLink>
            <SiteLink className={`${s.btn} ${s.btnLight}`} href={start.href}>
              {start.label}
            </SiteLink>
          </div>
        </div>
      ) : null}
    </>
  );
}
