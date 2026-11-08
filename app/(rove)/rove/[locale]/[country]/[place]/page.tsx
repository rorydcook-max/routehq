import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { COUNTRIES, DESTINATIONS, destinationPath, findDestination } from "@/lib/rove/destinations";
import { GUIDES } from "@/lib/rove/guides";
import { quoteFor, reachFrom, roveToday, statsFor, vehiclesIn, nextFree } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { itemListLd, roveHqSite, roveMetadata, roveOrigin } from "@/lib/rove/seo";
import { roveLocale, roveMoney } from "@/lib/rove/static";
import { sizedPhoto } from "@/lib/photo-url";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { CountryRulesList, SourceList } from "../../_components/country-rules";
import { Icon } from "../../_components/icon";
import { JsonLd } from "../../_components/json-ld";
import { PlaceArt, PlaceCredit, placePhoto } from "../../_components/place-art";
import { SearchForm } from "../../_components/search-form";
import { VehicleCard, vehiclePhotoUrl } from "../../_components/vehicle-card";
import { searchWords } from "../../_components/words";
import s from "../../rove.module.css";

// Drawn ahead of time (English for now); the live vehicles and prices refresh hourly.
export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; country: string; place: string }> };

// The full address, language included (English only for now): see [country]/page.tsx for why.
export function generateStaticParams() {
  return DESTINATIONS.map((destination) => ({ locale: "en", country: destination.country, place: destination.slug }));
}

const CHECKED = "7 November 2026";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country, place } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const destination = findDestination(country, place);
  if (!destination) return {};
  const t = await getTranslations("directory");
  const vehicles = await vehiclesIn(destination);
  const stats = statsFor(vehicles);
  const description = stats.vehicleCount
    ? t("rv.destDescriptionLive", { place: destination.name, count: stats.vehicleCount, businesses: stats.businesses.length })
    : t("rv.destDescriptionGuide", { place: destination.name });
  // Share picture: the place's own photo, else a listed vehicle there, else the drawn card (app/api/rove-og).
  const own = placePhoto(destination.slug);
  const withPhoto = vehicles.find((vehicle) => vehicle.photoCount > 0);
  const image = own ? `${roveOrigin()}${own}` : null;
  // A place with no live listings yet is followed but not indexed (thin for search; its rules are on the country page).
  return roveMetadata({
    title: t("rv.destMetaTitle", { place: destination.name }),
    description,
    path: destinationPath(destination),
    locale,
    section: "destination",
    ogTitle: t("rv.destTitle", { place: destination.name }),
    image: image || (withPhoto ? absolutePhoto(vehiclePhotoUrl(withPhoto)) : null),
    noindex: stats.vehicleCount === 0
  });
}

