"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, ChevronDown, Search } from "lucide-react";

export type SearchOption = { value: string; label: string; hint?: string };

/** "Côte d'Ivoire" and "cote" match: accents and case don't count when searching. */
const plain = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * A dropdown with a search box (build-s, 8 Nov 2026), for long lists such as every country, currency or time zone.
 * Looks like the app's other fields; type to narrow, arrows and Enter to choose, Escape to close.
 * Options are shown in the order given (callers sort them alphabetically).
 */
export function SearchSelect({
  value,
  options,
  onChange,
  placeholder = "",
  ariaLabel,
  disabled = false,
  className = "mt-1"
}: {
  value: string;
  options: SearchOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const current = options.find((option) => option.value === value) || null;
  const shown = useMemo(() => {
    const wanted = plain(query.trim());
    if (!wanted) return options;
    return options.filter((option) => plain(`${option.label} ${option.hint || ""} ${option.value}`).includes(wanted));
  }, [options, query]);

  useEffect(() => {
    if (!open) return;
    setActive(Math.max(0, shown.findIndex((option) => option.value === value)));
    search.current?.focus();
    const away = (event: PointerEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
    // Only when it opens: typing keeps the highlight where the arrows put it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const choose = (option: SearchOption | undefined) => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className={`relative ${className}`} ref={root}>
      <button
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="flex h-11 w-full items-center gap-2 px-3 text-left text-[15px] text-[var(--foreground)] disabled:opacity-60"
        disabled={disabled}
        onClick={() => setOpen((was) => !was)}
        style={{ border: "1.5px solid var(--border-strong)", borderRadius: 12, background: "var(--surface, #fff)" }}
        type="button"
      >
        <span className={`min-w-0 flex-1 truncate ${current ? "" : "text-[var(--muted)]"}`}>{current ? current.label : placeholder}</span>
        <ChevronDown aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={16} />
      </button>
      {open ? (
        // In the page's flow, not floating: cards clip anything that hangs out of them (overflow hidden).
        <div className="relative z-10 mt-1 overflow-hidden rounded-xl border border-[var(--border-strong)] bg-[var(--surface,#fff)] shadow-[0_16px_40px_-12px_rgba(16,38,43,0.35)]">
          <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
            <Search aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={16} />
            <input
              aria-label={t("search")}
              className="h-11 w-full border-0 bg-transparent px-0 text-[15px] shadow-none outline-none ring-0 focus:ring-0"
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setActive((index) => Math.min(shown.length - 1, index + 1));
                } else if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setActive((index) => Math.max(0, index - 1));
                } else if (event.key === "Enter") {
                  event.preventDefault();
                  choose(shown[active]);
                } else if (event.key === "Escape") {
                  setOpen(false);
                }
              }}
              placeholder={t("search")}
              ref={search}
              style={{ border: 0, boxShadow: "none", minHeight: 0 }}
              value={query}
            />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1" ref={list} role="listbox">
            {shown.length ? (
              shown.map((option, index) => (
                <li
                  aria-selected={option.value === value}
                  className={`flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[15px] ${index === active ? "bg-[var(--panel-secondary)]" : ""}`}
                  data-index={index}
                  key={option.value}
                  onClick={() => choose(option)}
                  onPointerEnter={() => setActive(index)}
                  role="option"
                >
                  <span className="min-w-0 flex-1 truncate font-semibold text-[var(--foreground)]">{option.label}</span>
                  {option.hint ? <span className="shrink-0 text-[14px] text-[var(--muted)]">{option.hint}</span> : null}
                  {option.value === value ? <Check aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={16} /> : null}
                </li>
              ))
            ) : (
              <li className="px-3 py-3 text-[15px] text-[var(--muted)]">{t("noMatches")}</li>
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
