import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { COUNTRIES, DESTINATIONS, destinationPath, type Destination } from "@/lib/rove/destinations";
import { GUIDES } from "@/lib/rove/guides";
import { sizedPhoto } from "@/lib/photo-url";
import { distanceKm } from "@/lib/place-coords";
import { loadMarket, nextFree, quoteFor, reachFrom, roveToday, type RoveVehicle } from "@/lib/rove/market";
import { roveHasLocale, roveHref } from "@/lib/rove/paths";
import { itemListLd, roveMetadata } from "@/lib/rove/seo";
import { roveLocale, roveMoney, type RoveParams } from "@/lib/rove/static";
import { listFleetHref } from "./_components/header";
import { JsonLd } from "./_components/json-ld";
import { PlaceArt } from "./_components/place-art";
import { SearchForm } from "./_components/search-form";
import { OperatorMark, VehicleCard, vehiclePhotoUrl, VehiclePhoto } from "./_components/vehicle-card";
import { searchWords } from "./_components/words";
import s from "./rove.module.css";

// Drawn ahead of time per language; the live listings refresh hourly.
export const revalidate = 3600;

/** Shown when fewer places have live listings than the set needs: well-known rental destinations, worldwide. */
const CURATED = ["indonesia/bali", "portugal/algarve", "greece/crete", "spain/mallorca", "mexico/cancun-riviera-maya", "italy/sardinia", "united-states/maui"];

/** Browse by type: the stock photos in public/site/vehicles (Pexels, see CREDITS.md), each a ready-made search. */
const TYPES = [
  { key: "Cars", photo: "toyota-corolla", query: "kind=car" },
  { key: "SmallCars", photo: "toyota-yaris", query: "kind=car&size=small" },
  { key: "Suvs", photo: "mitsubishi-pajero-sport", query: "kind=car&size=suv" },
  { key: "Scooters", photo: "vespa-vxl", query: "kind=scooter" }
] as const;

export async function generateMetadata({ params }: RoveParams): Promise<Metadata> {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  return roveMetadata({ title: t("rv.homeTitle2"), description: t("rv.homeDescription2"), path: "/", locale, section: "home", ogTitle: t("rv.heroTitle2") });
}

/** A real (not AI-made) main photo: what the home page leads with. */
const realPhoto = (vehicle: RoveVehicle) => vehicle.photoCount > 0 && !vehicle.photoAi?.[0];

/** Up to `count` bookable vehicles, photos first, taking turns between businesses so one fleet doesn't fill the row. */
function pickFeatured(vehicles: RoveVehicle[], today: string, count: number) {
  const stay = { mode: "any" as const, start: today };
  const rows = vehicles
    .map((vehicle) => ({ vehicle, quote: quoteFor(vehicle, stay), next: nextFree(vehicle, today) }))
    .filter((row) => row.quote && row.next !== "open")
    .sort((a, b) => Number(realPhoto(b.vehicle)) - Number(realPhoto(a.vehicle)) || Number(b.vehicle.photoCount > 0) - Number(a.vehicle.photoCount > 0) || Number(Boolean(a.next)) - Number(Boolean(b.next)));
  const byBusiness = new Map<string, typeof rows>();
  for (const row of rows) byBusiness.set(row.vehicle.business.organizationId, [...(byBusiness.get(row.vehicle.business.organizationId) || []), row]);
  const queues = [...byBusiness.values()];
  const picked: typeof rows = [];
  while (picked.length < count && queues.some((queue) => queue.length)) {
    for (const queue of queues) {
      const row = queue.shift();
      if (row && picked.length < count) picked.push(row);
    }
  }
  return picked.map((row) => ({ ...row, quote: row.quote!, next: row.next as string | null }));
}

