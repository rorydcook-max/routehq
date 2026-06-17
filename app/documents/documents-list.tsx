"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ExternalLink, FileText, Search } from "lucide-react";
import type { DocumentListItem } from "@/lib/documents-hub";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function DocumentsList({ documents }: { documents: DocumentListItem[] }) {
  const [search, setSearch] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");

  const ownerTypes = useMemo(() => {
    return ["all", ...new Set(documents.map((document) => document.ownerType))];
  }, [documents]);

  const filtered = useMemo(() => {
    const needle = search.toLowerCase().trim();
    return documents.filter((document) => {
      if (ownerFilter !== "all" && document.ownerType !== ownerFilter) return false;
      const haystack = [document.fileName, document.category, document.ownerLabel, document.ownerType].join(" ").toLowerCase();
      return !needle || haystack.includes(needle);
    });
  }, [documents, ownerFilter, search]);

  return (
    <div className="space-y-4">
      <div className="content-section">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
            <input
              className="input-with-leading-icon w-full rounded-xl border border-[var(--border)] bg-white pr-4 text-sm font-semibold text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search file name, category, owner"
              value={search}
            />
          </label>
          <select
            className="min-h-11 rounded-xl border border-[var(--border)] bg-white px-3 text-sm font-semibold"
            onChange={(event) => setOwnerFilter(event.target.value)}
            value={ownerFilter}
          >
            {ownerTypes.map((type) => (
              <option key={type} value={type}>
                {type === "all" ? "All owners" : type}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-black text-[#10252b]">No documents yet</p>
          <p className="mt-2 text-sm text-[#667085]">Uploads from customers, vehicles, bookings, and receipts appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((document) => (
            <div className="content-section flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" key={document.id}>
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                  <FileText size={20} />
                </span>
                <div>
                  <p className="font-black text-[var(--foreground)]">{document.fileName}</p>
                  <p className="text-sm font-semibold capitalize text-[var(--foreground-secondary)]">
                    {document.category.replace(/_/g, " ")} · {document.ownerType}
                  </p>
                  <p className="text-sm text-[var(--muted)]">
                    {document.ownerLabel} · {formatDate(document.createdAt)}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {document.href ? (
                  <Link className="secondary-action pressable" href={document.href as any}>
                    Open record
                  </Link>
                ) : null}
                {document.signedUrl ? (
                  <a className="primary-action pressable" href={document.signedUrl} rel="noreferrer" target="_blank">
                    <ExternalLink size={16} />
                    View file
                  </a>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
