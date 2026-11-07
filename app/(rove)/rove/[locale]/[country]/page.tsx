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
import s from "../rove.module.css";

export const revalidate = 3600;
export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; country: string }> };

export function generateStaticParams({ params }: { params: { locale: string } }) {
  return params.locale === "en" ? Object.keys(COUNTRIES).map((country) => ({ country })) : [];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { country } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const rules = COUNTRIES[country];
  if (!rules) return {};
  const t = await getTranslations("directory");
  return roveMetadata({ title: t("rv.countryMetaTitle", { country: rules.name }), description: t("rv.countryDescription", { country: rules.name }), path: `/${rules.slug}`, locale, section: "country", ogTitle: t("rv.countryTitle", { country: rules.name }) });
}

export default async function CountryPage({ params }: Props) {
  const { country } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const rules = COUNTRIES[country];
  if (!rules) notFound();
  const t = await getTranslations("directory");
  const places = destinationsIn(country);
  const counts = await Promise.all(places.map(async (destination) => (await vehiclesIn(destination)).length));
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
      <JsonLd data={itemListLd(t("rv.countryTitle", { country: rules.name }), places.map((destination) => ({ name: destination.name, path: destinationPath(destination) })), locale)} />
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>{t("rv.countryTitle", { country: rules.name })}</h1>
        <p className={s.pageLede}>{t("rv.countryDescription", { country: rules.name })}</p>
      </header>
      <div className={s.signs}>
        {places.map((destination, index) => (
          <a className={counts[index] ? s.sign : s.signQuiet} href={destinationPath(destination)} key={destination.slug}>
            <span>
              <span className={s.signName}>{destination.name}</span>
              <span className={s.signRegion}>{destination.region}</span>
            </span>
            <span className={s.signCount}>
              <span>{counts[index] ? t("rv.vehicleCount", { count: counts[index] }) : t("rv.noListingsYet")}</span>
              <i aria-hidden="true" className="ti ti-arrow-up-right" style={{ fontSize: 20 }} />
            </span>
          </a>
        ))}
      </div>
      <section className={s.section}>
        <h2 className={s.sectionTitle}>{t("rv.countryRulesTitle", { country: rules.name })}</h2>
        <div style={{ marginTop: 18, maxWidth: 900 }}>
          <CountryRulesList rules={rules} />
          <SourceList checked="7 November 2026" sources={rules.sources} />
        </div>
      </section>
    </div>
  );
}
