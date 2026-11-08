import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { distanceKm } from "@/lib/place-coords";
import { COUNTRIES, DESTINATIONS, destinationPath, ROVE_REGIONS } from "@/lib/rove/destinations";
import { loadMarket } from "@/lib/rove/market";
import { itemListLd, roveMetadata } from "@/lib/rove/seo";
import { roveLocale, type RoveParams } from "@/lib/rove/static";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { JsonLd } from "../_components/json-ld";
import s from "../rove.module.css";

// Every language (UI words only); live counts refresh hourly.
export const revalidate = 3600;

export async function generateMetadata({ params }: RoveParams): Promise<Metadata> {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  return roveMetadata({ title: t("rv.destinationsMetaTitle"), description: t("rv.destinationsDescription"), path: "/destinations", locale, section: "destinations", ogTitle: t("rv.destIndexTitle") });
}

/**
 * Every destination, by region and country (task build-rove, 8 Nov 2026): the one place that links to them all, in
 * place of the old footer list. Destination and country pages are written in English for now, so links go there.
 */
export default async function DestinationsPage({ params }: RoveParams) {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  const market = await loadMarket();
  const counted = DESTINATIONS.map((destination) => ({
    destination,
    count: market.vehicles.filter((vehicle) => vehicle.area && distanceKm(destination.center, vehicle.area) <= destination.radiusKm).length
  }));
  const live = counted.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
  const regions = ROVE_REGIONS.map((region) => {
    const countries = Object.values(COUNTRIES)
      .filter((country) => country.group === region)
      .map((country) => ({ country, places: counted.filter((row) => row.destination.country === country.slug) }))
      .filter((row) => row.places.length)
      .sort((a, b) => a.country.name.localeCompare(b.country.name));
    return { region, countries };
  }).filter((row) => row.countries.length);

  return (
    <div className={s.wrap}>
      <Breadcrumbs
        items={[
          { name: "Rove", path: "/" },
          { name: t("rv.destIndexTitle"), path: "/destinations" }
        ]}
        label={t("rv.breadcrumbs")}
        locale={locale}
      />
      <JsonLd data={itemListLd(t("rv.destIndexTitle"), DESTINATIONS.map((destination) => ({ name: destination.name, path: destinationPath(destination) })), "en")} />
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>{t("rv.destIndexTitle")}</h1>
        <p className={s.pageLede}>{t("rv.destIndexLede")}</p>
        {live.length ? (
          <div style={{ marginTop: 24 }}>
            <p className={s.asideTitle}>{t("rv.destinationsLive")}</p>
            <ul className={s.pillLinks} style={{ marginTop: 10 }}>
              {live.map(({ destination, count }) => (
                <li key={destination.slug}>
                  <a href={destinationPath(destination)}>
                    {destination.name} <span className={s.pillCount}>{t("rv.vehicleCount", { count })}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </header>
      <div style={{ paddingTop: 24 }}>
        {regions.map(({ region, countries }) => (
          <section className={s.regionBlock} key={region}>
            <h2 className={s.h3} style={{ fontSize: 26 }}>
              {t(`rv.region_${region}`)}
            </h2>
            <div className={s.regionGrid}>
              {countries.map(({ country, places }) => (
                <div key={country.slug}>
                  <h3 className={s.countryName}>
                    <a href={`/${country.slug}`}>{country.name}</a>
                  </h3>
                  <ul className={s.placeLinks}>
                    {places.map(({ destination, count }) => (
                      <li key={destination.slug}>
                        <a href={destinationPath(destination)}>
                          <span>{destination.name}</span>
                          {count ? <span className={s.pillCount}>{t("rv.vehicleCount", { count })}</span> : null}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
