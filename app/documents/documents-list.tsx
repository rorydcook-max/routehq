"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ExternalLink, FileSignature, FileText, Search } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents-hub";
import { longDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;

export function DocumentsList({ documents }: { documents: DocumentListItem[] }) {
  const t = useTranslations("documentsPage");
  const say = t as unknown as Say;
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const has = (key: string) => t.has(key as never);
  const tidy = (value: string) => value.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

  /** What the file is, in the reader's words: "Passport", "Rental agreement", "Front". */
  function fileLabel(document: DocumentListItem) {
    if (document.ownerType === "signed") {
      return has(`signed_${document.docType}`) ? say(`signed_${document.docType}`) : tidy(document.docType || document.fileName);
    }
    const category = document.category.startsWith("inspection_damage") ? "inspection_damage" : document.category;
    return has(`cat_${category}`) ? say(`cat_${category}`) : document.fileName || tidy(document.category);
  }

  /** Who or what the file belongs to. */
  function ownerLabel(document: DocumentListItem) {
    if (document.ownerType === "inspection") {
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

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
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
        <select aria-label={say("show")} className="w-full sm:w-auto" onChange={(event) => setOwnerFilter(event.target.value)} value={ownerFilter}>
          {ownerTypes.map((type) => (
            <option key={type} value={type}>
              {filterLabel(type)}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-4">
          <p className="text-[17px] font-bold text-[var(--foreground)]">{documents.length === 0 ? say("emptyTitle") : say("noMatchTitle")}</p>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{documents.length === 0 ? say("emptyBody") : say("noMatchBody")}</p>
        </div>
      ) : (
        rows.map((row) => {
          if (row.kind === "photos") {
            const first = row.documents[0];
            return (
              <div className="card p-4" key={row.key}>
                <p className="text-[16px] font-bold text-[var(--foreground)]">{ownerLabel(first)}</p>
                <p className="font-medium text-[var(--foreground-secondary)]">
                  {say("photoCount", { count: row.documents.length })} · {longDate(first.createdAt, locale)}
                </p>
                <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                  {row.documents.map((document) =>
                    document.signedUrl ? (
                      <a className="shrink-0" href={document.signedUrl} key={document.id} rel="noreferrer" target="_blank" title={fileLabel(document)}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img alt={fileLabel(document)} className="h-16 w-24 rounded-lg bg-[var(--panel-secondary)] object-cover" loading="lazy" src={document.signedUrl} />
                      </a>
                    ) : null
                  )}
                </div>
                {first.href ? (
                  <Link className="secondary-action pressable mt-3 w-full sm:w-auto" href={first.href as any}>
                    {say("openBooking")}
                  </Link>
                ) : null}
              </div>
            );
          }
          const document = row.document;
          return (
            <div className="card p-4" key={document.id}>
              <div className="flex items-start gap-3">
                {document.mimeType?.startsWith("image/") && document.signedUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" src={document.signedUrl} />
                ) : (
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                      document.ownerType === "signed" ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--primary-light)] text-[var(--primary)]"
                    }`}
                  >
                    {document.ownerType === "signed" ? <FileSignature size={22} /> : <FileText size={22} />}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[16px] font-bold text-[var(--foreground)]">{fileLabel(document)}</p>
                  <p className="font-medium text-[var(--foreground-secondary)]">{ownerLabel(document)}</p>
                  <p className="font-medium text-[var(--foreground-secondary)]">
                    {document.ownerType === "signed" ? `${say("signedOn", { date: longDate(document.createdAt, locale) })}` : say("addedOn", { date: longDate(document.createdAt, locale) })}
                  </p>
                </div>
              </div>
              <div className="mt-3 flex gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
                {document.signedUrl ? (
                  <a className="primary-action pressable" href={document.signedUrl} rel="noreferrer" target="_blank">
                    <ExternalLink size={18} />
                    {say("view")}
                  </a>
                ) : null}
                {document.href ? (
                  <Link className="secondary-action pressable" href={document.href as any}>
                    {say(document.ownerType === "vehicle" ? "openVehicle" : document.ownerType === "customer" ? "openCustomer" : "openBooking")}
                  </Link>
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
