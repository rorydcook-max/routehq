"use client";

import { useMemo, useState } from "react";
import d from "./docs.module.css";

type Entry = { href: string; title: string; description: string; text: string };

/** Search as you type over every article's title, summary and headings; every word must match. */
export function DocsSearch({ entries, placeholder, empty }: { entries: Entry[]; placeholder: string; empty: string }) {
  const [query, setQuery] = useState("");
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = useMemo(() => {
    if (!words.length) return [];
    return entries
      .map((entry) => ({ entry, score: words.every((word) => entry.text.includes(word)) ? words.filter((word) => entry.title.toLowerCase().includes(word)).length + 1 : 0 }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((item) => item.entry);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, entries]);

  return (
    <div className={d.search} role="search">
      <svg aria-hidden="true" className={d.searchIcon} fill="none" height="20" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width="20">
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input aria-label={placeholder} className={d.searchInput} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} type="search" value={query} />
      {words.length ? (
        <div className={d.results}>
          {found.length ? (
            found.map((entry) => (
              <a className={d.result} href={entry.href} key={entry.href}>
                <span className={d.resultTitle}>{entry.title}</span>
                <span className={d.resultBody}>{entry.description}</span>
              </a>
            ))
          ) : (
            <p className={d.noResults}>{empty}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
