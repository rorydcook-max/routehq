import type { Metadata, Route } from "next";
import { ChevronRight, MapPin, Search } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { RouteHqLogo } from "@/components/brand-logo";
import { PublicShell, publicCard } from "@/components/public-shell";
import { VehicleArt } from "@/components/vehicle-art";
import { renterUrl } from "@/lib/booking-address";
import { businessToday } from "@/lib/business-time";
import { searchDirectory, type DirectoryBusiness } from "@/lib/directory";

export const dynamic = "force-dynamic";

const KINDS = ["any", "car", "scooter", "motorbike", "van", "atv", "ebike"];
/** Where most rentals are: quick starts before anyone has searched. Place names, so not translated. */
const POPULAR = ["Koh Samui", "Phuket", "Chiang Mai"];

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("directory");
  // The renter site is Rove (Rory, 28 Oct), not the operator software's "| RoveHQ" title template.
  // One address for search engines: rove.rent, whether the page was reached there or at rovehq.app/rent.
  return {
    title: { absolute: `${t("title")} | Rove` },
    description: t("subtitle"),
    applicationName: "Rove",
    alternates: { canonical: `${renterUrl()}/` },
    openGraph: { siteName: "Rove", url: `${renterUrl()}/` }
  };
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
  // Every control in the search row is the app's standard 44px field, so tops and bottoms line up with the button.
  const inputClass = "mt-1 w-full text-[16px]";
  const bookHref = (slug: string, vehicleId: string) => `/rent/${slug}?from=${startDate}${endDate ? `&to=${endDate}` : ""}&vehicle=${vehicleId}&via=directory`;

  return (
    <PublicShell
      brand={
        <a aria-label="Rove" className="inline-flex" href="/rent">
          <RouteHqLogo product="keys" showDescriptor={false} />
        </a>
      }
      width="wide"
    >
      <div className="space-y-5">
        <header className={publicCard}>
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="measure mt-1 text-[15px] text-[var(--muted)]">{t("subtitle")}</p>
          <form action="/rent" className="mt-4 grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr_auto]" method="get">
            <label className="block text-sm font-semibold text-[var(--foreground-secondary)] sm:col-span-2 lg:col-span-1">
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
            <button className="pressable inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--primary)] px-6 text-[16px] font-semibold text-white sm:col-span-2 lg:col-span-1" type="submit">
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
          // Before a search: popular places to start from and how booking works, instead of an empty page.
          <>
            <section>
              <h2 className="text-lg font-semibold">{t("popularTitle")}</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                {POPULAR.map((spot) => (
                  <Link
                    className="pressable flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white p-4 shadow-sm hover:border-[var(--primary)]"
                    href={`/rent?place=${encodeURIComponent(spot)}&from=${today}` as Route}
                    key={spot}
                  >
                    <span className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                        <MapPin size={18} />
                      </span>
                      <span className="font-semibold">{spot}</span>
                    </span>
                    <ChevronRight className="text-[var(--muted)] rtl:rotate-180" size={18} />
                  </Link>
                ))}
              </div>
            </section>
            <section className={publicCard}>
              <h2 className="text-lg font-semibold">{t("howTitle")}</h2>
              <ol className="mt-4 grid gap-4 sm:grid-cols-3">
                {[1, 2, 3].map((step) => (
                  <li className="flex gap-3" key={step}>
                    <span className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-sm font-bold text-white">{step}</span>
                    <span>
                      <span className="block font-semibold">{t(`step${step}Title`)}</span>
                      <span className="mt-0.5 block text-sm text-[var(--muted)]">{t(`step${step}Body`)}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        )}

        <p className="measure mx-auto pb-2 text-center text-xs text-[var(--muted)]">{t("footer")}</p>
      </div>
    </PublicShell>
  );
}