export default async function RoveHome({ params }: RoveParams) {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  const today = roveToday();
  const [words, market] = await Promise.all([searchWords(), loadMarket()]);
  const featured = pickFeatured(market.vehicles, today, 8);
  const withPhotos = featured.filter((row) => realPhoto(row.vehicle));
  const heroVehicle = withPhotos[0]?.vehicle || null;
  const thumbVehicle = withPhotos.find((row) => row.vehicle.business.organizationId !== heroVehicle?.business.organizationId)?.vehicle || withPhotos[1]?.vehicle || null;
  const money = (vehicle: RoveVehicle, value: number) => roveMoney(value, vehicle.business.currency, locale);

  // Popular destinations: places with live listings first (most first), then the curated set, five in all.
  const near = (destination: Destination, vehicle: RoveVehicle) => Boolean(vehicle.area) && distanceKm(destination.center, vehicle.area as { lat: number; lng: number }) <= destination.radiusKm;
  const counted = DESTINATIONS.map((destination) => {
    const here = market.vehicles.filter((vehicle) => near(destination, vehicle));
    return { destination, count: here.length, photo: here.find(realPhoto) || null };
  });
  const live = counted.filter((row) => row.count > 0).sort((a, b) => b.count - a.count);
  const curated = CURATED.map((key) => counted.find((row) => `${row.destination.country}/${row.destination.slug}` === key)).filter((row): row is (typeof counted)[number] => Boolean(row) && !live.includes(row!));
  const places = [...live, ...curated].slice(0, 5);

  // Long stays: the listed vehicle whose monthly price saves most against its day price (photos preferred).
  const monthlyPick = market.vehicles
    .filter((vehicle) => vehicle.dailyRate > 0 && vehicle.monthlyRate > 0 && vehicle.monthlyRate / 30 < vehicle.dailyRate)
    .sort((a, b) => Number(realPhoto(b)) - Number(realPhoto(a)) || 1 - b.monthlyRate / 30 / b.dailyRate - (1 - a.monthlyRate / 30 / a.dailyRate))[0];
  const destinationsHref = roveHref("/destinations", roveHasLocale("destinations", locale) ? locale : "en");

  return (
    <>
      <JsonLd data={itemListLd(t("rv.placesTitle"), places.map(({ destination }) => ({ name: destination.name, path: destinationPath(destination) })), "en")} />

      <section className={s.hero}>
        <div className={s.wrap}>
          <div className={s.heroPanel}>
            <div className={s.heroCopy}>
              <h1 className={s.heroTitle}>{t("rv.heroTitle2")}</h1>
              <p className={s.heroLede}>{t("rv.heroLede2")}</p>
              <ul className={s.heroPoints}>
                {(["heroPoint1", "heroPoint2", "heroPoint3"] as const).map((key) => (
                  <li key={key}>
                    <i aria-hidden="true" className="ti ti-circle-check" />
                    {t(`rv.${key}`)}
                  </li>
                ))}
              </ul>
            </div>
            <div className={s.heroVisual}>
              <div className={s.heroPhoto}>
                {heroVehicle ? (
                  <VehiclePhoto eager sizes="(min-width: 900px) 560px, 92vw" vehicle={heroVehicle} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" fetchPriority="high" sizes="(min-width: 900px) 560px, 92vw" src="/site/vehicles/toyota-corolla.webp" srcSet="/site/vehicles/toyota-corolla-thumb.webp 400w, /site/vehicles/toyota-corolla.webp 1200w" />
                )}
                {heroVehicle ? (
                  <a className={s.heroCaption} href={roveHref(`/vehicles/${heroVehicle.id}`, locale)}>
                    <OperatorMark logoUrl={heroVehicle.business.logoUrl} name={heroVehicle.business.name} />
                    <span className={s.heroCaptionText}>
                      <span className={s.heroCaptionName}>{heroVehicle.name}</span>
                      <span className={s.heroCaptionMeta}>{t("rv.fromBusiness", { business: heroVehicle.business.name, town: heroVehicle.business.town || heroVehicle.business.region })}</span>
                    </span>
                    <span className={s.heroCaptionPrice}>
                      {heroVehicle.dailyRate > 0 ? money(heroVehicle, heroVehicle.dailyRate) : money(heroVehicle, heroVehicle.monthlyRate)}
                      <small>{heroVehicle.dailyRate > 0 ? t("per_daily") : t("per_monthly")}</small>
                    </span>
                  </a>
                ) : null}
              </div>
              {thumbVehicle && thumbVehicle !== heroVehicle ? (
                <div className={s.heroThumb}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" loading="lazy" src={sizedPhoto(vehiclePhotoUrl(thumbVehicle) || "", 480)} />
                </div>
              ) : null}
            </div>
          </div>
          <div className={s.heroSearch}>
            <SearchForm action={roveHref("/search", locale)} initial={{ place: "", lat: null, lng: null, from: "", to: "", kind: "", monthly: false }} today="" variant="hero" words={words} />
          </div>

          <nav aria-label={t("rv.typesTitle")} className={s.kinds}>
            {TYPES.map((type) => (
              <a className={s.kind} href={`${roveHref("/search", locale)}?${type.query}`} key={type.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" loading="lazy" sizes="(min-width: 900px) 290px, 46vw" src={`/site/vehicles/${type.photo}-thumb.webp`} srcSet={`/site/vehicles/${type.photo}-thumb.webp 400w, /site/vehicles/${type.photo}.webp 1200w`} />
                <span className={s.kindLabel}>{t(`rv.type${type.key}`)}</span>
              </a>
            ))}
          </nav>
        </div>
      </section>

      {featured.length ? (
        <section className={s.section}>
          <div className={s.wrap}>
            <div className={s.sectionHead}>
              <div>
                <h2 className={s.sectionTitle}>{t("rv.featuredTitle")}</h2>
                <p className={s.sectionLede}>{t("rv.featuredLede")}</p>
              </div>
              <a className={s.textLink} href={roveHref("/search", locale)}>
                {t("rv.seeAllVehicles")}
              </a>
            </div>
            <div className={`${s.tiles} ${s.tilesScroll}`}>
              {featured.map((row) => (
                <VehicleCard delivers={Boolean(reachFrom(row.vehicle, null)?.delivers)} freeFrom={row.next} key={row.vehicle.id} km={null} layout="grid" locale={locale} quote={row.quote} stay={{ mode: "any", start: today }} vehicle={row.vehicle} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className={`${s.section} ${s.sectionWhite}`}>
        <div className={s.wrap}>
          <div className={s.valueGrid}>
            <div>
              <h2 className={s.sectionTitle}>{t("rv.valueTitle")}</h2>
              <p className={s.sectionLede}>{t("rv.valueLede")}</p>
            </div>
            <ul className={s.valueList}>
              {(
                [
                  ["Local", "ti-building-store"],
                  ["Monthly", "ti-calendar-repeat"],
                  ["Price", "ti-receipt-off"],
                  ["Direct", "ti-message-circle"]
                ] as const
              ).map(([key, icon]) => (
                <li className={s.valueItem} key={key}>
                  <span aria-hidden="true" className={s.valueIcon}>
                    <i className={`ti ${icon}`} />
                  </span>
                  <div>
                    <h3 className={s.valueTitle}>{t(`rv.value${key}Title`)}</h3>
                    <p className={s.valueBody}>{t(`rv.value${key}Body`)}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div style={{ marginTop: 88 }}>
            <h2 className={s.sectionTitle} style={{ marginBottom: 28 }}>
              {t("howTitle")}
            </h2>
            <ol className={s.steps}>
              {[1, 2, 3].map((step) => (
                <li className={s.step} key={step}>
                  <span aria-hidden="true" className={s.stepNum}>
                    {step}
                  </span>
                  <span className={s.stepTitle}>{t(`step${step}Title`)}</span>
                  <span className={s.stepBody}>{t(`step${step}Body`)}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <div>
              <h2 className={s.sectionTitle}>{t("rv.placesTitle")}</h2>
              <p className={s.sectionLede}>{t("rv.placesLede")}</p>
            </div>
            <a className={s.textLink} href={destinationsHref}>
              {t("rv.allDestinations")}
            </a>
          </div>
          <div className={s.places}>
            {places.map(({ destination, count, photo }, index) => (
              <a className={s.place} href={destinationPath(destination)} key={destination.slug}>
                <PlaceArt destination={destination} sizes={index === 0 ? "(min-width: 900px) 600px, 92vw" : "(min-width: 900px) 300px, 46vw"} vehiclePhoto={photo ? vehiclePhotoUrl(photo) : null} />
                <span className={s.placeName}>{destination.name}</span>
                <span className={s.placeMeta}>
                  <span>{COUNTRIES[destination.country]?.name}</span>
                  {count ? <span className={s.placeLive}>{t("rv.vehicleCount", { count })}</span> : null}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className={`${s.section} ${s.sectionWhite}`}>
        <div className={`${s.wrap} ${s.monthly}`}>
          <div>
            <h2 className={s.sectionTitle}>{t("rv.monthlyTitle")}</h2>
            <p className={s.sectionLede}>{t("rv.monthlyLede")}</p>
            <ul className={s.checks}>
              {(["monthlyCheck1", "monthlyCheck2", "monthlyCheck3"] as const).map((key) => (
                <li key={key}>
                  <i aria-hidden="true" className="ti ti-circle-check" />
                  <span>{t(`rv.${key}`)}</span>
                </li>
              ))}
            </ul>
            <a className={s.btnLarge} href={`${roveHref("/search", locale)}?monthly=1`}>
              {t("rv.monthlyCta")}
            </a>
          </div>
          {monthlyPick ? (
            <a className={s.rateCard} href={roveHref(`/vehicles/${monthlyPick.id}`, locale)} style={{ textDecoration: "none" }}>
              <div className={s.rateCardPhoto}>
                <VehiclePhoto sizes="(min-width: 960px) 520px, 92vw" vehicle={monthlyPick} />
              </div>
              <div className={s.rateCardBody}>
                <p className={s.rateCardName}>{monthlyPick.name}</p>
                <p className={s.rateCardOp}>{t("rv.fromBusiness", { business: monthlyPick.business.name, town: monthlyPick.business.town || monthlyPick.business.region })}</p>
                <div className={s.rateRows}>
                  <span className={s.rateCell}>
                    <span className={s.rateCellLabel}>{t("rv.rateDay")}</span>
                    <span className={s.rateCellValue}>{money(monthlyPick, monthlyPick.dailyRate)}</span>
                    <span className={s.rateCellSub}>{t("per_daily")}</span>
                  </span>
                  <span className={s.rateCellBest}>
                    <span className={s.rateCellLabel}>{t("rv.rateMonth")}</span>
                    <span className={s.rateCellValue}>{money(monthlyPick, monthlyPick.monthlyRate)}</span>
                    <span className={s.rateCellSub}>{t("rv.aboutPerDay", { amount: money(monthlyPick, monthlyPick.monthlyRate / 30) })}</span>
                  </span>
                </div>
                <p className={s.rateCardNote}>{t("rv.rateCardNote", { business: monthlyPick.business.name })}</p>
              </div>
            </a>
          ) : null}
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>{t("rv.beforeYouDrive")}</h2>
            <a className={s.textLink} href="/guides">
              {t("rv.allGuides")}
            </a>
          </div>
          <ul className={s.guideList}>
            {GUIDES.slice(0, 3).map((guide) => (
              <li key={guide.slug}>
                <a className={s.guideItem} href={`/guides/${guide.slug}`} lang="en">
                  <span className={s.guideItemTitle}>{guide.title}</span>
                  <span className={s.guideItemBody}>{guide.standfirst}</span>
                </a>
              </li>
            ))}
          </ul>

          <div className={s.operators} style={{ marginTop: 96 }}>
            <div>
              <h2 className={s.sectionTitle}>{t("rv.operatorsTitle")}</h2>
              <p className={s.sectionLede}>{t("rv.operatorsBody")}</p>
            </div>
            <div className={s.operatorsActions}>
              <a className={s.btnAmber} href={listFleetHref("list_your_fleet")}>
                {t("rv.listFleet")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
