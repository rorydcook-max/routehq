"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Globe } from "lucide-react";
import { setMyLanguage } from "@/app/actions/settings";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

/**
 * Your own language in one tap, from the sidebar (Rory, 31 Oct 2026). Changes only what you see, like the
 * setting on My account; everyone else in the business keeps theirs. The list opens above the button.
 */
export function SidebarLanguage({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const t = useTranslations("nav");
  const locale = useLocale();
  const router = useRouter();
  const trigger = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ bottom: 0, left: 0 });
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const r = trigger.current?.getBoundingClientRect();
      if (!r) return;
      const width = 260;
      setPos({ bottom: window.innerHeight - r.top + 6, left: Math.max(8, Math.min(r.left, window.innerWidth - width - 8)) });
    };
    place();
    const close = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (!list.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("mousedown", close);
    window.addEventListener("touchstart", close);
    window.addEventListener("keydown", key);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("touchstart", close);
      window.removeEventListener("keydown", key);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  const choose = (code: string) => {
    if (code === locale) return setOpen(false);
    start(async () => {
      const result = await setMyLanguage(code);
      setOpen(false);
      if (result.success) router.refresh();
    });
  };

  return (
    <>
      <button
        aria-expanded={open}
        aria-label={t("language")}
        className={
          compact
            ? `flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)] ${className}`
            : `flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-sm font-semibold text-[var(--sidebar-text)] transition hover:bg-[var(--sidebar-hover)] hover:text-[var(--foreground)] ${className}`
        }
        onClick={() => setOpen((value) => !value)}
        ref={trigger}
        title={t("language")}
        type="button"
      >
        <Globe className="shrink-0" size={16} />
        {compact ? null : <span className="uppercase">{pending ? "…" : locale.split("-")[0]}</span>}
      </button>
      {open
        ? createPortal(
            <div
              className="fixed z-[90] max-h-[60vh] w-[260px] overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-1.5 shadow-xl"
              ref={list}
              role="listbox"
              style={{ bottom: pos.bottom, left: pos.left }}
            >
              <p className="px-3 pb-1 pt-2 text-[13px] font-bold text-[var(--muted)]">{t("language")}</p>
              {supportedLocaleOptions.map((option) => (
                <button
                  aria-selected={option.code === locale}
                  className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${
                    option.code === locale ? "bg-[var(--primary-light)] font-bold text-[var(--primary)]" : "font-medium text-[var(--foreground)] hover:bg-[var(--panel-secondary)]"
                  }`}
                  disabled={pending}
                  key={option.code}
                  onClick={() => choose(option.code)}
                  role="option"
                  type="button"
                >
                  <span className="truncate">{option.label}</span>
                  {option.code === locale ? <Check className="shrink-0" size={16} /> : null}
                </button>
              ))}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
