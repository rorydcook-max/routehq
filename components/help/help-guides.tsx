"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, PlayCircle, Search } from "lucide-react";

type Guide = { slug: string; title: string; description: string; category: string; video: boolean; text: string };

/**
 * The how-to guides on the Help page (Rory, 2 Nov 2026): search as you type, or open a section. Each opens the help
 * centre article (public at /docs) in a new tab, so the page they were on stays open.
 */
export function HelpGuides({ guides, categories }: { guides: Guide[]; categories: string[] }) {
  const t = useTranslations("help");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = useMemo(
    () => (words.length ? guides.filter((guide) => words.every((word) => guide.text.includes(word))).slice(0, 8) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, guides]
  );

  const row = (guide: Guide) => (
    <li key={guide.slug}>
      <a className="flex items-center gap-3 py-2.5" href={`/docs/${guide.slug}`} rel="noopener" target="_blank">
        {guide.video ? <PlayCircle aria-label={t("guideVideo")} className="shrink-0 text-[var(--primary)]" size={18} /> : <ChevronRight aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={18} />}
        <span className="min-w-0 flex-1">
          <span className="block font-bold text-[var(--foreground)]">{guide.title}</span>
          <span className="block truncate text-[14px] font-medium text-[var(--muted)]">{guide.description}</span>
        </span>
      </a>
    </li>
  );

  return (
    <div>
      <label className="relative block">
        <span className="sr-only">{t("guidesSearch")}</span>
        <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
        <input className="w-full !pl-10" onChange={(event) => setQuery(event.target.value)} placeholder={t("guidesSearch")} type="search" value={query} />
      </label>
      {words.length ? (
        found.length ? (
          <ul className="mt-2 divide-y divide-[var(--border)]">{found.map(row)}</ul>
        ) : (
          <p className="mt-3 font-medium text-[var(--muted)]">{t("guidesNone")}</p>
        )
      ) : (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {categories.map((category) => {
            const inside = guides.filter((guide) => guide.category === category);
            if (!inside.length) return null;
            const isOpen = open === category;
            return (
              <div className={`rounded-xl bg-[var(--panel-secondary)] px-3.5 ${isOpen ? "sm:col-span-2" : ""}`} key={category}>
                <button aria-expanded={isOpen} className="flex w-full items-center justify-between gap-3 py-3 text-left" onClick={() => setOpen(isOpen ? null : category)} type="button">
                  <span className="font-bold text-[var(--foreground)]">{t(`guideCat_${category.replace(/-/g, "_")}` as never)}</span>
                  <span className="shrink-0 text-[14px] font-semibold text-[var(--muted)]">{inside.length}</span>
                </button>
                {isOpen ? <ul className="divide-y divide-[var(--border)] pb-1">{inside.map(row)}</ul> : null}
              </div>
            );
          })}
        </div>
      )}
      <a className="mt-3 inline-flex items-center gap-1 font-bold text-[var(--primary)]" href="/docs" rel="noopener" target="_blank">
        {t("guidesAll")}
        <ChevronRight size={16} />
      </a>
    </div>
  );
}
