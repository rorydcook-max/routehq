"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { SiteLink } from "./site-ui";
import s from "../site.module.css";

type Item = { href: string; label: string };

/** The website menu on phones: a button that opens a panel under the header, closed again on every page change. */
export function MobileMenu({ items, signIn, trial, openLabel, closeLabel }: { items: Item[]; signIn: Item; trial: Item; openLabel: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        aria-controls="site-menu"
        aria-expanded={open}
        aria-label={open ? closeLabel : openLabel}
        className={`no-press ${s.menuButton}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
      </button>
      {open ? (
        <div className={s.menuPanel} id="site-menu">
          <nav className="flex flex-col">
            {items.map((item) => (
              <SiteLink className={s.menuLink} href={item.href} key={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </SiteLink>
            ))}
          </nav>
          <div className="mt-2 grid gap-2 border-t border-[var(--ink-line)] pt-3">
            <SiteLink className={`${s.btn} ${s.btnOutlineDark}`} href={signIn.href}>
              {signIn.label}
            </SiteLink>
            <SiteLink className={`${s.btn} ${s.btnSignal}`} href={trial.href}>
              {trial.label}
            </SiteLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
