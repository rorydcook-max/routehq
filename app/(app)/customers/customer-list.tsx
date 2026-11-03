"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
import { ChevronRight, Search } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { flagForNationality } from "@/lib/customer-options";
import { initialsOf } from "@/components/glance";
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

/** The documents status as a few words for the meta line (a badge beside the name made those rows taller than the rest). */
function documentWords(status: CustomerListItem["documentStatus"], say: Say) {
  if (status === "complete") return null;
  return status === "missing" ? say("doc_missing") : say("doc_none");
}

// The same toolbar as Bookings: search, then a row of filters.
const chips = ["all", "renting", "owing", "missing"] as const;
type Chip = (typeof chips)[number];

export function CustomerList({ customers, initialDocuments = "all", initialRentals = "all" }: { customers: CustomerListItem[]; initialDocuments?: string; initialRentals?: string }) {
  const say = useTranslations("customers") as unknown as Say;
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [chip, setChip] = useState<Chip>(initialDocuments === "incomplete" ? "missing" : initialRentals === "renting" ? "renting" : "all");

  const matches = (item: CustomerListItem, entry: Chip) =>
    entry === "all" ||
    (entry === "renting" && item.activeRentals.length > 0) ||
    (entry === "owing" && Number(item.owesNow || 0) > 0) ||
    (entry === "missing" && item.documentStatus !== "complete");

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return customers.filter((item) => {
      const matchesSearch =
        !needle ||
        item.customer.full_name?.toLowerCase().includes(needle) ||
        item.customer.phone?.toLowerCase().includes(needle);
      return matchesSearch && matches(item, chip);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, chip, search]);

  // Only the filters that would show someone, and none while there is nothing to choose between.
  const usefulChips = chips.filter((entry) => entry === "all" || entry === chip || customers.some((item) => matches(item, entry)));
  const chipLabel: Record<Chip, string> = { all: say("filterAll"), renting: say("renting"), owing: say("filterOwing"), missing: say("filterMissing") };

  return (
    <div className="space-y-4">
      {customers.length > 0 ? (
        <div>
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <label className="relative block min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" size={18} />
              <input
                className="input-with-leading-icon min-h-11 w-full rounded-full border border-[var(--border)] bg-white pr-4 text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                onChange={(event) => setSearch(event.target.value)}
                placeholder={say("search")}
                value={search}
              />
            </label>
            {usefulChips.length > 1 ? (
              <div className="chip-row flex flex-wrap gap-2 xl:justify-end">
                {usefulChips.map((entry) => (
                  <button
                    aria-pressed={chip === entry}
                    className={`pressable min-h-11 min-w-fit rounded-full border px-4 font-bold ${chip === entry ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white text-[var(--foreground)]"}`}
                    key={entry}
                    onClick={() => setChip(entry)}
                    type="button"
                  >
                    {chipLabel[entry]}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          {/* The total is in the pills above; a count here only helps once a search or filter narrows the list. */}
          {filteredCustomers.length !== customers.length ? (
            <p className="mt-3 px-1 text-[18px] font-bold text-[var(--foreground)]">{say("count", { count: filteredCustomers.length })}</p>
          ) : null}
        </div>
      ) : null}

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title={say("emptyTitle")}
          description={say("emptyBody")}
          action={
            customers.length === 0 ? (
              <Link className="primary-action pressable" href="/customers/new">
                {say("add")}
              </Link>
            ) : undefined
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
            const docs = documentWords(item.documentStatus, say);
            const owes = Number(item.owesNow || 0);
            return (
              <Link className="flex min-h-[72px] items-start gap-3 px-4 py-3.5 transition hover:bg-[var(--panel-secondary)] sm:items-center" href={`/customers/${item.customer.id}`} key={item.customer.id}>
                {/* One avatar colour for everyone: the colours meant something only to whoever chose them. */}
                <span
                  aria-hidden="true"
                  className="num inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[15px] text-[var(--primary)] sm:h-11 sm:w-11 sm:text-[16px]"
                >
                  {initialsOf(item.customer.full_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="inline-flex min-w-0 items-center gap-1.5 break-words text-[17px] font-bold leading-tight text-[var(--foreground)]">
                      <span aria-hidden="true" className="shrink-0">{flagForNationality(item.customer.nationality)}</span>
                      <span className="min-w-0">{item.customer.full_name}</span>
                    </p>
                    {item.customer?.do_not_rent ? <Badge tone="red">{say("doNotRent")}</Badge> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 break-words font-medium text-[var(--foreground-secondary)]">
                    <span className={activeRental ? "font-semibold text-[var(--foreground)]" : ""}>{line}</span>
                    {docs ? <span className="font-semibold text-[var(--danger)]"> · {docs}</span> : null}
                  </p>
                  {/* What they owe is the exception, said in red under the name. */}
                  {owes > 0 ? (
                    <p className="mt-0.5 font-bold text-[var(--danger)]">
                      <span className="num">{money(owes)}</span> {say("owesLabel")}
                    </p>
                  ) : null}
                </div>
                {/* One meaning for the right-hand column: what they have spent with you. */}
                {item.lifetimeRevenue > 0 ? (
                  <span className="hidden shrink-0 text-right sm:block">
                    <span className="num block text-[16px] text-[var(--foreground)]">{money(item.lifetimeRevenue)}</span>
                    <span className="block text-[13px] font-medium text-[var(--foreground-secondary)]">{say("spentLabel")}</span>
                  </span>
                ) : null}
                <ChevronRight className="mt-2.5 shrink-0 text-[var(--foreground-secondary)] sm:mt-0" size={20} strokeWidth={2.2} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
