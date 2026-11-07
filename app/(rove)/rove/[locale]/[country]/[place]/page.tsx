import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { COUNTRIES, DESTINATIONS, destinationPath, findDestination } from "@/lib/rove/destinations";
import { GUIDES } from "@/lib/rove/guides";
import { quoteFor, reachFrom, roveToday, statsFor, vehiclesIn, nextFree } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { itemListLd, roveHqSite, roveMetadata } from "@/lib/rove/seo";
import { roveLocale, roveMoney } from "@/lib/rove/static";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { CountryRulesList, SourceList } from "../../_components/country-rules";
import { JsonLd } from "../../_components/json-ld";
import { SearchForm } from "../../_components/search-form";
import { VehicleCard } from "../../_components/vehicle-card";
import { searchWords } from "../../_components/words";
import s from "../../rove.module.css";

// Drawn ahead of time (English for now); the live vehicles and prices refresh hourly.
export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; country: string; place: string }> };

export function generateStaticParams({ params }: { params: { locale: string; country: string } }) {
  if (params.locale !== "en") return [];
  return DESTINATIONS.filter((destination) => destination.country === params.country).map((destination) => ({ place: destination.slug }));
}

const CHECKED = "7 November 2026";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, place } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const destination = findDestination(country, place);
  if (!destination) return {};
  const t = await getTranslations("directory");
  const stats = statsFor(await vehiclesIn(destination));
  const description = stats.vehicleCount
    ? t("rv.destDescriptionLive", { place: destination.name, count: stats.vehicleCount, businesses: stats.businesses.length })
    : t("rv.destDescriptionGuide", { place: destination.name });
  return roveMetadata({ title: t("rv.destMetaTitle", { place: destination.name }), description, path: destinationPath(destination), locale, section: "destination", ogTitle: t("rv.destTitle", { place: destination.name }) });
}

