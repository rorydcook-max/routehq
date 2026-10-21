import type { Metadata, Route } from "next";
import { Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { RouteHqLogo } from "@/components/brand-logo";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";
import { VehicleArt } from "@/components/vehicle-art";
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
          <a aria-label="RouteHQ" href="/rent"><RouteHqLogo className="h-7 w-auto" showDescriptor={false} /></a>
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
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <BusinessLogoImage
                      alt={`${business.name} logo`}
                      className="max-h-10 max-w-[96px] object-contain"
                      fallback={<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-semibold text-white">{business.name.slice(0, 1)}</span>}
                      src={business.logoUrl}
                    />
                    <div className="min-w-0 flex-1 basis-40">
                      <h2 className="text-lg font-semibold leading-tight">{business.name}</h2>
                      <p className="text-sm text-[var(--muted)]">{[business.town, business.region].filter(Boolean).join(", ")}</p>
                    </div>
                    <Link className="pressable inline-flex min-h-10 shrink-0 items-center rounded-full border border-[var(--border)] px-4 text-sm font-bold text-[var(--primary)]" href={`/rent/${business.slug}`}>
                      {t("allVehicles")}
                    </Link>
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {business.vehicles.slice(0, 9).map((vehicle) => (
                      <div className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)]" key={vehicle.id}>
                        <div className="aspect-[16/10] bg-[var(--panel-secondary)]">
                          {vehicle.photoUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img alt={`${vehicle.make} ${vehicle.model}`} className="h-full w-full object-cover" src={vehicle.photoUrl} />
                          ) : (
                            <VehicleArt className="!h-full !w-full !rounded-none" colour={vehicle.color} kind={(vehicle.kind || "car") as any} model={vehicle.model} size="xl" />
                          )}
                        </div>
                        <div className="flex flex-1 flex-col p-3">
                          <p className="text-[16px] font-bold leading-tight">
                            {vehicle.make} {vehicle.model} {vehicle.year ? <span className="font-medium text-[var(--muted)]">{vehicle.year}</span> : null}
                          </p>
                          <p className="mt-0.5 text-sm text-[var(--muted)]">
                            {[vehicle.kind ? t(`kind_${vehicle.kind}`) : "", vehicle.seats ? t("seats", { count: vehicle.seats }) : "", vehicle.transmission].filter(Boolean).join(" · ")}
                          </p>
                          <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5">
                            <span className="text-[20px] font-bold leading-none">{money(vehicle.quote.rate, business.currency)}</span>
                            <span className="text-sm font-semibold text-[var(--muted)]">{t(`per_${vehicle.quote.model}`)}</span>
                          </p>
                          {vehicle.quote.total !== null ? <p className="mt-0.5 text-sm font-semibold text-[var(--primary)]">{t("total", { amount: money(vehicle.quote.total, business.currency) })}</p> : null}
                          <p className="mt-0.5 text-sm text-[var(--muted)]">{vehicle.deposit > 0 ? t("deposit", { amount: money(vehicle.deposit, business.currency) }) : t("noDeposit")}</p>
                          <div className="mt-auto pt-3">
                            <Link className="pressable inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-4 text-sm font-bold text-white" href={bookHref(business.slug, vehicle.id) as Route}>
                              {t("book")}
                            </Link>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  {business.vehicles.length > 9 ? (
                    <Link className="mt-3 inline-flex text-sm font-bold text-[var(--primary)]" href={`/rent/${business.slug}`}>
                      {t("more", { count: business.vehicles.length - 9 })}
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