/** A listed vehicle's photo as a JPEG for link previews (some apps don't show WebP). */
function absolutePhoto(url: string | null) {
  return url ? `${roveOrigin()}${sizedPhoto(url, 1280, "jpg")}` : null;
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
  // Price ranges in the listed businesses' own currency (only shown when there are listings).
  const money = (value: number) => roveMoney(value, stats.currency || "USD", locale);
  const path = destinationPath(destination);
  const heroPhoto = vehicles.find((vehicle) => vehicle.photoCount > 0);
  // The same country's other places first, then the worldwide set.
  const others = [
    ...DESTINATIONS.filter((other) => other !== destination && other.country === destination.country),
    ...DESTINATIONS.filter((other) => other.country !== destination.country && other.featured)
  ].slice(0, 10);
  // Guides about this place, plus the two that apply everywhere (permits, insurance).
  const guides = GUIDES.filter((guide) => guide.related.includes(`${destination.country}/${destination.slug}`) || guide.slug === "do-i-need-an-international-driving-permit" || guide.slug === "car-rental-insurance-explained");
  const range = (min: number, max: number, key: "rangeDay" | "rangeMonth", per: "per_daily" | "per_monthly") => (min === max ? t("rv.ratePer", { amount: money(min), per: t(per) }) : t(`rv.${key}`, { min: money(min), max: money(max) }));

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

      <header className={s.placeHero}>
        <PlaceArt destination={destination} eager sizes="(min-width: 1240px) 1184px, 100vw" vehiclePhoto={heroPhoto ? vehiclePhotoUrl(heroPhoto) : null} />
        <PlaceCredit slug={destination.slug} />
        <p className={s.placeHeroKicker}>{rules.name}</p>
        <h1 className={s.pageTitle}>{t("rv.destTitle", { place: destination.name })}</h1>
        <p className={s.pageLede}>{destination.intro}</p>
      </header>
      <div className={s.placeSearch}>
        <SearchForm
          action={roveHref("/search", locale)}
          initial={{ place: destination.name, lat: destination.center.lat, lng: destination.center.lng, from: "", to: "", kind: "", monthly: false }}
          today=""
          words={words}
        />
      </div>

      {stats.vehicleCount ? (
        <dl className={s.figures}>
          <div className={s.figure}>
            <dt>{t("rv.figureListings")}</dt>
            <dd>{t("rv.vehicleCount", { count: stats.vehicleCount })}</dd>
          </div>
          <div className={s.figure}>
            <dt>{t("rv.figureBusinesses")}</dt>
            <dd>{stats.businesses.length}</dd>
          </div>
          {stats.ranges.map((row) =>
            row.daily || row.monthly ? (
              <div className={s.figure} key={row.kind}>
                <dt>{t(`kind_${row.kind === "other" ? "car" : row.kind}`)}</dt>
                <dd>
                  {[row.daily ? range(row.daily.min, row.daily.max, "rangeDay", "per_daily") : null, row.monthly ? range(row.monthly.min, row.monthly.max, "rangeMonth", "per_monthly") : null].filter(Boolean).join(", ")}
                </dd>
              </div>
            ) : null
          )}
          {stats.deposits ? (
            <div className={s.figure}>
              <dt>{t("rv.depositLabel")}</dt>
              <dd>{stats.deposits.min === stats.deposits.max ? money(stats.deposits.min) : t("rv.rangePlain", { min: money(stats.deposits.min), max: money(stats.deposits.max) })}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}

      <section className={s.sectionTight} style={{ paddingTop: 48 }}>
        <div className={s.sectionHead} style={{ marginBottom: 8 }}>
          <div>
            <h2 className={s.sectionTitle}>{t("rv.destListTitle", { place: destination.name })}</h2>
            {listed.length ? <p className={s.sectionLede}>{t("rv.destListLede")}</p> : null}
          </div>
        </div>
        {listed.length ? (
          <div className={s.resultList}>
            {listed.map((row, index) => (
              <VehicleCard delivers={Boolean(row.reach?.delivers)} eager={index < 1} freeFrom={row.next && row.next !== "open" ? row.next : null} key={row.vehicle.id} km={null} locale={locale} quote={row.quote!} stay={stay} vehicle={row.vehicle} />
            ))}
          </div>
        ) : (
          <div className={s.tellBox} style={{ marginTop: 16 }}>
            <span aria-hidden="true" className={s.emptyIcon}>
              <Icon name="building-store" />
            </span>
            <h3 className={s.emptyTitle}>{t("rv.tellTitle")}</h3>
            <p className={s.emptyBody}>{t("rv.tellBody", { place: destination.name })}</p>
            <a className={s.btnQuiet} href={`${roveHqSite()}/?utm_source=rove.rent&utm_medium=referral&utm_campaign=tell_a_business`}>
              {t("rv.tellButton")}
            </a>
          </div>
        )}
      </section>

      <div className={s.guideGrid} style={{ paddingTop: 40 }}>
        <section>
          <h2 className={s.sectionTitle}>{t("rv.guideTitle", { place: destination.name })}</h2>
          <div lang="en" style={{ marginTop: 24 }}>
            <div className={s.rule}>
              <h3 className={s.h3} style={{ fontSize: 18 }}>
                {t("rv.gettingAroundIn", { place: destination.name })}
              </h3>
              <ul>
                {destination.gettingAround.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className={s.rule}>
              <h3 className={s.h3} style={{ fontSize: 18 }}>
                {t("rv.dailyMonthlyTitle")}
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
          <h2 className={s.h3} style={{ margin: "40px 0 4px" }}>
            {t("rv.countryRulesTitle", { country: rules.name })}
          </h2>
          <CountryRulesList rules={rules} />
          <SourceList checked={CHECKED} sources={[...destination.sources, ...rules.sources]} />
        </section>
        <aside className={s.aside}>
          {guides.length ? (
            <div className={s.asideCard}>
              <p className={s.asideTitle}>{t("rv.guidesTitle")}</p>
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
            <p className={s.asideTitle}>{t("rv.otherPlaces")}</p>
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
