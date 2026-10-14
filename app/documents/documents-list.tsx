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

  // One card per booking, customer or vehicle, the one with the newest file first.
  type Folder = { key: string; label: string; href: string | null; kind: "booking" | "customer" | "vehicle"; latest: string; files: DocumentListItem[] };
  const folders = useMemo(() => {
    const byKey = new Map<string, Folder>();
    for (const document of filtered) {
      const kind: Folder["kind"] = document.href?.startsWith("/customers") ? "customer" : document.href?.startsWith("/fleet") || document.inspectionType === "condition" || document.ownerType === "vehicle" ? "vehicle" : "booking";
      const key = document.href || `${document.ownerType}|${document.ownerId || document.ownerLabel}`;
      const folder = byKey.get(key) || { key, label: document.ownerLabel || ownerLabel(document), href: document.href, kind, latest: "", files: [] };
      folder.files.push(document);
      if (String(document.createdAt) > folder.latest) folder.latest = String(document.createdAt);
      byKey.set(key, folder);
    }
    // Inside a card: the paperwork first, then ID photos, then handover and return photos.
    const rank = (document: DocumentListItem) => (document.ownerType === "signed" ? 0 : document.ownerType === "receipt" ? 1 : document.ownerType === "inspection" ? 3 : 2);
    return [...byKey.values()]
      .map((folder) => ({ ...folder, files: [...folder.files].sort((x, y) => rank(x) - rank(y) || String(y.createdAt).localeCompare(String(x.createdAt))) }))
      .sort((x, y) => y.latest.localeCompare(x.latest));
  }, [filtered]);
  const [open, setOpen] = useState<Set<string>>(new Set());
  void rows;

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
        <div className="grid gap-3 xl:grid-cols-2">
          {(search.trim() ? folders : folders.slice(0, dayLimit * 2)).map((folder) => {
            const expanded = open.has(folder.key);
            const shown = expanded ? folder.files : folder.files.slice(0, 5);
            const FolderIcon = folder.kind === "vehicle" ? Car : folder.kind === "customer" ? UserRound : CalendarDays;
            return (
              <section className="card p-4" key={folder.key}>
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]"><FolderIcon size={20} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-bold text-[var(--foreground)]">{folder.label || say("aBooking")}</p>
                    <p className="truncate font-medium text-[var(--foreground-secondary)]">{say("folderLine", { count: folder.files.length, date: longDate(folder.latest.slice(0, 10), locale) })}</p>
                  </div>
                  {folder.href ? <OwnerLink href={folder.href} kind={folder.kind} label={say(folder.kind === "vehicle" ? "openVehicle" : folder.kind === "customer" ? "openCustomer" : "openBooking")} /> : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6 xl:grid-cols-4 2xl:grid-cols-6">
                  {shown.map((document) => {
                    const picture = document.mimeType?.startsWith("image/") && document.signedUrl;
                    const label = fileLabel(document);
                    const tile = picture ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img alt={label} className="aspect-[4/3] w-full rounded-xl bg-[var(--panel-secondary)] object-cover" loading="lazy" src={document.signedUrl as string} />
                    ) : (
                      <span className={`flex aspect-[4/3] w-full items-center justify-center rounded-xl ${document.ownerType === "signed" ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--panel-secondary)] text-[var(--primary)]"}`}>
                        {document.ownerType === "signed" ? <FileSignature size={22} /> : document.ownerType === "inspection" ? <Images size={22} /> : <FileText size={22} />}
                      </span>
                    );
                    return (
                      <a className="pressable group block min-w-0" href={document.signedUrl || document.href || "#"} key={document.id} rel="noreferrer" target={document.signedUrl ? "_blank" : undefined} title={label}>
                        {tile}
                        <span className="mt-1 block truncate text-[14px] font-semibold leading-tight text-[var(--foreground-secondary)] group-hover:text-[var(--primary)]">{label}</span>
                      </a>
                    );
                  })}
                  {folder.files.length > shown.length ? (
                    <button
                      className="pressable flex aspect-[4/3] w-full items-center justify-center rounded-xl bg-[var(--panel-secondary)] font-bold text-[var(--primary)]"
                      onClick={() => setOpen((current) => new Set(current).add(folder.key))}
                      type="button"
                    >
                      {say("morePhotos", { count: folder.files.length - shown.length })}
                    </button>
                  ) : null}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {!search.trim() && folders.length > dayLimit * 2 ? (
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
