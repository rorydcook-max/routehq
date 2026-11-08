"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Search } from "lucide-react";
import { UNSPLASH_HOME, unsplashLink } from "@/lib/sites/images";
import type { StockPhoto } from "@/lib/stock-photos";

/** From the server (lib/stock-photos.ts): whether UNSPLASH_ACCESS_KEY is set, and searches to suggest for this business. */
export type StockSetup = { ready: boolean; suggestions: string[] };

type Rich = { rich: (key: string, values: Record<string, unknown>) => ReactNode };
type Say = ((key: string, values?: Record<string, string | number>) => string) & Rich;
type Page = { photos: StockPhoto[]; totalPages: number };
type Failure = "rate_limited" | "not_configured" | "failed";

/** Searches already made this visit (both pickers share them), so going back to one costs no Unsplash request. */
const pages = new Map<string, Page>();
const DEBOUNCE_MS = 600;

async function fetchPage(q: string, page: number, signal: AbortSignal): Promise<Page> {
  const key = `${q.toLowerCase()}|${page}`;
  const known = pages.get(key);
  if (known) return known;
  const response = await fetch(`/api/stock-photos/search?${new URLSearchParams({ q, page: String(page) }).toString()}`, { signal });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error((body?.error as Failure) || "failed");
  const result = { photos: body.photos as StockPhoto[], totalPages: Number(body.totalPages) || 0 };
  pages.set(key, result);
  return result;
}

/** Tells Unsplash the photo was chosen (the server calls its download_location). Best effort: the choice stands either way. */
export function trackStockPick(photo: Pick<StockPhoto, "id" | "downloadLocation">) {
  void fetch("/api/stock-photos/download", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: photo.id, downloadLocation: photo.downloadLocation }), keepalive: true }).catch(() => undefined);
}

/** "Photo by <name> on Unsplash", both linked (Unsplash API guidelines). */
export function StockCredit({ name, profileUrl, className = "" }: { name: string; profileUrl: string; className?: string }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const link = "font-semibold underline underline-offset-2";
  return (
    <span className={className}>
      {say.rich("stock_credit", {
        name,
        author: (chunks: ReactNode) => (
          <a className={link} href={unsplashLink(profileUrl)} rel="noopener noreferrer" target="_blank">
            {chunks}
          </a>
        ),
        unsplash: (chunks: ReactNode) => (
          <a className={link} href={UNSPLASH_HOME} rel="noopener noreferrer" target="_blank">
            {chunks}
          </a>
        )
      })}
    </span>
  );
}

/**
 * The image picker's Stock photos tab (task unsplash-lib, 8 Nov 2026): search Unsplash (typing waits a moment before
 * searching; demo keys allow 50 searches an hour), suggested searches for the business, a grid with "More", and each
 * photo credited to its photographer. For the hero and About pictures only: vehicle photos stay the owner's own.
 */
export function StockPhotos({ stock, selectedId, onPick }: { stock?: StockSetup; selectedId: string | null; onPick: (photo: StockPhoto) => void }) {
  const say = useTranslations("siteEditor") as unknown as Say;
  const [input, setInput] = useState("");
  const [query, setQuery] = useState("");
  const [photos, setPhotos] = useState<StockPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | Failure>("idle");
  const abort = useRef<AbortController | null>(null);

  function load(q: string, nextPage: number) {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setStatus("loading");
    fetchPage(q, nextPage, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setPhotos((current) => (nextPage === 1 ? result.photos : [...current, ...result.photos.filter((photo) => !current.some((item) => item.id === photo.id))]));
        setPage(nextPage);
        setTotalPages(result.totalPages);
        setStatus("done");
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setStatus(["rate_limited", "not_configured"].includes(error.message) ? (error.message as Failure) : "failed");
      });
  }

  // Typing: search once it pauses.
  useEffect(() => {
    const q = input.trim();
    if (q.length < 2 || q.toLowerCase() === query.toLowerCase()) return;
    const timer = window.setTimeout(() => {
      setQuery(q);
      load(q, 1);
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);
  useEffect(() => () => abort.current?.abort(), []);

  if (!stock?.ready) return <p className="mt-2 font-semibold text-[var(--muted)]">{say("stock_off")}</p>;

  const suggest = (q: string) => {
    setInput(q);
    setQuery(q);
    load(q, 1);
  };
  const message =
    status === "rate_limited" ? say("stock_rateLimited") : status === "not_configured" ? say("stock_off") : status === "failed" ? say("stock_failed") : status === "done" && !photos.length ? say("stock_none") : null;

  return (
    <div className="mt-2 space-y-3">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const q = input.trim();
          if (q.length >= 2) suggest(q);
        }}
        role="search"
      >
        <label className="relative block">
          <span className="sr-only">{say("stock_search")}</span>
          <Search aria-hidden="true" className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <input className="w-full !ps-10" enterKeyHint="search" maxLength={80} onChange={(event) => setInput(event.target.value)} placeholder={say("stock_search")} type="search" value={input} />
        </label>
      </form>
      {stock.suggestions.length ? (
        <div aria-label={say("stock_suggested")} className="flex flex-wrap gap-1.5" role="group">
          {stock.suggestions.map((item) => (
            <button
              aria-pressed={query.toLowerCase() === item.toLowerCase()}
              className={`min-h-9 rounded-full px-3 text-sm font-bold ${query.toLowerCase() === item.toLowerCase() ? "bg-[var(--foreground)] text-[var(--panel)]" : "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)]"}`}
              key={item}
              onClick={() => suggest(item)}
              type="button"
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}
      {photos.length ? (
        <ul className="grid grid-cols-2 gap-x-2 gap-y-3 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
          {photos.map((photo) => {
            const on = selectedId === photo.id;
            return (
              <li className="min-w-0" key={photo.id}>
                <button
                  aria-label={photo.alt ? say("stock_use", { photo: photo.alt }) : say("stock_useBy", { name: photo.name })}
                  aria-pressed={on}
                  className={`relative block aspect-[4/3] w-full overflow-hidden rounded-xl ${on ? "ring-[3px] ring-[var(--primary)]" : "ring-1 ring-[var(--border)]"}`}
                  onClick={() => onPick(photo)}
                  style={{ background: photo.color || undefined }}
                  type="button"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="absolute inset-0 h-full w-full object-cover" decoding="async" loading="lazy" src={photo.thumb} />
                  {on ? (
                    <span className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                      <Check size={16} strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
                <StockCredit className="mt-1 block break-words text-xs leading-snug text-[var(--foreground-secondary)]" name={photo.name} profileUrl={photo.profileUrl} />
              </li>
            );
          })}
        </ul>
      ) : null}
      {message ? <p className={`font-semibold ${status === "done" ? "text-[var(--muted)]" : "text-[var(--danger)]"}`} role="status">{message}</p> : null}
      {status === "loading" ? <p className="font-semibold text-[var(--muted)]" role="status">{say("stock_loading")}</p> : null}
      {photos.length && page < totalPages && status !== "loading" ? (
        <button className="secondary-action pressable w-full" onClick={() => load(query, page + 1)} type="button">
          {say("stock_more")}
        </button>
      ) : null}
      <p className="text-xs font-semibold text-[var(--muted)]">
        {say.rich("stock_note", {
          unsplash: (chunks: ReactNode) => (
            <a className="underline underline-offset-2" href={UNSPLASH_HOME} rel="noopener noreferrer" target="_blank">
              {chunks}
            </a>
          )
        })}
      </p>
    </div>
  );
}
