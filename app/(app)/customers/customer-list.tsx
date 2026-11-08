"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { longDate, dateFormat } from "@/lib/i18n/dates";
import { businessCurrency } from "@/lib/business-units";
import { formatMoney } from "@/lib/regional";
import { BarChart3, ChevronRight, Search } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { PartBar, Spark } from "@/components/glance";
import { flagForNationality } from "@/lib/customer-options";
import { initialsOf } from "@/components/glance";
import type { CustomerListItem, CustomerMonth, CustomerSource } from "@/lib/customer-detail";

type Say = (key: string, values?: Record<string, string | number>) => string;

// In the business's own currency (was always baht).
function money(value: number) {
  // Exact (pence kept when there are any): "£2,100 spent" was really £2,099.50 after a refund.
  return formatMoney(Math.round(value * 100) / 100, businessCurrency(), "en-US");
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

// One "Filter" dropdown instead of a row of chips (Rory, 7 Nov 2026), and a "Sort" beside it.
const FILTERS = ["all", "missing", "owing", "partner", "renting", "returning", "rove_rent"] as const;
type Filter = (typeof FILTERS)[number];
const SORTS = ["recent", "spent", "rentals", "name"] as const;
type Sort = (typeof SORTS)[number];

const SOURCES: CustomerSource[] = ["booking_page", "direct", "imported", "partner", "rove_rent"];
const SOURCE_COLOUR: Record<CustomerSource, string> = {
  booking_page: "var(--primary)",
  direct: "var(--coming-back)",
  imported: "var(--border-strong)",
  partner: "var(--going-out)",
  rove_rent: "var(--success)"
};

/** The most recent thing that happened with a customer, for the "Recent" sort. */
function recency(item: CustomerListItem) {
  return [item.stats?.nextStart, item.activeRental?.start_date, item.stats?.lastEnd, String(item.customer.created_at || "").slice(0, 10)]
    .filter(Boolean)
    .map(String)
    .sort()
    .at(-1) || "";
}

function matches(item: CustomerListItem, entry: Filter) {
  return (
    entry === "all" ||
    (entry === "renting" && item.activeRentals.some((rental: any) => rental.status !== "booked")) ||
    (entry === "owing" && Number(item.owesNow || 0) > 0) ||
    (entry === "missing" && item.documentStatus !== "complete") ||
    (entry === "returning" && (item.stats?.rentals || 0) >= 2) ||
    (entry === "rove_rent" && item.stats?.source === "rove_rent") ||
    (entry === "partner" && item.stats?.source === "partner")
  );
}

export function CustomerList({ customers, months = [], initialFilter = "all" }: { customers: CustomerListItem[]; months?: CustomerMonth[]; initialFilter?: string }) {
  const say = useTranslations("customers") as unknown as Say;
  const locale = useLocale();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>((FILTERS as readonly string[]).includes(initialFilter) ? (initialFilter as Filter) : "all");
  const [sort, setSort] = useState<Sort>("recent");
  const [insights, setInsights] = useState(false);

  const filteredCustomers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = customers.filter((item) => {
      const matchesSearch = !needle || item.customer.full_name?.toLowerCase().includes(needle) || item.customer.phone?.toLowerCase().includes(needle);
      return matchesSearch && matches(item, filter);
    });
    const byName = (left: CustomerListItem, right: CustomerListItem) => String(left.customer.full_name || "").localeCompare(String(right.customer.full_name || ""), locale);
    return list.sort((left, right) => {
      if (sort === "name") return byName(left, right);
      if (sort === "spent") return (right.stats?.revenue || 0) - (left.stats?.revenue || 0) || byName(left, right);
      if (sort === "rentals") return (right.stats?.rentals || 0) - (left.stats?.rentals || 0) || byName(left, right);
      return recency(right).localeCompare(recency(left)) || byName(left, right);
    });
  }, [customers, filter, search, sort, locale]);

  const filterLabel: Record<Filter, string> = {
    all: say("filterAll"),
    renting: say("renting"),
    owing: say("filterOwing"),
    missing: say("filterMissing"),
    returning: say("filterReturning"),
    rove_rent: say("filterRoveRent"),
    partner: say("filterPartner")
  };
  const sortLabel: Record<Sort, string> = { recent: say("sortRecent"), spent: say("sortSpent"), rentals: say("sortRentals"), name: say("sortName") };
  // "All" first, then the rest A–Z in the reader's language; only filters that would show someone.
  const filterOptions = FILTERS.filter((entry) => entry !== "all" && (entry === filter || customers.some((item) => matches(item, entry)))).sort((left, right) => filterLabel[left].localeCompare(filterLabel[right], locale));
  const sortOptions = [...SORTS].sort((left, right) => sortLabel[left].localeCompare(sortLabel[right], locale));
  const selectClass = "min-h-11 rounded-full border border-[var(--border-strong)] bg-white px-4 font-bold text-[var(--foreground)] outline-none focus:ring-2 focus:ring-[var(--focus-ring)]";

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
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap xl:justify-end">
              <label className="min-w-0">
                <span className="sr-only">{say("filterLabel")}</span>
                <select aria-label={say("filterLabel")} className={`${selectClass} w-full`} onChange={(event) => setFilter(event.target.value as Filter)} value={filter}>
                  <option value="all">{say("filterAllLong")}</option>
                  {filterOptions.map((entry) => (
                    <option key={entry} value={entry}>
                      {filterLabel[entry]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0">
                <span className="sr-only">{say("sortLabel")}</span>
                <select aria-label={say("sortLabel")} className={`${selectClass} w-full`} onChange={(event) => setSort(event.target.value as Sort)} value={sort}>
                  {sortOptions.map((entry) => (
                    <option key={entry} value={entry}>
                      {say("sortPrefix", { sort: sortLabel[entry] })}
                    </option>
                  ))}
                </select>
              </label>
              <button
                aria-pressed={insights}
                className={`pressable col-span-2 inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border px-4 font-bold ${insights ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border-strong)] bg-white text-[var(--foreground)]"}`}
                onClick={() => setInsights((open) => !open)}
                type="button"
              >
                <BarChart3 aria-hidden="true" size={17} />
                {say("insights")}
              </button>
            </div>
          </div>
          {/* The total is in the pills above; a count here only helps once a search or filter narrows the list. */}
          {filteredCustomers.length !== customers.length ? (
            <p className="mt-3 px-1 text-[18px] font-bold text-[var(--foreground)]">{say("count", { count: filteredCustomers.length })}</p>
          ) : null}
        </div>
      ) : null}

      {insights ? <Insights customers={customers} locale={locale} months={months} say={say} /> : null}

      {filteredCustomers.length === 0 ? (
        <EmptyState
          title={say("emptyTitle")}
          action={
            customers.length === 0 ? (
              <Link className="primary-action pressable" href="/customers/new">
                {say("add")}
              </Link>
            ) : undefined
          }
        />
      ) : (
        // One block per person: who they are, what they have now, their history in a line, what they're worth.
        <div className="card divide-y divide-[var(--border)] overflow-hidden">
          {filteredCustomers.map((item) => {
            const activeRental = item.activeRental;
            const stats = item.stats;
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
            // Their history in one short line: rentals and days, where they came from, and the next booking if any.
            const history = [
              stats && stats.rentals > 0 ? say("historyLine", { count: stats.rentals, days: stats.rentalDays }) : null,
              stats ? say(`src_${stats.source}`) : null,
              stats?.nextStart && activeRental?.status !== "booked" ? say("nextLine", { date: formatDate(stats.nextStart, say, locale) }) : null
            ].filter(Boolean) as string[];
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
                    {(stats?.rentals || 0) >= 2 ? <Badge tone="blue">{say("returningBadge")}</Badge> : null}
                    {(stats?.damageCount || 0) > 0 ? <Badge tone="amber">{say("damageBadge")}</Badge> : null}
                  </div>
                  <p className="mt-0.5 line-clamp-2 break-words font-medium text-[var(--foreground-secondary)]">
                    <span className={activeRental ? "font-semibold text-[var(--foreground)]" : ""}>{line}</span>
                    {docs ? <span className="font-semibold text-[var(--danger)]"> · {docs}</span> : null}
                  </p>
                  {history.length || item.lifetimeRevenue > 0 ? (
                    <p className="mt-0.5 text-[14px] font-medium text-[var(--muted)]">
                      {history.join(" · ")}
                      {/* On a phone the spend joins this line; on a wide screen it has its own column. */}
                      {item.lifetimeRevenue > 0 ? <span className="sm:hidden">{history.length ? " · " : ""}{say("spentLine", { amount: money(item.lifetimeRevenue) })}</span> : null}
                    </p>
                  ) : null}
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

/** Short month name ("Jan"), three letters in English. */
function monthName(key: string, locale: string) {
  const name = dateFormat(locale, { month: "short", timeZone: "UTC" }).format(new Date(`${key}-01T00:00:00Z`));
  return locale.startsWith("en") ? name.slice(0, 3) : name;
}

/** Light insights from real data: new customers by month, top countries, where they came from, length and spend. */
function Insights({ customers, months, say, locale }: { customers: CustomerListItem[]; months: CustomerMonth[]; say: Say; locale: string }) {
  const top = Math.max(1, ...months.map((month) => month.newCustomers));
  const countries = new Map<string, number>();
  for (const item of customers) {
    const name = String(item.customer.nationality || "").trim();
    if (name) countries.set(name, (countries.get(name) || 0) + 1);
  }
  const topCountries = Array.from(countries.entries()).sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).slice(0, 5);
  const sources = SOURCES.map((source) => ({ source, count: customers.filter((item) => item.stats?.source === source).length }))
    .filter((row) => row.count > 0)
    .sort((left, right) => right.count - left.count);
  const withRentals = months.filter((month) => month.rentals > 0);
  const lengthPoints = months.map((month) => ({ key: month.month, value: month.rentals ? month.rentalDays / month.rentals : 0, tip: `${monthName(month.month, locale)} · ${say("daysShort", { count: month.rentals ? Math.round(month.rentalDays / month.rentals) : 0 })}` }));
  const spendPoints = months.map((month) => ({ key: month.month, value: month.rentals ? month.revenue / month.rentals : 0, tip: `${monthName(month.month, locale)} · ${money(month.rentals ? month.revenue / month.rentals : 0)}` }));
  const latest = withRentals.at(-1);
  const card = "card p-4";

  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className={card}>
        <h2 className="card-title">{say("in_new")}</h2>
        <div aria-label={say("in_new")} className="mt-3 flex h-[118px] items-end gap-1" role="img">
          {months.map((month) => (
            <div className="chart-col relative flex flex-1 flex-col items-center gap-1" data-tip={`${monthName(month.month, locale)} · ${month.newCustomers}`} key={month.month} tabIndex={0}>
              <div className="flex w-full items-end justify-center border-b border-[var(--border)]" style={{ height: 82 }}>
                <span className="grow-y w-3/4 max-w-6 rounded-t-[4px] bg-[var(--primary)]" style={{ height: `${month.newCustomers > 0 ? Math.max(4, Math.round((month.newCustomers / top) * 80)) : 2}px` }} />
              </div>
              <span className="whitespace-nowrap text-[12px] font-semibold text-[var(--muted)]">{monthName(month.month, locale)}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={card}>
        <h2 className="card-title">{say("in_countries")}</h2>
        {topCountries.length === 0 ? (
          <p className="num mt-2 text-[22px] text-[var(--muted)]">—</p>
        ) : (
          <ul className="mt-2 grid gap-2.5">
            {topCountries.map(([name, count]) => (
              <li key={name}>
                <p className="flex items-baseline justify-between gap-2 font-semibold text-[var(--foreground)]">
                  <span className="truncate">
                    <span aria-hidden="true">{flagForNationality(name)}</span> {name}
                  </span>
                  <span className="num shrink-0">{count}</span>
                </p>
                <PartBar color="var(--primary)" part={count} whole={customers.length} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={card}>
        <h2 className="card-title">{say("in_sources")}</h2>
        <ul className="mt-2 grid gap-2.5">
          {sources.map(({ source, count }) => (
            <li key={source}>
              <p className="flex items-baseline justify-between gap-2 font-semibold text-[var(--foreground)]">
                <span className="truncate">{say(`src_${source}`)}</span>
                <span className="num shrink-0">{say("in_share", { count, percent: Math.round((count / Math.max(1, customers.length)) * 100) })}</span>
              </p>
              <PartBar color={SOURCE_COLOUR[source]} part={count} whole={customers.length} />
            </li>
          ))}
        </ul>
      </section>

      <section className={card}>
        <h2 className="card-title">{say("in_trend")}</h2>
        {/* Labels and numbers only; the little lines appear once there are two months to compare. */}
        <div className="mt-2 grid grid-cols-2 gap-4">
          <div>
            <p className="font-semibold text-[var(--muted)]">{say("in_avgLength")}</p>
            <p className="num text-[22px] text-[var(--foreground)]">{latest ? say("daysShort", { count: Math.round(latest.rentalDays / latest.rentals) }) : "—"}</p>
            {withRentals.length >= 2 ? <Spark color="var(--coming-back)" label={say("in_avgLength")} points={lengthPoints} /> : null}
          </div>
          <div>
            <p className="font-semibold text-[var(--muted)]">{say("in_avgSpend")}</p>
            <p className="num text-[22px] text-[var(--foreground)]">{latest ? money(latest.revenue / latest.rentals) : "—"}</p>
            {withRentals.length >= 2 ? <Spark label={say("in_avgSpend")} points={spendPoints} /> : null}
          </div>
        </div>
      </section>
    </div>
  );
}
