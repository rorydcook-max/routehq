import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { COUNTRIES, destinationPath, destinationsIn } from "@/lib/rove/destinations";
import { vehiclesIn } from "@/lib/rove/market";
import { itemListLd, roveMetadata } from "@/lib/rove/seo";
import { roveLocale } from "@/lib/rove/static";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { CountryRulesList, SourceList } from "../_components/country-rules";
import { JsonLd } from "../_components/json-ld";
import { PlaceArt } from "../_components/place-art";
import { vehiclePhotoUrl } from "../_components/vehicle-card";
import s from "../rove.module.css";

export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; country: string }> };

// The full address, language included (English only for now), as the website's /switch/[slug] does. Reading the
// language from the parent's params gave nothing in a production build, so no page was drawn and, with
// dynamicParams off, production answered 404 for every country.
export function generateStaticParams() {
  return Object.keys(COUNTRIES).map((country) => ({ locale: "en", country }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const rules = COUNTRIES[country];
  if (!rules) return {};
  const t = await getTranslations("directory");
  const counts = await Promise.all(destinationsIn(country).map(async (destination) => (await vehiclesIn(destination)).length));
  // No live listings anywhere in the country yet: followed, not indexed (task build-rove, 8 Nov 2026).
  return roveMetadata({
    title: t("rv.countryMetaTitle", { country: rules.name }),
    description: t("rv.countryDescription", { country: rules.name }),
    path: `/${rules.slug}`,
    locale,
    section: "country",
    ogTitle: t("rv.countryTitle", { country: rules.name }),
    noindex: counts.every((count) => count === 0)
  });
}

export default async function CountryPage({ params }: Props) {
  const { country } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const rules = COUNTRIES[country];
  if (!rules) notFound();
  const t = await getTranslations("directory");
  const places = destinationsIn(country);
  const rows = await Promise.all(
    places.map(async (destination) => {
      const vehicles = await vehiclesIn(destination);
      return { destination, count: vehicles.length, photo: vehicles.find((vehicle) => vehicle.photoCount > 0) || null };
    })
  );
  rows.sort((a, b) => b.count - a.count);
  const lead = rows[0];

  return (
    <div className={s.wrap}>
      <Breadcrumbs
        items={[
          { name: "Rove", path: "/" },
          { name: rules.name, path: `/${rules.slug}` }
        ]}
        label={t("rv.breadcrumbs")}
        locale={locale}
      />
      <JsonLd data={itemListLd(t("rv.countryTitle", { country: rules.name }), rows.map(({ destination }) => ({ name: destination.name, path: destinationPath(destination) })), locale)} />
      <header className={s.placeHero}>
        {lead ? <PlaceArt destination={{ slug: rules.slug, name: rules.name, center: lead.destination.center }} eager sizes="(min-width: 1240px) 1184px, 100vw" vehiclePhoto={lead.photo ? vehiclePhotoUrl(lead.photo) : null} /> : null}
        <h1 className={s.pageTitle}>{t("rv.countryTitle", { country: rules.name })}</h1>
        <p className={s.pageLede}>{t("rv.countryDescription", { country: rules.name })}</p>
      </header>

      <section className={s.sectionTight} style={{ paddingTop: 56 }}>
        <h2 className={s.sectionTitle} style={{ marginBottom: 24 }}>
          {t("rv.countryPlacesTitle", { country: rules.name })}
        </h2>
        <div className={s.places}>
          {rows.map(({ destination, count, photo }, index) => (
            <a className={s.place} href={destinationPath(destination)} key={destination.slug}>
              <PlaceArt destination={destination} sizes={index === 0 ? "(min-width: 900px) 600px, 92vw" : "(min-width: 900px) 300px, 46vw"} vehiclePhoto={photo ? vehiclePhotoUrl(photo) : null} />
              <span className={s.placeName}>{destination.name}</span>
              <span className={s.placeMeta}>
                <span>{destination.region}</span>
                {count ? <span className={s.placeLive}>{t("rv.vehicleCount", { count })}</span> : null}
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className={s.sectionTight} style={{ paddingTop: 48 }}>
        <h2 className={s.sectionTitle}>{t("rv.countryRulesTitle", { country: rules.name })}</h2>
        <div style={{ marginTop: 20, maxWidth: 920 }}>
          <CountryRulesList rules={rules} />
          <SourceList checked="7 November 2026" sources={rules.sources} />
        </div>
      </section>
    </div>
  );
}
