"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarDays, Car, ChevronDown, ChevronRight, FileSignature, FileText, Images, ReceiptText, Search, UserRound } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents-hub";
import { longDate, shortDate } from "@/lib/i18n/dates";
import { EmptyState } from "@/components/ui";

type Say = (key: string, values?: Record<string, string | number>) => string;
type Kind = "booking" | "customer" | "vehicle";
type Group = { key: string; label: string; href: string | null; kind: Kind; latest: string; files: DocumentListItem[] };

const PAGE = 20;
const FILES_SHOWN = 12;

/** Where each kind keeps its own files: the vehicle's Files fold, the customer's Documents tab, the booking's Paperwork tab. */
const ANCHOR: Record<Kind, string> = { vehicle: "#files", customer: "#documents", booking: "#paperwork" };

const isImage = (document: DocumentListItem) => Boolean(document.mimeType?.startsWith("image/"));

export function FilesList({ documents }: { documents: DocumentListItem[] }) {
  const t = useTranslations("documentsPage");
  const say = t as unknown as Say;
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState<Set<string>>(new Set());

  const has = (key: string) => t.has(key as never);
  const tidy = (value: string) => value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  /** What the file is, in the reader's words: "Passport", "Rental agreement", "Front". */
  function fileLabel(document: DocumentListItem) {
    if (document.ownerType === "signed") {
      return has(`signed_${document.docType}`) ? say(`signed_${document.docType}`) : tidy(document.docType || document.fileName);
    }
    if (document.ownerType === "receipt") return say("receiptNo", { number: document.fileName });
    if (document.ownerType === "inspection") {
      const category = document.category.startsWith("inspection_damage") ? "inspection_damage" : document.category;
      const where = say(document.inspectionType === "return" ? "photoReturn" : document.inspectionType === "condition" ? "photoCondition" : "photoHandover");
      return `${where} · ${has(`cat_${category}`) ? say(`cat_${category}`) : tidy(category)}`;
    }
    return has(`cat_${document.category}`) ? say(`cat_${document.category}`) : document.fileName || tidy(document.category);
  }

  const typeLabel = (value: string) => (has(`filter_${value}`) ? say(`filter_${value}`) : tidy(value));

  // One type filter, options in alphabetical order (after "All files").
  const types = useMemo(
    () => [...new Set(documents.map((document) => document.ownerType))].sort((a, b) => typeLabel(a).localeCompare(typeLabel(b), locale)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [documents, locale]
  );

  // One row per vehicle, customer or booking, the one with the newest file first.
  const groups = useMemo(() => {
    const needle = search.toLowerCase().trim();
    const byKey = new Map<string, Group>();
    for (const document of documents) {
      if (type !== "all" && document.ownerType !== type) continue;
      const kind: Kind = document.href?.startsWith("/customers") ? "customer" : document.href?.startsWith("/fleet") || document.ownerType === "vehicle" ? "vehicle" : "booking";
      const key = document.href || `${document.ownerType}|${document.ownerId || document.ownerLabel}`;
      const group = byKey.get(key) || { key, label: document.ownerLabel, href: document.href, kind, latest: "", files: [] };
      if (!group.label && document.ownerLabel) group.label = document.ownerLabel;
      group.files.push(document);
      if (String(document.createdAt) > group.latest) group.latest = String(document.createdAt);
      byKey.set(key, group);
    }
    // Inside a row: the paperwork first, then ID and vehicle files, then handover and return photos.
    const rank = (document: DocumentListItem) => (document.ownerType === "signed" ? 0 : document.ownerType === "receipt" ? 1 : document.ownerType === "inspection" ? 3 : 2);
    return [...byKey.values()]
      .filter((group) => !needle || [group.label, ...group.files.map((document) => `${document.fileName} ${fileLabel(document)}`)].join(" ").toLowerCase().includes(needle))
      .map((group) => ({ ...group, files: [...group.files].sort((x, y) => rank(x) - rank(y) || String(y.createdAt).localeCompare(String(x.createdAt))) }))
      .sort((x, y) => y.latest.localeCompare(x.latest));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents, type, search, locale]);

  const shown = groups.slice(0, limit);
  const kindIcon = (kind: Kind) => (kind === "vehicle" ? Car : kind === "customer" ? UserRound : CalendarDays);
  const openLabel = (kind: Kind) => say(kind === "vehicle" ? "openVehicle" : kind === "customer" ? "openCustomer" : "openBooking");

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <label className="relative block min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
          <input
            aria-label={say("search")}
            className="input-with-leading-icon min-h-11 w-full rounded-full border border-[var(--border)] bg-white pr-4 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            onChange={(event) => {
              setSearch(event.target.value);
              setLimit(PAGE);
            }}
            placeholder={say("search")}
            value={search}
          />
        </label>
        {types.length > 1 ? (
          <select
            aria-label={say("typeLabel")}
            className="min-h-11 rounded-full border border-[var(--border)] bg-white px-4 font-semibold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)] sm:w-60"
            onChange={(event) => {
              setType(event.target.value);
              setLimit(PAGE);
            }}
            value={type}
          >
            <option value="all">{say("allTypes")}</option>
            {types.map((value) => (
              <option key={value} value={value}>
                {typeLabel(value)}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <EmptyState title={documents.length === 0 ? say("emptyTitle") : say("noMatchTitle")} />
      ) : (
        <ul className="card divide-y divide-[var(--border)] overflow-hidden !p-0">
          {shown.map((group) => {
            const Icon = !group.href && group.files[0]?.ownerType === "transaction" ? ReceiptText : kindIcon(group.kind);
            const expanded = open === group.key;
            const thumbs = group.files.filter(isImage).slice(0, 3);
            const listed = showAll.has(group.key) ? group.files : group.files.slice(0, FILES_SHOWN);
            return (
              <li className="!mx-0" key={group.key}>
                <button
                  aria-expanded={expanded}
                  className="pressable flex w-full items-center gap-3 px-4 py-3 text-start hover:bg-[var(--panel-secondary)]"
                  onClick={() => setOpen(expanded ? null : group.key)}
                  type="button"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                    <Icon size={19} />
                  </span>
                  <span className="min-w-0 flex-1">
                    {/* No name found (a cost's receipt whose record is gone): say what the files are rather than "a booking". */}
                    <span className="block truncate font-bold text-[var(--foreground)]">
                      {group.label || (group.files[0]?.ownerType === "inspection" || group.files[0]?.ownerType === "rental" ? say("aBooking") : typeLabel(group.files[0]?.ownerType || ""))}
                    </span>
                    <span className="block truncate text-sm font-medium text-[var(--foreground-secondary)]">
                      {say("folderLine", { count: group.files.length, date: longDate(group.latest.slice(0, 10), locale) })}
                    </span>
                  </span>
                  {/* Three tiny thumbnails on a computer, none on a phone; loaded only as they scroll into view. */}
                  {thumbs.length ? (
                    <span aria-hidden="true" className="hidden shrink-0 gap-1 sm:flex">
                      {thumbs.map((document) => (
                        <Thumb document={document} key={document.id} size="h-9 w-9" />
                      ))}
                    </span>
                  ) : null}
                  <ChevronDown className={`shrink-0 text-[var(--foreground-secondary)] transition-transform ${expanded ? "rotate-180" : ""}`} size={20} />
                </button>
                {expanded ? (
                  <div className="border-t border-[var(--border)] bg-[var(--panel-secondary)] px-4 py-3">
                    <ul className="grid gap-1.5 sm:grid-cols-2">
                      {listed.map((document) => (
                        <li className="!mx-0" key={document.id}>
                          <a className="pressable flex min-h-11 items-center gap-2.5 rounded-lg bg-white px-2 py-1.5 hover:text-[var(--primary)]" href={document.fileUrl} rel="noreferrer" target="_blank">
                            <Thumb document={document} size="h-8 w-8" />
                            <span className="min-w-0 flex-1 truncate font-semibold">{fileLabel(document)}</span>
                            <span className="shrink-0 text-sm font-medium text-[var(--foreground-secondary)]">{shortDate(String(document.createdAt).slice(0, 10), locale)}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                      {group.files.length > listed.length ? (
                        <button
                          className="pressable min-h-10 font-bold text-[var(--primary)]"
                          onClick={() => setShowAll((current) => new Set(current).add(group.key))}
                          type="button"
                        >
                          {say("showAllFiles", { count: group.files.length })}
                        </button>
                      ) : (
                        <span />
                      )}
                      {group.href ? (
                        <Link className="pressable inline-flex min-h-10 items-center gap-0.5 font-bold text-[var(--primary)]" href={`${group.href}${ANCHOR[group.kind]}` as any}>
                          {openLabel(group.kind)}
                          <ChevronRight className="rtl:rotate-180" size={18} />
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {groups.length > shown.length ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            className="pressable inline-flex min-h-11 items-center whitespace-nowrap rounded-full border border-[var(--border)] bg-white px-5 font-bold text-[var(--foreground)]"
            onClick={() => setLimit((current) => current + PAGE)}
            type="button"
          >
            {say("showMore")}
          </button>
          <span className="text-sm font-medium text-[var(--foreground-secondary)]">{say("showingOf", { shown: shown.length, total: groups.length })}</span>
        </div>
      ) : null}
    </div>
  );
}

/** A tiny picture for a photo (lazy, through /api/files), or an icon for a PDF. A failed load leaves the icon showing. */
function Thumb({ document, size }: { document: DocumentListItem; size: string }) {
  const Icon = document.ownerType === "signed" ? FileSignature : document.ownerType === "receipt" ? ReceiptText : document.ownerType === "inspection" ? Images : document.ownerType === "customer" ? UserRound : FileText;
  return (
    <span className={`relative flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-md bg-[var(--panel-secondary)] text-[var(--primary)]`}>
      <Icon aria-hidden="true" size={16} />
      {isImage(document) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
          decoding="async"
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
          src={document.fileUrl}
        />
      ) : null}
    </span>
  );
}
