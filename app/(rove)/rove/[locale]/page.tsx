import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getPublishedReviews, getReviewStats } from "@/lib/reviews";
import { COUNTRIES, DESTINATIONS, destinationPath, type Destination } from "@/lib/rove/destinations";
import { localizedGuides } from "@/lib/rove/guides";
import { basedIn, liveDestinations, loadMarket, nextFree, quoteFor, reachFrom, roveToday, type RoveVehicle } from "@/lib/rove/market";
import { roveHasLocale, roveHref } from "@/lib/rove/paths";
import { itemListLd, roveMetadata } from "@/lib/rove/seo";
import { roveDate, roveLocale, roveMoney, type RoveParams } from "@/lib/rove/static";
import { listFleetHref } from "./_components/header";
import { Icon, type IconName } from "./_components/icon";
import { JsonLd } from "./_components/json-ld";
import { PlaceArt, PlaceCredit, placePhoto } from "./_components/place-art";
import { SearchForm } from "./_components/search-form";
import { OperatorMark, VehicleCard, vehiclePhotoUrl, VehiclePhoto, vehicleTitle } from "./_components/vehicle-card";
import { searchWords } from "./_components/words";
import s from "./rove.module.css";

// Drawn ahead of time per language; the live listings refresh hourly.
export const revalidate = 3600;

/** Shown when fewer places have live listings than the set needs: well-known rental destinations, worldwide. */
const CURATED = ["indonesia/bali", "portugal/algarve", "greece/crete", "spain/mallorca", "mexico/cancun-riviera-maya", "italy/sardinia", "united-states/maui"];

/** Browse by type: the stock photos in public/site/vehicles (Pexels, see CREDITS.md), each a ready-made search. */
const TYPES = [
  { key: "Cars", photo: "toyota-corolla", alt: "Toyota Corolla", query: "kind=car" },
  { key: "SmallCars", photo: "toyota-yaris", alt: "Toyota Yaris", query: "kind=car&size=small" },
  { key: "Suvs", photo: "mitsubishi-pajero-sport", alt: "Mitsubishi Pajero Sport", query: "kind=car&size=suv" },
  { key: "Scooters", photo: "vespa-vxl", alt: "Vespa VXL", query: "kind=scooter" }
] as const;

/** The hero's short promises, as chips under the search (rove-design-2): what Rove is, at a glance. */
const CHIPS: Array<[string, IconName]> = [
  ["chipLocal", "building-store"],
  ["chipMonthly", "calendar-repeat"],
  ["chipDelivery", "truck-delivery"],
  ["chipSign", "signature"]
];

/**
 * What makes Rove different, as tiles. Monthly is the big tile, with a real listing's two prices when there is one.
 * Deposits shown up front is the sixth promise; it sits with the trust signals further down.
 */
const FEATURES: Array<[string, IconName]> = [
  ["Local", "building-store"],
  ["Price", "discount"],
  ["Delivery", "truck-delivery"],
  ["Sign", "signature"]
];

/**
 * Trust: only what is true of every booking on Rove today (rove-design-2). No ratings, counts or quotes here; real
 * renters' reviews show above these, and only when businesses have published some.
 */
const TRUST: Array<[string, IconName]> = [
  ["Direct", "building-store"],
  ["Agreement", "signature"],
  ["Deposit", "file-text"],
  ["Monthly", "calendar-repeat"],
  ["Photos", "photo"],
  ["Secure", "lock"]
];

/** How it works: a real sequence, so numbered, each with its own picture. */
const STEPS: IconName[] = ["search", "car", "key"];

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

/**
 * Renters' reviews of the businesses listed on Rove (rove-design-2): only reviews the renter agreed to share and the
 * business published (lib/reviews.ts), with the average and count worked out from those same published reviews.
 * Nothing is made up or padded; with none published, the home page shows no reviews and no rating at all.
 */
async function listedReviews(vehicles: RoveVehicle[]) {
  const businesses = new Map<string, string>();
  for (const vehicle of vehicles) if (!businesses.has(vehicle.business.organizationId)) businesses.set(vehicle.business.organizationId, vehicle.business.name);
  const ids = [...businesses.keys()].slice(0, 24);
  const rows = await Promise.all(ids.map(async (id) => ({ id, stats: await getReviewStats(id), reviews: await getPublishedReviews(id, 6) })));
  const count = rows.reduce((sum, row) => sum + row.stats.count, 0);
  const average = count ? rows.reduce((sum, row) => sum + row.stats.average * row.stats.count, 0) / count : 0;
  const reviews = rows
    .flatMap((row) => row.reviews.map((review) => ({ ...review, business: businesses.get(row.id) || "" })))
    .filter((review) => review.text.trim())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  return { count, average, reviews };
}

