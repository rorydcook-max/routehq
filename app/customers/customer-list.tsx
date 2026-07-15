"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { Badge, Card, EmptyState, ProgressBar, SectionHeader } from "@/components/ui";
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

  return new Intl.DateTimeFormat("en-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function documentBadge(status: CustomerListItem["documentStatus"]) {
  if (status === "complete") {
    return <Badge tone="green">Complete</Badge>;
  }
  if (status === "missing") {
    return <Badge tone="amber">Missing Documents</Badge>;
  }
  return <Badge tone="red">No Documents</Badge>;
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
          <h1 className="page-title">Customer CRM</h1>
          <p className="page-subtitle mt-2">Find renters, document status, active rentals, and lifetime value.</p>
        </div>
        <Link className="primary-action pressable" href="/customers/new">
          <Plus size={18} />
          Add Customer
        </Link>
      </div>

      <Card>
        <SectionHeader eyebrow="Directory" title={`${filteredCustomers.length} customers`} />
        <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto_auto]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#667085]" size={16} />
            <input
              className="input-with-leading-icon w-full rounded-xl border border-[var(--border)] bg-white pr-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or phone"
              value={search}
            />
          </label>
          <select
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
            onChange={(event) => setDocumentFilter(event.target.value)}
            value={documentFilter}
          >
            <option value="all">All document statuses</option>
            <option value="complete">Complete</option>
            <option value="incomplete">Incomplete</option>
          </select>
          <select
            className="rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-sm font-semibold text-[var(--foreground-secondary)]"
            onChange={(event) => setRentalFilter(event.target.value)}
            value={rentalFilter}
          >
            <option value="all">All rental statuses</option>
            <option value="renting">Currently Renting</option>
            <option value="not_renting">Not Renting</option>
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
        <div className="grid gap-3">
          {filteredCustomers.map((item) => {
            const activeRental = item.activeRental;
            return (
              <div className="sub-surface p-4 transition hover:border-[var(--primary)] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)]" key={item.customer.id}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="text-xl font-black text-[#10252b] hover:text-[#0f766e]" href={`/customers/${item.customer.id}`}>
                        {item.customer.full_name}
                      </Link>
                      {documentBadge(item.documentStatus)}
                    </div>
                    <p className="mt-1 text-sm font-semibold text-[#667085]">
                      {flagForNationality(item.customer.nationality)} {item.customer.nationality || "Nationality not set"}
                    </p>
                    {item.customer.phone ? (
                      <a className="mt-2 inline-flex text-sm font-bold text-[#0f766e]" href={`tel:${item.customer.phone}`}>{item.customer.phone}</a>
                    ) : (
                      <p className="mt-2 text-sm text-[#667085]">No phone number</p>
                    )}
                    <div className="mt-3 max-w-sm">
                      <div className="mb-1 flex justify-between text-xs font-bold text-[#667085]">
                        <span>Document completeness</span>
                        <span className="font-mono-data">{item.documentCompleteness}%</span>
                      </div>
                      <ProgressBar tone={item.documentStatus === "complete" ? "green" : item.documentStatus === "missing" ? "amber" : "red"} value={item.documentCompleteness} />
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3 lg:min-w-[520px]">
                    <div className="sub-surface p-3">
                      <p className="text-xs font-bold uppercase text-[#667085]">Active rental</p>
                      <p className="mt-1 text-sm font-black text-[#10252b]">
                        {activeRental ? `${activeRental.vehicles?.make || ""} ${activeRental.vehicles?.model || ""}`.trim() : "Not renting"}
                      </p>
                      <p className="mt-1 text-xs text-[#667085]">{activeRental?.end_date ? `Return ${formatDate(activeRental.end_date)}` : "No return due"}</p>
                    </div>
                    <div className="sub-surface p-3">
                      <p className="text-xs font-bold uppercase text-[#667085]">Lifetime value</p>
                      <p className="font-mono-data mt-1 text-sm font-black text-[#10252b]">{money(item.lifetimeRevenue)}</p>
                      <p className="font-mono-data mt-1 text-xs text-[#667085]">{item.totalRentals} rentals</p>
                    </div>
                    <div className="sub-surface p-3">
                      <p className="text-xs font-bold uppercase text-[#667085]">Last rental</p>
                      <p className="mt-1 text-sm font-black text-[#10252b]">{formatDate(item.lastRentalDate)}</p>
                      <p className="font-mono-data mt-1 text-xs text-[#667085]">{item.activeRentals.length} active</p>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
