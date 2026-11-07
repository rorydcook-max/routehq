import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { COUNTRIES, DESTINATIONS, destinationPath, ROVE_REGIONS } from "@/lib/rove/destinations";
import { GUIDES } from "@/lib/rove/guides";
import { vehiclesIn } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { itemListLd, roveHqSite, roveMetadata } from "@/lib/rove/seo";
import { roveLocale, type RoveParams } from "@/lib/rove/static";
import { JsonLd } from "./_components/json-ld";
import { SearchForm } from "./_components/search-form";
import { searchWords } from "./_components/words";
import s from "./rove.module.css";

// Drawn ahead of time per language; the vehicle counts refresh hourly.
export const revalidate = 3600;

export async function generateMetadata({ params }: RoveParams): Promise<Metadata> {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  return roveMetadata({ title: t("rv.homeTitle"), description: t("rv.homeDescription"), path: "/", locale, section: "home", ogTitle: t("rv.heroTitle") });
}

export default async function RoveHome({ params }: RoveParams) {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  // A worldwide set (task "roverent2": rove.rent is for renters everywhere), grouped by region; each region's places
  // with live vehicles first. Only real listings get a count.
  const featured = DESTINATIONS.filter((destination) => destination.featured);
  const [words, counts] = await Promise.all([searchWords(), Promise.all(featured.map(async (destination) => (await vehiclesIn(destination)).length))]);
  const places = featured.map((destination, index) => ({ destination, count: counts[index], country: COUNTRIES[destination.country] }));
  const regions = ROVE_REGIONS.map((region) => ({
    region,
    places: places.filter((place) => place.country?.group === region).sort((a, b) => Number(b.count > 0) - Number(a.count > 0))
  })).filter((group) => group.places.length);

  return (
    <>
      <JsonLd data={itemListLd(t("rv.destinationsTitle"), places.map(({ destination }) => ({ name: destination.name, path: destinationPath(destination) })), locale)} />
      <section className={s.hero}>
        <div className={s.wrap}>
          <h1 className={s.heroTitle}>{t("rv.heroTitle")}</h1>
          <p className={s.heroLede}>{t("rv.heroLede")}</p>
        </div>
        <div className={s.road}>
          <div className={s.wrap}>
            <SearchForm action={roveHref("/search", locale)} initial={{ place: "", lat: null, lng: null, from: "", to: "", kind: "", monthly: false }} today="" words={words} />
          </div>
        </div>
      </section>

      <section className={s.section} id="destinations">
        <div className={s.wrap}>
          <h2 className={s.sectionTitle}>{t("rv.destinationsTitle")}</h2>
          <p className={s.sectionLede}>{t("rv.destinationsLede")}</p>
          {regions.map((group) => (
            <div key={group.region}>
              <h3 className={s.regionTitle}>{t(`rv.region_${group.region}`)}</h3>
              <div className={s.signs}>
                {group.places.map(({ destination, count, country }) => (
                  <a className={count ? s.sign : s.signQuiet} href={destinationPath(destination)} key={destinationPath(destination)}>
                    <span>
                      <span className={s.signName}>{destination.name}</span>
                      <span className={s.signRegion}>{country?.name}</span>
                    </span>
                    <span className={s.signCount}>
                      <span>{count ? t("rv.vehicleCount", { count }) : ""}</span>
                      <i aria-hidden="true" className="ti ti-arrow-up-right" style={{ fontSize: 20 }} />
                    </span>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={s.section} style={{ background: "#fff" }}>
        <div className={s.wrap}>
          <h2 className={s.sectionTitle}>{t("howTitle")}</h2>
          <ol className={s.steps}>
            {[1, 2, 3].map((step) => (
              <li className={s.step} key={step}>
                <span aria-hidden="true" className={s.stepNum}>
                  {step}
                </span>
                <span>
                  <span className={s.stepTitle}>{t(`step${step}Title`)}</span>
                  <span className={s.muted}>{t(`step${step}Body`)}</span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          <h2 className={s.sectionTitle}>{t("rv.whyTitle")}</h2>
          <div className={s.why}>
            {(["Choice", "Monthly", "Direct"] as const).map((key) => (
              <div className={s.whyItem} key={key}>
                <h3 className={s.h3}>{t(`rv.why${key}Title`)}</h3>
                <p className={s.muted} style={{ marginTop: 8 }}>
                  {t(`rv.why${key}Body`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className={s.sectionTight}>
        <div className={s.wrap}>
          <h2 className={s.sectionTitle}>{t("rv.guidesTitle")}</h2>
          <p className={s.sectionLede}>{t("rv.guidesLede")}</p>
          <div className={s.cardGrid}>
            {/* The worldwide guides (listed first); the rest are on /guides. */}
            {GUIDES.slice(0, 4).map((guide) => (
              <a className={s.guideCard} href={`/guides/${guide.slug}`} key={guide.slug} lang="en">
                <span className={s.h3}>{guide.title}</span>
                <span className={s.muted} style={{ display: "block", marginTop: 8 }}>
                  {guide.standfirst}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.fleetBand}>
            <div>
              <h2 className={s.sectionTitle}>{t("rv.fleetTitle")}</h2>
              <p className={s.sectionLede}>{t("rv.fleetBody")}</p>
            </div>
            <a className={s.fleetButton} href={`${roveHqSite()}/?utm_source=rove.rent&utm_medium=referral&utm_campaign=list_your_fleet`}>
              {t("rv.listFleet")}
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
