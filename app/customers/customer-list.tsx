"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
import { ChevronRight, Plus, Search } from "lucide-react";
import { Badge, Card, EmptyState, SectionHeader } from "@/components/ui";
import { flagForNationality } from "@/lib/customer-options";
import type { CustomerListItem } from "@/lib/customer-detail";

function money(value: number) {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value: string | null, say: Say, locale: string) {
  if (!value) {
    return say("noRentals");
  }
  return longDate(String(value).slice(0, 10), locale);
}

function documentBadge(status: CustomerListItem["documentStatus"], say: Say) {
  if (status === "complete") {
    return <Badge tone="green">{say("doc_complete")}</Badge>;
  }
  if (status === "missing") {
    return <Badge tone="amber">{say("doc_missing")}</Badge>;
  }
  return <Badge tone="red">{say("doc_none")}</Badge>;
}

export function CustomerList({ customers }: { customers: CustomerListItem[] }) {
  const say = useTranslations("customers") as unknown as Say;
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [documentFilter, setDocumentFilter] = useState("all");
  const [rentalFilter, setRentalFilter] = useState("all");

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return customers.filter((item) => {
      const matchesSearch =
        !needle ||
        item.customer.full_name?.toLowerCase().includes(needle) ||
        item.customer.phone?.toLowerCase().includes(needle);
      const matchesDocuments =
        documentFilter === "all" ||
        (documentFilter === "complete" && item.documentStatus === "complete") ||
        (documentFilter === "incomplete" && item.documentStatus !== "complete");
      const matchesRental =
        rentalFilter === "all" ||
        (rentalFilter === "renting" && item.activeRentals.length > 0) ||
        (rentalFilter === "not_renting" && item.activeRentals.length === 0);

      return matchesSearch && matchesDocuments && matchesRental;
    });
  }, [customers, documentFilter, rentalFilter, search]);

  return (
    <div className="space-y-4">
      <div className="page-hero flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">{say("title")}</p>
          <h1 className="page-title">{say("title")}</h1>
          <p className="page-subtitle mt-2">{say("subtitle")}</p>
        </div>
        <Link className="primary-action pressable" href="/customers/new">
          <Plus size={18} />
          {say("add")}
        </Link>
      </div>

      <Card>
        <SectionHeader eyebrow={say("directory")} title={say("count", { count: filteredCustomers.length })} />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative col-span-2 block lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              className="input-with-leading-icon w-full rounded-xl border border-[var(--border)] bg-white pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={say("search")}
              value={search}
            />
          </label>
          <select
            className="min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
            onChange={(event) => setDocumentFilter(event.target.value)}
            value={documentFilter}
          >
            <option value="all">{say("allDocs")}</option>
            <option value="complete">{say("complete")}</option>
            <option value="incomplete">{say("incomplete")}</option>
          </select>
          <select
            className="min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
            onChange={(event) => setRentalFilter(event.target.value)}
            value={rentalFilter}
          >
            <option value="all">{say("everyone")}</option>
            <option value="renting">{say("renting")}</option>
            <option value="not_renting">{say("notRenting")}</option>
          </select>
        </div>
      </Card>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title={say("emptyTitle")}
          description={say("emptyBody")}
          action={
            <Link className="primary-action pressable" href="/customers/new">
              {say("add")}
            </Link>
          }
        />
      ) : (
        // One line per person: who they are, what they have now, what they're worth. Everything else is on their page.
        <div className="divide-y divide-[var(--border)] overflow-hidden rounded-[10px] border-[0.5px] border-[var(--border)] bg-[var(--panel)]">
          {filteredCustomers.map((item) => {
            const activeRental = item.activeRental;
            const vehicle = activeRental ? `${activeRental.vehicles?.make || ""} ${activeRental.vehicles?.model || ""}`.trim() : "";
            const line = activeRental
              ? activeRental.end_date
                ? say("rentingLine", { vehicle: vehicle || say("vehicle"), date: formatDate(activeRental.end_date, say, locale) })
                : say("rentingOpen", { vehicle: vehicle || say("vehicle") })
              : item.lastRentalDate
                ? say("lastRental", { date: formatDate(item.lastRentalDate, say, locale) })
                : say("noRentals");
            return (
              <Link className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-[var(--panel-secondary)]" href={`/customers/${item.customer.id}`} key={item.customer.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                      {flagForNationality(item.customer.nationality)} {item.customer.full_name}
                    </p>
                    {item.documentStatus === "complete" ? null : documentBadge(item.documentStatus, say)}
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${activeRental ? "font-semibold text-[var(--primary)]" : "text-[var(--muted)]"}`}>{line}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono-data text-sm font-semibold text-[var(--foreground)]">{money(item.lifetimeRevenue)}</p>
                  <p className="text-xs text-[var(--muted)]">{say("rentals", { count: item.totalRentals })}</p>
                </div>
                <ChevronRight className="shrink-0 text-[var(--muted)]" size={16} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
