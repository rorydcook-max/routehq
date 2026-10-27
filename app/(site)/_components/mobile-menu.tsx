"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { SiteLink } from "./site-ui";
import s from "../site.module.css";

type Item = { href: string; label: string };

/** The website menu on phones: a button that opens a panel under the header, closed again on every page change. */
export function MobileMenu({ items, signIn, trial, openLabel, closeLabel }: { items: Item[]; signIn: Item; trial: Item; openLabel: string; closeLabel: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const panel = useRef<HTMLDivElement>(null);

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
        className="no-press inline-flex h-11 w-11 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--foreground)]"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
      </button>
      {open ? (
        <div className={`${s.menuPanel} p-3`} id="site-menu" ref={panel}>
          <nav className="flex flex-col">
            {items.map((item) => (
              <SiteLink className="rounded-xl px-3 py-3 text-[17px] font-semibold text-[var(--foreground)] hover:bg-[var(--panel-secondary)]" href={item.href} key={item.href} onClick={() => setOpen(false)}>
                {item.label}
              </SiteLink>
            ))}
          </nav>
          <div className="mt-2 grid gap-2 border-t border-[var(--border)] pt-3">
            <SiteLink className={s.btnSecondary} href={signIn.href}>
              {signIn.label}
            </SiteLink>
            <SiteLink className={s.btnPrimary} href={trial.href}>
              {trial.label}
            </SiteLink>
          </div>
        </div>
      ) : null}
    </div>
  );
}
