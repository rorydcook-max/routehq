"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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

function formatDate(value: string | null) {
  if (!value) {
    return "No rentals yet";
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function documentBadge(status: CustomerListItem["documentStatus"]) {
  if (status === "complete") {
    return <Badge tone="green">Complete</Badge>;
  }
  if (status === "missing") {
    return <Badge tone="amber">Documents missing</Badge>;
  }
  return <Badge tone="red">No documents</Badge>;
}

export function CustomerList({ customers }: { customers: CustomerListItem[] }) {
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
          <p className="page-eyebrow">Customers</p>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle mt-2">Find renters, document status, active rentals, and lifetime value.</p>
        </div>
        <Link className="primary-action pressable" href="/customers/new">
          <Plus size={18} />
          Add Customer
        </Link>
      </div>

      <Card>
        <SectionHeader eyebrow="Directory" title={`${filteredCustomers.length} customers`} />
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative col-span-2 block lg:col-span-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={16} />
            <input
              className="input-with-leading-icon w-full rounded-xl border border-[var(--border)] bg-white pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(15,118,110,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or phone"
              value={search}
            />
          </label>
          <select
            className="min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
            onChange={(event) => setDocumentFilter(event.target.value)}
            value={documentFilter}
          >
            <option value="all">All documents</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
          <select
            className="min-w-0 rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
            onChange={(event) => setRentalFilter(event.target.value)}
            value={rentalFilter}
          >
            <option value="all">Everyone</option>
            <option value="renting">Renting now</option>
            <option value="not_renting">Not renting</option>
          </select>
        </div>
      </Card>

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Customers are created automatically when you create a booking, or you can add one manually."
          action={
            <Link className="primary-action pressable" href="/customers/new">
              Add Customer
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
              ? `Renting the ${vehicle || "vehicle"} · ${activeRental.end_date ? `back ${formatDate(activeRental.end_date)}` : "open-ended"}`
              : item.lastRentalDate
                ? `Last rental ${formatDate(item.lastRentalDate)}`
                : "No rentals yet";
            return (
              <Link className="flex items-center gap-3 px-3.5 py-3 transition hover:bg-[var(--panel-secondary)]" href={`/customers/${item.customer.id}`} key={item.customer.id}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                      {flagForNationality(item.customer.nationality)} {item.customer.full_name}
                    </p>
                    {item.documentStatus === "complete" ? null : documentBadge(item.documentStatus)}
                  </div>
                  <p className={`mt-0.5 truncate text-sm ${activeRental ? "font-semibold text-[var(--primary)]" : "text-[var(--muted)]"}`}>{line}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono-data text-sm font-semibold text-[var(--foreground)]">{money(item.lifetimeRevenue)}</p>
                  <p className="text-xs text-[var(--muted)]">{item.totalRentals} {item.totalRentals === 1 ? "rental" : "rentals"}</p>
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
