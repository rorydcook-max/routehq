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

      <div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-[1fr_auto_auto]">
          {/* A short list needs no search or filters: they appear as the list grows. */}
          <label className={`relative col-span-2 lg:col-span-1 ${customers.length > 5 ? "block" : "hidden"}`}>
            <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
            <input
              className="input-with-leading-icon w-full rounded-full border-0 bg-white pr-4 font-medium text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder={say("search")}
              value={search}
            />
          </label>
          <select
            className={`min-w-0 rounded-full border-0 bg-white px-4 font-bold text-[var(--foreground)] ${customers.length > 10 ? "" : "hidden"}`}
            onChange={(event) => setDocumentFilter(event.target.value)}
            value={documentFilter}
          >
            <option value="all">{say("allDocs")}</option>
            <option value="complete">{say("complete")}</option>
            <option value="incomplete">{say("incomplete")}</option>
          </select>
          <select
            className={`min-w-0 rounded-full border-0 bg-white px-4 font-bold text-[var(--foreground)] ${customers.length > 10 ? "" : "hidden"}`}
            onChange={(event) => setRentalFilter(event.target.value)}
            value={rentalFilter}
          >
            <option value="all">{say("everyone")}</option>
            <option value="renting">{say("renting")}</option>
            <option value="not_renting">{say("notRenting")}</option>
          </select>
        </div>
        <p className="mt-3 px-1 text-[18px] font-bold text-[var(--foreground)]">{say("count", { count: filteredCustomers.length })}</p>
      </div>

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
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {filteredCustomers.map((item) => {
            const activeRental = item.activeRental;
            const vehicle = activeRental ? `${activeRental.vehicles?.make || ""} ${activeRental.vehicles?.model || ""}`.trim() : "";
            const line = activeRental
              ? activeRental.status === "booked"
                ? say("bookedLine", { vehicle: vehicle || say("vehicle"), date: formatDate(activeRental.start_date, say, locale) })
                : activeRental.end_date
                ? say("rentingLine", { vehicle: vehicle || say("vehicle"), date: formatDate(activeRental.end_date, say, locale) })
                : say("rentingOpen", { vehicle: vehicle || say("vehicle") })
              : item.lastRentalDate
                ? say("lastRental", { date: formatDate(item.lastRentalDate, say, locale) })
                : say("noRentals");
            return (
              <Link className="flex items-center gap-3 px-4 py-3.5 transition hover:bg-[var(--panel-secondary)]" href={`/customers/${item.customer.id}`} key={item.customer.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[17px] font-bold text-[var(--foreground)]">
                      {flagForNationality(item.customer.nationality)} {item.customer.full_name}
                    </p>
                    {item.customer?.do_not_rent ? <Badge tone="red">{say("doNotRent")}</Badge> : null}
                    {item.documentStatus === "complete" ? null : documentBadge(item.documentStatus, say)}
                  </div>
                  <p className={`mt-0.5 truncate font-medium ${activeRental ? "font-bold text-[var(--foreground)]" : "text-[var(--foreground-secondary)]"}`}>{line}</p>
                </div>
                {/* Money only when there is some; "฿0 · 1 rental" said nothing. */}
                {item.lifetimeRevenue > 0 ? (
                  <p className="shrink-0 text-right font-bold tabular-nums text-[var(--foreground)]">{money(item.lifetimeRevenue)}</p>
                ) : null}
                <ChevronRight className="shrink-0 text-[var(--foreground-secondary)]" size={20} strokeWidth={2.2} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