function Stars({ value }: { value: number }) {
  const full = Math.round(value);
  return (
    <span aria-hidden="true" className={s.starRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Icon className={n <= full ? s.starOn : s.starOff} key={n} name="star" />
      ))}
    </span>
  );
}

export default async function RoveHome({ params }: RoveParams) {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  const today = roveToday();
  const [words, market] = await Promise.all([searchWords(), loadMarket()]);
  const featured = pickFeatured(market.vehicles, today, 8);
  const withPhotos = featured.filter((row) => realPhoto(row.vehicle));
  const heroVehicle = withPhotos[0]?.vehicle || null;
  const money = (vehicle: RoveVehicle, value: number) => roveMoney(value, vehicle.business.currency, locale);
  const reviews = await listedReviews(market.vehicles);

  // Popular destinations: places with live listings (most first). Only when fewer than five have any does the curated
  // set fill the row; those pages have no listings yet (not indexed), so they stay out of the ItemList for search engines.
  const live = liveDestinations(DESTINATIONS, market.vehicles).map((row) => ({ ...row, photo: market.vehicles.find((vehicle) => basedIn(row.destination, vehicle) && realPhoto(vehicle)) || null }));
  const curated = live.length >= 5 ? [] : CURATED.map((key) => DESTINATIONS.find((destination) => `${destination.country}/${destination.slug}` === key)).filter((destination): destination is Destination => Boolean(destination) && !live.some((row) => row.destination === destination)).map((destination) => ({ destination, count: 0, photo: null }));
  const places = [...live, ...curated].slice(0, 5);
  // The hero's picture: the busiest place with its own photograph (somewhere renters can actually book, not stock).
  const heroPlace = places.find((row) => placePhoto(row.destination.slug))?.destination || places[0]?.destination || null;

  // Long stays: the listed vehicle whose monthly price saves most against its day price (photos preferred).
  const monthlyPick = market.vehicles
    .filter((vehicle) => vehicle.dailyRate > 0 && vehicle.monthlyRate > 0 && vehicle.monthlyRate / 30 < vehicle.dailyRate)
    .sort((a, b) => Number(realPhoto(b)) - Number(realPhoto(a)) || 1 - b.monthlyRate / 30 / b.dailyRate - (1 - a.monthlyRate / 30 / a.dailyRate))[0];
  const destinationsHref = roveHref("/destinations", roveHasLocale("destinations", locale) ? locale : "en");
  const searchHref = roveHref("/search", locale);

  return (
    <>
      {places.some((row) => row.count > 0) ? <JsonLd data={itemListLd(t("rv.placesTitle"), places.filter((row) => row.count > 0).map(({ destination }) => ({ name: destination.name, path: destinationPath(destination) })), "en")} /> : null}

      {/* The first screen: a real destination full-bleed, the promise in one line, and the search ready to use. */}
      <section className={s.heroFull}>
        {heroPlace ? <PlaceArt destination={heroPlace} eager sizes="100vw" /> : null}
        <div className={`${s.wrap} ${s.heroInner}`}>
          <div className={s.heroCopy}>
            <h1 className={s.heroTitle}>{t("rv.heroTitle2")}</h1>
            <p className={s.heroUsp}>{t("rv.heroUsp")}</p>
          </div>
          {heroVehicle ? (
            // A real listing, live: on wide screens only (the phone's first screen is for the search).
            <a className={s.heroListing} href={roveHref(`/vehicles/${heroVehicle.id}`, locale)}>
              <span className={s.heroListingPhoto}>
                <VehiclePhoto label={vehicleTitle(heroVehicle, t)} sizes="(min-width: 1100px) 340px, 1px" vehicle={heroVehicle} />
              </span>
              <span className={s.heroListingBody}>
                <OperatorMark logoUrl={heroVehicle.business.logoUrl} name={heroVehicle.business.name} />
                <span className={s.heroListingText}>
                  <span className={s.heroListingName}>{vehicleTitle(heroVehicle, t)}</span>
                  <span className={s.heroListingMeta}>{t("rv.fromBusiness", { business: heroVehicle.business.name, town: heroVehicle.business.town || heroVehicle.business.region })}</span>
                </span>
                <span className={s.heroListingPrice}>
                  {heroVehicle.dailyRate > 0 ? money(heroVehicle, heroVehicle.dailyRate) : money(heroVehicle, heroVehicle.monthlyRate)}
                  <small>{heroVehicle.dailyRate > 0 ? t("per_daily") : t("per_monthly")}</small>
                </span>
              </span>
            </a>
          ) : null}
          <div className={s.heroSearch}>
            <SearchForm action={searchHref} initial={{ place: "", lat: null, lng: null, from: "", to: "", kind: "", monthly: false }} today="" variant="hero" words={words} />
          </div>
          <ul className={s.heroChips}>
            {CHIPS.map(([key, icon]) => (
              <li key={key}>
                <Icon name={icon} />
                {t(`rv.${key}`)}
              </li>
            ))}
          </ul>
        </div>
        {heroPlace ? <PlaceCredit slug={heroPlace.slug} /> : null}
      </section>

      <section className={s.sectionKinds}>
        <div className={s.wrap}>
          <nav aria-label={t("rv.typesTitle")} className={s.kinds}>
            {TYPES.map((type) => (
              <a className={s.kind} href={`${searchHref}?${type.query}`} key={type.key}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt={type.alt} loading="lazy" sizes="(min-width: 900px) 290px, 46vw" src={`/site/vehicles/${type.photo}-thumb.webp`} srcSet={`/site/vehicles/${type.photo}-thumb.webp 400w, /site/vehicles/${type.photo}.webp 1200w`} />
                <span className={s.kindLabel}>
                  {t(`rv.type${type.key}`)}
                  <Icon name="arrow-right" />
                </span>
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
              <a className={s.textLink} href={searchHref}>
                {t("rv.seeAllVehicles")}
                <Icon name="arrow-right" />
              </a>
            </div>
            <div className={`${s.tiles} ${s.tilesScroll} ${s.tilesHome}`}>
              {featured.map((row) => (
                <VehicleCard delivers={Boolean(reachFrom(row.vehicle, null)?.delivers)} freeFrom={row.next} key={row.vehicle.id} km={null} layout="grid" locale={locale} quote={row.quote} stay={{ mode: "any", start: today }} vehicle={row.vehicle} />
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* Why Rove: the promises as tiles, not paragraphs. Long stays lead, with a real listing's day and month prices. */}
      <section className={`${s.section} ${s.sectionWhite}`}>
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>{t("rv.valueTitle")}</h2>
          </div>
          <div className={s.bento}>
            <div className={s.bentoMonthly}>
              <div className={s.bentoMonthlyCopy}>
                <span aria-hidden="true" className={s.featIcon}>
                  <Icon name="calendar-repeat" />
                </span>
                <h3 className={s.bentoTitle}>{t("rv.featMonthlyTitle")}</h3>
                <p className={s.bentoBody}>{t("rv.featMonthlyBody")}</p>
                <a className={s.btnCoral} href={`${searchHref}?monthly=1`}>
                  {t("rv.monthlyCta")}
                </a>
              </div>
              {monthlyPick ? (
                <a className={s.rateCard} href={roveHref(`/vehicles/${monthlyPick.id}`, locale)}>
                  {/* Only a real photo here; a drawn picture adds nothing to the two prices. */}
                  {realPhoto(monthlyPick) ? (
                    <span className={s.rateCardPhoto}>
                      <VehiclePhoto label={vehicleTitle(monthlyPick, t)} sizes="(min-width: 960px) 420px, 92vw" vehicle={monthlyPick} />
                    </span>
                  ) : null}
                  <span className={s.rateCardBody}>
                    <span className={s.rateCardName}>{vehicleTitle(monthlyPick, t)}</span>
                    <span className={s.rateCardOp}>{t("rv.fromBusiness", { business: monthlyPick.business.name, town: monthlyPick.business.town || monthlyPick.business.region })}</span>
                    <span className={s.rateRows}>
                      <span className={s.rateCell}>
                        <span className={s.rateCellLabel}>{t("rv.rateDay")}</span>
                        <span className={s.rateCellValue}>{money(monthlyPick, monthlyPick.dailyRate)}</span>
                        {/* "Per day" is the label already: no "a day" under it as well (final pre-release test, 8 Nov 2026). */}
                      </span>
                      <span className={s.rateCellBest}>
                        <span className={s.rateCellLabel}>{t("rv.rateMonth")}</span>
                        <span className={s.rateCellValue}>{money(monthlyPick, monthlyPick.monthlyRate)}</span>
                        <span className={s.rateCellSub}>{t("rv.aboutPerDay", { amount: money(monthlyPick, monthlyPick.monthlyRate / 30) })}</span>
                      </span>
                    </span>
                    <span className={s.rateCardNote}>{t("rv.rateCardNote", { business: monthlyPick.business.name })}</span>
                  </span>
                </a>
              ) : null}
            </div>
            {FEATURES.map(([key, icon]) => (
              <div className={s.feat} key={key}>
                <span aria-hidden="true" className={s.featIcon}>
                  <Icon name={icon} />
                </span>
                <h3 className={s.featTitle}>{t(`rv.feat${key}Title`)}</h3>
                <p className={s.featBody}>{t(`rv.feat${key}Body`)}</p>
              </div>
            ))}
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
              <Icon name="arrow-right" />
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

      <section className={`${s.section} ${s.sectionNight}`}>
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>{t("howTitle")}</h2>
          </div>
          <ol className={s.steps}>
            {STEPS.map((icon, index) => (
              <li className={s.step} key={icon}>
                <span aria-hidden="true" className={s.stepVisual}>
                  <Icon name={icon} />
                  <span className={s.stepNum}>{index + 1}</span>
                </span>
                <span className={s.stepTitle}>{t(`step${index + 1}Title`)}</span>
                <span className={s.stepBody}>{t(`step${index + 1}Body`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={s.section}>
        <div className={s.wrap}>
          {reviews.count > 0 ? (
            <div className={s.reviewsBlock}>
              <div className={s.sectionHead}>
                <div>
                  <h2 className={s.sectionTitle}>{t("rv.reviewsTitle")}</h2>
                  <p className={s.reviewsScore}>
                    <Stars value={reviews.average} />
                    <span>{t("rv.reviewSummary", { average: reviews.average.toFixed(1), count: reviews.count })}</span>
                  </p>
                </div>
              </div>
              {reviews.reviews.length ? (
                <ul className={`${s.reviewRail} ${s.tilesScroll}`}>
                  {reviews.reviews.map((review) => (
                    <li className={s.reviewCard} key={review.id}>
                      <Stars value={review.rating} />
                      <span className={s.srOnly}>{t("rv.reviewStars", { rating: review.rating })}</span>
                      <blockquote className={s.reviewText}>{review.text}</blockquote>
                      <p className={s.reviewWho}>
                        <span className={s.reviewName}>{review.name}</span>
                        <span className={s.reviewMeta}>{t("rv.reviewRented", { business: review.business })}</span>
                        <time className={s.reviewMeta} dateTime={review.createdAt.slice(0, 10)}>
                          {roveDate(review.createdAt.slice(0, 10), locale)}
                        </time>
                      </p>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          <div className={s.trust}>
            <h2 className={s.sectionTitle}>{t("rv.trustTitle")}</h2>
            <ul className={s.trustList}>
              {TRUST.map(([key, icon]) => (
                <li key={key}>
                  <span aria-hidden="true" className={s.trustIcon}>
                    <Icon name={icon} />
                  </span>
                  <span>{t(`rv.trust${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className={`${s.section} ${s.sectionWhite}`}>
        <div className={s.wrap}>
          <div className={s.sectionHead}>
            <h2 className={s.sectionTitle}>{t("rv.beforeYouDrive")}</h2>
            <a className={s.textLink} href={roveHref("/guides", locale)}>
              {t("rv.allGuides")}
              <Icon name="arrow-right" />
            </a>
          </div>
          <ul className={s.guideList}>
            {localizedGuides(locale)
              .slice(0, 3)
              .map((guide) => (
                <li key={guide.slug}>
                  <a className={s.guideItem} href={roveHref(`/guides/${guide.slug}`, locale)} lang={guide.locale === locale ? undefined : guide.locale}>
                    <span aria-hidden="true" className={s.guideItemIcon}>
                      <Icon name="book-2" />
                    </span>
                    <span className={s.guideItemTitle}>{guide.title}</span>
                    <span className={s.guideItemBody}>{guide.standfirst}</span>
                  </a>
                </li>
              ))}
          </ul>

          <div className={s.operators}>
            <div>
              <h2 className={s.sectionTitle}>{t("rv.operatorsTitle")}</h2>
              <p className={s.sectionLede}>{t("rv.operatorsBody")}</p>
            </div>
            <div className={s.operatorsActions}>
              <a className={s.btnCoral} href={listFleetHref("list_your_fleet")}>
                {t("rv.listFleet")}
              </a>
              <a className={s.btnOnDark} href={listFleetHref("home_operators_band")}>
                {t("rv.operatorsMore")}
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