export default async function DestinationPage({ params }: Props) {
  const { country, place } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const destination = findDestination(country, place);
  const rules = COUNTRIES[country];
  if (!destination || !rules) notFound();
  const t = await getTranslations("directory");
  const today = roveToday();
  const [vehicles, words] = await Promise.all([vehiclesIn(destination), searchWords()]);
  const stats = statsFor(vehicles);
  const stay = { mode: "any" as const, start: today };
  const listed = vehicles
    .map((vehicle) => ({ vehicle, quote: quoteFor(vehicle, stay), reach: reachFrom(vehicle, null), next: nextFree(vehicle, today) }))
    .filter((row) => row.quote && row.next !== "open")
    .sort((a, b) => Number(Boolean(a.next)) - Number(Boolean(b.next)) || (a.quote?.perDay || 0) - (b.quote?.perDay || 0));
  const money = (value: number) => roveMoney(value, stats.currency || "THB", locale);
  const path = destinationPath(destination);
  const others = DESTINATIONS.filter((other) => other !== destination);
  const guides = GUIDES.filter((guide) => guide.related.includes(`${destination.country}/${destination.slug}`));

  return (
    <div className={s.wrap}>
      <Breadcrumbs
        items={[
          { name: "Rove", path: "/" },
          { name: rules.name, path: `/${rules.slug}` },
          { name: destination.name, path }
        ]}
        label={t("rv.breadcrumbs")}
        locale={locale}
      />
      {listed.length ? <JsonLd data={itemListLd(t("rv.destTitle", { place: destination.name }), listed.slice(0, 30).map((row) => ({ name: row.vehicle.name, path: `/vehicles/${row.vehicle.id}` })), locale)} /> : null}
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>{t("rv.destTitle", { place: destination.name })}</h1>
        <p className={s.pageLede}>{destination.intro}</p>
        {stats.vehicleCount ? (
          <div className={s.stats}>
            <span className={s.stat}>
              <strong>{t("rv.vehicleCount", { count: stats.vehicleCount })}</strong>
              {t("rv.fromBusinesses", { count: stats.businesses.length })}
            </span>
            {stats.ranges.map((range) =>
              range.daily || range.monthly ? (
                <span className={s.stat} key={range.kind}>
                  <strong>{t(`kind_${range.kind === "other" ? "car" : range.kind}`)}</strong>
                  {[
                    range.daily
                      ? range.daily.min === range.daily.max
                        ? t("rv.ratePer", { amount: money(range.daily.min), per: t("per_daily") })
                        : t("rv.rangeDay", { min: money(range.daily.min), max: money(range.daily.max) })
                      : null,
                    range.monthly
                      ? range.monthly.min === range.monthly.max
                        ? t("rv.ratePer", { amount: money(range.monthly.min), per: t("per_monthly") })
                        : t("rv.rangeMonth", { min: money(range.monthly.min), max: money(range.monthly.max) })
                      : null
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              ) : null
            )}
            {stats.deposits ? (
              <span className={s.stat}>
                <strong>{t("rv.depositLabel")}</strong>
                {stats.deposits.min === stats.deposits.max ? money(stats.deposits.min) : t("rv.rangePlain", { min: money(stats.deposits.min), max: money(stats.deposits.max) })}
              </span>
            ) : null}
          </div>
        ) : null}
      </header>

      <div style={{ marginTop: 22 }}>
        <SearchForm
          action={roveHref("/search", locale)}
          initial={{ place: destination.name, lat: destination.center.lat, lng: destination.center.lng, from: "", to: "", kind: "", monthly: false }}
          today=""
          words={words}
        />
      </div>

      <section className={s.sectionTight}>
        <h2 className={s.sectionTitle}>{t("rv.destListTitle", { place: destination.name })}</h2>
        {listed.length ? (
          <>
            <p className={s.sectionLede}>{t("rv.destListLede")}</p>
            <div className={s.resultList}>
              {listed.map((row, index) => (
                <VehicleCard delivers={Boolean(row.reach?.delivers)} eager={index < 2} freeFrom={row.next && row.next !== "open" ? row.next : null} key={row.vehicle.id} km={null} locale={locale} quote={row.quote!} stay={stay} vehicle={row.vehicle} />
              ))}
            </div>
          </>
        ) : (
          <div className={s.tellBox} style={{ marginTop: 16 }}>
            <h3 className={s.h3}>{t("rv.tellTitle")}</h3>
            <p className={s.muted} style={{ margin: "8px 0 16px", maxWidth: "60ch" }}>
              {t("rv.tellBody", { place: destination.name })}
            </p>
            <a className={s.buttonGhost} href={`${roveHqSite()}/?utm_source=rove.rent&utm_medium=referral&utm_campaign=tell_a_business`}>
              {t("rv.tellButton")}
            </a>
          </div>
        )}
      </section>

      <div className={s.guideGrid}>
        <section>
          <h2 className={s.sectionTitle}>{t("rv.guideTitle", { place: destination.name })}</h2>
          <div lang="en" style={{ marginTop: 18 }}>
            <div className={s.rule}>
              <h3 className={s.h3} style={{ fontSize: 19 }}>
                {t("rv.gettingAround")}
              </h3>
              <ul>
                {destination.gettingAround.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={s.rule}>
              <h3 className={s.h3} style={{ fontSize: 19 }}>
                {t("rv.whenMonthlyTitle")}
              </h3>
              <ul>
                <li>{destination.monthly}</li>
                {stats.monthlyExample ? (
                  <li>
                    {t("rv.monthlyExample", {
                      vehicle: stats.monthlyExample.vehicle,
                      daily: money(stats.monthlyExample.daily),
                      monthly: money(stats.monthlyExample.monthlyPerDay)
                    })}
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
          <CountryRulesList rules={rules} />
          <SourceList checked={CHECKED} sources={[...destination.sources, ...rules.sources]} />
        </section>
        <aside className={s.aside}>
          {guides.length ? (
            <div className={s.asideCard}>
              <p style={{ margin: 0, fontWeight: 700 }}>{t("rv.guidesTitle")}</p>
              <ul className={s.list} style={{ paddingInlineStart: 18 }}>
                {guides.map((guide) => (
                  <li key={guide.slug}>
                    <a href={`/guides/${guide.slug}`}>{guide.title}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={s.asideCard}>
            <p style={{ margin: 0, fontWeight: 700 }}>{t("rv.otherPlaces")}</p>
            <ul className={s.list} style={{ paddingInlineStart: 18 }}>
              {others.map((other) => (
                <li key={other.slug}>
                  <a href={destinationPath(other)}>{other.name}</a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
