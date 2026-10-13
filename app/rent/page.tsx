import type { Metadata, Route } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";
import { businessToday } from "@/lib/business-time";
import { searchDirectory, type DirectoryBusiness } from "@/lib/directory";

export const dynamic = "force-dynamic";

const KINDS = ["any", "car", "scooter", "motorbike", "van", "atv", "ebike"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  return { title: t("title"), description: t("subtitle") };
}

function money(value: number, currency: string) {
  return currency === "THB" ? `฿${Math.round(value).toLocaleString("en-US")}` : `${currency} ${Math.round(value).toLocaleString("en-US")}`;
}

type Params = { place?: string; from?: string; to?: string; kind?: string };

export default async function DirectoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const t = await getTranslations("directory");
  const today = businessToday();
  const place = String(params.place || "").slice(0, 80);
  const startDate = /^\d{4}-\d{2}-\d{2}$/.test(String(params.from || "")) && String(params.from) >= today ? String(params.from) : today;
  const endDate = /^\d{4}-\d{2}-\d{2}$/.test(String(params.to || "")) && String(params.to) > startDate ? String(params.to) : null;
  const kind = KINDS.includes(String(params.kind || "")) ? String(params.kind) : "any";
  const searched = Boolean(params.from || params.place || params.kind);
  const results: DirectoryBusiness[] = searched ? await searchDirectory({ place, startDate, endDate, kind }) : [];
  const total = results.reduce((sum, business) => sum + business.vehicles.length, 0);
  const inputClass = "mt-1 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-3 text-[16px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";
  const bookHref = (slug: string, vehicleId: string) => `/rent/${slug}?from=${startDate}${endDate ? `&to=${endDate}` : ""}&vehicle=${vehicleId}&via=directory`;

  return (
    <main className="min-h-screen bg-[var(--panel-secondary)] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-[var(--muted)]">RouteHQ</p>
          <CustomerLanguagePicker />
        </div>
        <header className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="mt-1 text-[15px] text-[var(--muted)]">{t("subtitle")}</p>
          <form action="/rent" className="mt-4 grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_1fr_auto]" method="get">
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("where")}
              <input className={inputClass} defaultValue={place} name="place" placeholder={t("wherePlaceholder")} />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("from")}
              <input className={inputClass} defaultValue={startDate} min={today} name="from" type="date" />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("to")}
              <input className={inputClass} defaultValue={endDate || ""} min={startDate} name="to" type="date" />
            </label>
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("kind")}
              <select className={inputClass} defaultValue={kind} name="kind">
                {KINDS.map((value) => (
                  <option key={value} value={value}>
                    {value === "any" ? t("anyKind") : t(`kind_${value}`)}
                  </option>
                ))}
              </select>
            </label>
            <button className="pressable mt-1 inline-flex min-h-[50px] items-center justify-center gap-2 self-end rounded-full bg-[var(--primary)] px-5 text-[16px] font-semibold text-white" type="submit">
              <Search size={18} /> {t("search")}
            </button>
          </form>
        </header>

        {searched ? (
          results.length ? (
            <>
              <p className="font-semibold text-[var(--foreground-secondary)]">{t("found", { count: total, businesses: results.length })}</p>
              {results.map((business) => (
                <section className="rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm" key={business.slug}>
                  <div className="flex items-center gap-3">
                    <BusinessLogoImage
                      alt={`${business.name} logo`}
                      className="max-h-12 max-w-[110px] object-contain"
                      fallback={<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-semibold text-white">{business.name.slice(0, 1)}</span>}
                      src={business.logoUrl}
                    />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold">{business.name}</h2>
                      <p className="text-sm text-[var(--muted)]">{[business.town, business.region].filter(Boolean).join(", ")}</p>
                    </div>
                    <Link className="ml-auto shrink-0 text-sm font-bold text-[var(--primary)]" href={`/rent/${business.slug}`}>
                      {t("allVehicles")}
                    </Link>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {business.vehicles.slice(0, 8).map((vehicle) => (
                      <div className="flex flex-col rounded-xl border border-[var(--border)] p-3" key={vehicle.id}>
                        <p className="text-[16px] font-bold">
                          {vehicle.make} {vehicle.model} {vehicle.year ? <span className="font-medium text-[var(--muted)]">{vehicle.year}</span> : null}
                        </p>
                        <p className="text-sm text-[var(--muted)]">
                          {[vehicle.kind ? t(`kind_${vehicle.kind}`) : "", vehicle.seats ? t("seats", { count: vehicle.seats }) : "", vehicle.transmission].filter(Boolean).join(" · ")}
                        </p>
                        <p className="mt-2 text-[15px] font-bold">
                          {money(vehicle.quote.rate, business.currency)} {t(`per_${vehicle.quote.model}`)}
                          {vehicle.quote.total !== null ? <span className="font-medium text-[var(--muted)]"> · {t("total", { amount: money(vehicle.quote.total, business.currency) })}</span> : null}
                        </p>
                        <p className="text-sm text-[var(--muted)]">{vehicle.deposit > 0 ? t("deposit", { amount: money(vehicle.deposit, business.currency) }) : t("noDeposit")}</p>
                        <Link className="pressable mt-3 inline-flex min-h-11 items-center justify-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white" href={bookHref(business.slug, vehicle.id) as Route}>
                          {t("book")}
                        </Link>
                      </div>
                    ))}
                  </div>
                  {business.vehicles.length > 8 ? (
                    <Link className="mt-3 inline-flex text-sm font-bold text-[var(--primary)]" href={`/rent/${business.slug}`}>
                      {t("more", { count: business.vehicles.length - 8 })}
                    </Link>
                  ) : null}
                </section>
              ))}
            </>
          ) : (
            <section className="rounded-2xl border border-[var(--border)] bg-white p-5 text-center shadow-sm">
              <p className="text-lg font-semibold">{t("noneTitle")}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("noneBody")}</p>
            </section>
          )
        ) : (
          <p className="text-center text-sm text-[var(--muted)]">{t("hint")}</p>
        )}

        <p className="pb-6 text-center text-xs text-[var(--muted)]">{t("footer")}</p>
      </div>
    </main>
  );
}
