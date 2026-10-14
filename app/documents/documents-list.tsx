"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Car, FileSignature, FileText, Images, Search, UserRound } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents-hub";
import { longDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;

export function DocumentsList({ documents }: { documents: DocumentListItem[] }) {
  const t = useTranslations("documentsPage");
  const say = t as unknown as Say;
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [dayLimit, setDayLimit] = useState(5);

  const has = (key: string) => t.has(key as never);
  const tidy = (value: string) => value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  /** What the file is, in the reader's words: "Passport", "Rental agreement", "Front". */
  function fileLabel(document: DocumentListItem) {
    if (document.ownerType === "signed") {
      return has(`signed_${document.docType}`) ? say(`signed_${document.docType}`) : tidy(document.docType || document.fileName);
    }
    if (document.ownerType === "receipt") return say("receiptNo", { number: document.fileName });
    const category = document.category.startsWith("inspection_damage") ? "inspection_damage" : document.category;
    return has(`cat_${category}`) ? say(`cat_${category}`) : document.fileName || tidy(document.category);
  }

  /** Who or what the file belongs to. */
  function ownerLabel(document: DocumentListItem) {
    if (document.ownerType === "inspection") {
      if (document.inspectionType === "condition") return say("atCondition", { vehicle: document.ownerLabel || "-" });
      return say(document.inspectionType === "return" ? "atReturn" : "atHandover", { booking: document.ownerLabel || say("aBooking") });
    }
    return document.ownerLabel || (has(`owner_${document.ownerType}`) ? say(`owner_${document.ownerType}`) : tidy(document.ownerType));
  }

  const filterLabel = (type: string) => (has(`filter_${type}`) ? say(`filter_${type}`) : tidy(type));

  const ownerTypes = useMemo(() => ["all", ...new Set(documents.map((document) => document.ownerType))], [documents]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return documents.filter((document) => {
      if (ownerFilter !== "all" && document.ownerType !== ownerFilter) return false;
      const haystack = [document.fileName, fileLabel(document), document.category, document.ownerLabel].join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, ownerFilter, search, locale]);

  // One handover or return is one row, however many photos it has.
  type Row = { kind: "file"; document: DocumentListItem } | { kind: "photos"; key: string; documents: DocumentListItem[] };
  const rows = useMemo(() => {
    const result: Row[] = [];
    const groups = new Map<string, DocumentListItem[]>();
    for (const document of filtered) {
      if (document.ownerType !== "inspection") {
        result.push({ kind: "file", document });
        continue;
      }
      const key = `${document.inspectionType}|${document.ownerLabel}|${document.href || ""}`;
      const existing = groups.get(key);
      if (existing) {
        existing.push(document);
      } else {
        const group = [document];
        groups.set(key, group);
        result.push({ kind: "photos", key, documents: group });
      }
    }
    return result;
  }, [filtered]);

  // Grouped by the day the file was made, newest day first, so a long history reads as a short list per day.
  const days = useMemo(() => {
    const byDay = new Map<string, Row[]>();
    for (const row of rows) {
      const day = String((row.kind === "photos" ? row.documents[0] : row.document).createdAt || "").slice(0, 10);
      const list = byDay.get(day) || [];
      list.push(row);
      byDay.set(day, list);
    }
    return [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--foreground-secondary)]" size={18} />
          <input
            aria-label={say("search")}
            className="input-with-leading-icon w-full"
            onChange={(event) => setSearch(event.target.value)}
            placeholder={say("search")}
            value={search}
          />
        </label>
        {ownerTypes.length > 2 ? (
          <div aria-label={say("show")} className="flex flex-wrap gap-2" role="group">
            {ownerTypes.map((type) => (
              <button
                aria-pressed={ownerFilter === type}
                className={`pressable shrink-0 whitespace-nowrap rounded-full border-2 px-4 py-2 text-[14px] font-bold ${ownerFilter === type ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                key={type}
                onClick={() => setOwnerFilter(type)}
                type="button"
              >
                {filterLabel(type)}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <div className="card p-4">
          <p className="text-[17px] font-bold text-[var(--foreground)]">{documents.length === 0 ? say("emptyTitle") : say("noMatchTitle")}</p>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{documents.length === 0 ? say("emptyBody") : say("noMatchBody")}</p>
        </div>
      ) : (
        (search.trim() ? days : days.slice(0, dayLimit)).map(([day, dayRows]) => (
          <section className="card overflow-hidden !p-0" key={day}>
            <p className="border-b border-[var(--border)] bg-[var(--panel-secondary)] px-4 py-2.5 font-bold text-[var(--foreground-secondary)]">{longDate(day, locale)}</p>
            <ul className="divide-y divide-[var(--border)]">
              {dayRows.map((row) => {
                if (row.kind === "photos") {
                  const first = row.documents[0];
                  const shown = row.documents.filter((document) => document.signedUrl).slice(0, 4);
                  return (
                    <li className="px-4 py-3" key={row.key}>
                      <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-secondary)] text-[var(--primary)]"><Images size={20} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-[var(--foreground)]">{ownerLabel(first)}</p>
                          <p className="truncate text-[14px] font-medium text-[var(--foreground-secondary)]">{say("photoCount", { count: row.documents.length })}</p>
                        </div>
                        {first.href ? <OwnerLink href={first.href} kind={first.inspectionType === "condition" ? "vehicle" : "booking"} label={say(first.inspectionType === "condition" ? "openVehicle" : "openBooking")} /> : null}
                      </div>
                      <div className="mt-2.5 flex gap-1.5 pl-14">
                        {shown.map((document) => (
                          <a className="shrink-0" href={document.signedUrl as string} key={document.id} rel="noreferrer" target="_blank" title={fileLabel(document)}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img alt={fileLabel(document)} className="h-12 w-16 rounded-lg bg-[var(--panel-secondary)] object-cover" loading="lazy" src={document.signedUrl as string} />
                          </a>
                        ))}
                        {row.documents.length > shown.length ? (
                          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[var(--panel-secondary)] text-[14px] font-bold text-[var(--foreground-secondary)]">{say("morePhotos", { count: row.documents.length - shown.length })}</span>
                        ) : null}
                      </div>
                    </li>
                  );
                }
                const document = row.document;
                const icon =
                  document.mimeType?.startsWith("image/") && document.signedUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" loading="lazy" src={document.signedUrl} />
                  ) : (
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${document.ownerType === "signed" ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--primary-light)] text-[var(--primary)]"}`}>
                      {document.ownerType === "signed" ? <FileSignature size={20} /> : <FileText size={20} />}
                    </span>
                  );
                const text = (
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-[var(--foreground)]">{fileLabel(document)}</span>
                    <span className="block truncate text-[14px] font-medium text-[var(--foreground-secondary)]">{ownerLabel(document)}</span>
                  </span>
                );
                return (
                  <li className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--panel-secondary)]" key={document.id}>
                    {document.signedUrl ? (
                      <a className="flex min-w-0 flex-1 items-center gap-3" href={document.signedUrl} rel="noreferrer" target="_blank" title={say("view")}>
                        {icon}
                        {text}
                      </a>
                    ) : (
                      <span className="flex min-w-0 flex-1 items-center gap-3">
                        {icon}
                        {text}
                      </span>
                    )}
                    {document.href ? (
                      <OwnerLink
                        href={document.href}
                        kind={document.ownerType === "vehicle" ? "vehicle" : document.ownerType === "customer" ? "customer" : "booking"}
                        label={say(document.ownerType === "vehicle" ? "openVehicle" : document.ownerType === "customer" ? "openCustomer" : "openBooking")}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
      {!search.trim() && days.length > dayLimit ? (
        <button className="pressable inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-5 font-bold text-[var(--foreground)]" onClick={() => setDayLimit((limit) => limit + 10)} type="button">
          {say("showOlder")}
        </button>
      ) : null}
    </div>
  );
}

function OwnerLink({ href, kind, label }: { href: string; kind: "booking" | "customer" | "vehicle"; label: string }) {
  const Icon = kind === "vehicle" ? Car : kind === "customer" ? UserRound : CalendarDays;
  return (
    <Link aria-label={label} className="pressable flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] bg-white text-[var(--primary)] hover:border-[var(--primary)]" href={href as any} title={label}>
      <Icon size={18} />
    </Link>
  );
}
