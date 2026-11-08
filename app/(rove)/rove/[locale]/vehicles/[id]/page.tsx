import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { getPublishedReviews, getReviewStats } from "@/lib/reviews";
import { DESTINATIONS, destinationPath } from "@/lib/rove/destinations";
import { distanceKm } from "@/lib/place-coords";
import { publicDeliveryKm } from "@/lib/service-area";
import { extrasForVehicle, findVehicle, loadMarket, quoteFor, roveToday, type Stay } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { parseRoveQuery, type RoveQuery } from "@/lib/rove/query";
import { roveAbsolute, roveMetadata, roveOrigin } from "@/lib/rove/seo";
import { sizedPhoto } from "@/lib/photo-url";
import { roveDate, roveLocale, roveMoney } from "@/lib/rove/static";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { JsonLd } from "../../_components/json-ld";
import { bookingHref, OperatorMark, VehicleCard, vehicleFacts, VehiclePhoto } from "../../_components/vehicle-card";
import s from "../../rove.module.css";

// Availability and the price for the dates asked are live: drawn for each visit.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string; id: string }>; searchParams: Promise<RoveQuery> };

function destinationOf(vehicle: { area: { lat: number; lng: number } | null }) {
  if (!vehicle.area) return null;
  return DESTINATIONS.find((destination) => distanceKm(destination.center, vehicle.area as { lat: number; lng: number }) <= destination.radiusKm) || null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const t = await getTranslations("directory");
  const vehicle = await findVehicle(id);
  if (!vehicle) return { title: { absolute: "Rove" }, robots: { index: false, follow: true } };
  const place = vehicle.business.town || vehicle.business.region;
  const money = (value: number) => roveMoney(value, vehicle.business.currency, locale);
  const lead = vehicle.dailyRate > 0 ? t("rv.ratePer", { amount: money(vehicle.dailyRate), per: t("per_daily") }) : vehicle.monthlyRate > 0 ? t("rv.ratePer", { amount: money(vehicle.monthlyRate), per: t("per_monthly") }) : t("rv.ratePer", { amount: money(vehicle.weeklyRate), per: t("per_weekly") });
  const title = t("rv.vehicleTitle", { vehicle: `${vehicle.name}${vehicle.year ? ` ${vehicle.year}` : ""}`, place });
  const description = t("rv.vehicleDescription", { vehicle: vehicle.name, business: vehicle.business.name, place, price: lead });
  // The main photo's own stable address as a JPEG for link previews (some apps don't show WebP).
  const image = vehicle.photoCount ? `${roveOrigin()}${sizedPhoto(vehicle.photos?.[0] || `/api/rove-photo/${vehicle.id}/0`, 1280, "jpg")}` : null;
  return roveMetadata({ title: `${title} | Rove`, description, path: `/vehicles/${vehicle.id}`, locale, section: "vehicle", image, ogTitle: title });
}

export default async function VehiclePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const t = await getTranslations("directory");
  const vehicle = await findVehicle(id);
  if (!vehicle) notFound();
  const aiLabel = (await getTranslations("gallery"))("aiImage");
  const business = vehicle.business;
  const today = roveToday();
  const parsed = parseRoveQuery(query, today);
  const stay: Stay = parsed.stay;
  const quote = stay.mode === "any" ? null : quoteFor(vehicle, stay);
  const money = (value: number) => roveMoney(value, business.currency, locale);
  const [reviews, stats, market] = await Promise.all([getPublishedReviews(business.organizationId, 6), getReviewStats(business.organizationId), loadMarket()]);
  const fleetCount = market.vehicles.filter((other) => other.business.organizationId === business.organizationId).length;
  const destination = destinationOf(vehicle);
  const place = business.town || business.region;
  const fullName = `${vehicle.name}${vehicle.year ? ` ${vehicle.year}` : ""}`;
  const path = `/vehicles/${vehicle.id}`;

  const rates = [
    vehicle.dailyRate > 0 ? { label: t("rv.rateDay"), amount: vehicle.dailyRate, unit: "DAY" } : null,
    vehicle.weeklyRate > 0 ? { label: t("rv.rateWeek"), amount: vehicle.weeklyRate, unit: "WEE" } : null,
    vehicle.monthlyRate > 0 ? { label: t("rv.rateMonth"), amount: vehicle.monthlyRate, unit: "MON" } : null
  ].filter(Boolean) as Array<{ label: string; amount: number; unit: string }>;
  const specs = [
    { label: t("kind"), value: t(`kind_${vehicle.kind === "other" ? "car" : vehicle.kind}`) },
    vehicle.seats ? { label: t("rv.specSeats"), value: String(vehicle.seats) } : null,
    vehicle.gearbox ? { label: t("rv.gearbox"), value: t(`rv.gearbox_${vehicle.gearbox}`) } : null,
    vehicle.fuel ? { label: t("rv.specFuel"), value: vehicle.fuel.charAt(0).toUpperCase() + vehicle.fuel.slice(1) } : null,
    vehicle.engineCc ? { label: t("rv.specEngine"), value: `${vehicle.engineCc} cc` } : null,
    vehicle.year ? { label: t("rv.specYear"), value: String(vehicle.year) } : null,
    vehicle.color ? { label: t("rv.specColour"), value: vehicle.color } : null
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const photos = Array.from({ length: Math.min(vehicle.photoCount, 5) }, (_, index) => index);
  const extras = extrasForVehicle(vehicle);

  // Product with the business's real prices; the business (the seller) carries a rating only when it has published
  // reviews from real renters. Nothing is made up.
  const sellerLd: Record<string, unknown> = {
    "@type": "AutoRental",
    name: business.name,
    url: `${roveOrigin()}/${business.slug}`,
    ...(business.logoUrl ? { logo: business.logoUrl } : {}),
    address: { "@type": "PostalAddress", addressLocality: business.town || undefined, addressRegion: business.region || undefined, addressCountry: business.country || undefined },
    ...(stats.count > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stats.average, reviewCount: stats.count, bestRating: 5, worstRating: 1 } } : {})
  };
  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: fullName,
    description: t("rv.vehicleDescription", { vehicle: vehicle.name, business: business.name, place, price: rates[0] ? t("rv.ratePer", { amount: money(rates[0].amount), per: rates[0].unit === "DAY" ? t("per_daily") : rates[0].unit === "WEE" ? t("per_weekly") : t("per_monthly") }) : "" }),
    url: roveAbsolute(path, locale),
    ...(vehicle.photoCount ? { image: photos.map((index) => `${roveOrigin()}${sizedPhoto(vehicle.photos?.[index] || `/api/rove-photo/${vehicle.id}/${index}`, 1280, "jpg")}`) } : {}),
    category: t(`kind_${vehicle.kind === "other" ? "car" : vehicle.kind}`),
    offers: rates.map((rate) => ({
      "@type": "Offer",
      price: rate.amount,
      priceCurrency: business.currency,
      availability: "https://schema.org/InStock",
      url: `${roveOrigin()}${bookingHref(vehicle, { mode: "any", start: today })}`,
      priceSpecification: { "@type": "UnitPriceSpecification", price: rate.amount, priceCurrency: business.currency, unitCode: rate.unit, referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: rate.unit } },
      seller: sellerLd
    }))
  };

  const crumbs = [
    { name: "Rove", path: "/" },
    ...(destination ? [{ name: destination.name, path: destinationPath(destination) }] : []),
    { name: fullName, path }
  ];

  const facts = await vehicleFacts(vehicle);
  const deliveryKm = publicDeliveryKm(vehicle.area);
  const perOf = (unit: string) => (unit === "DAY" ? t("per_daily") : unit === "WEE" ? t("per_weekly") : t("per_monthly"));
  const headline = quote
    ? { amount: quote.total !== null ? quote.total : quote.rate, unit: quote.total !== null ? t("rv.totalFor", { count: quote.days || 0 }) : t(`per_${quote.model}`) }
    : rates[0]
      ? { amount: rates[0].amount, unit: perOf(rates[0].unit) }
      : null;
  const perDayOf = (rate: { amount: number; unit: string }) => (rate.unit === "WEE" ? rate.amount / 7 : rate.unit === "MON" ? rate.amount / 30 : rate.amount);
  const longStay = vehicle.dailyRate > 0 && vehicle.monthlyRate > 0 && vehicle.monthlyRate / 30 < vehicle.dailyRate;
  // The gallery: one big photo and up to four more (two or four, so the grid stays even); a swipeable row on phones.
  const shown = photos.length >= 5 ? photos.slice(0, 5) : photos.length >= 3 ? photos.slice(0, 3) : photos;
  const galleryClass = shown.length <= 1 ? `${s.gallery} ${s.galleryOne}` : shown.length === 2 ? `${s.gallery} ${s.galleryTwo}` : shown.length === 3 ? `${s.gallery} ${s.galleryThree}` : s.gallery;
  const stayAny: Stay = { mode: "any", start: today };
  const more = market.vehicles
    .filter((other) => other.business.organizationId === business.organizationId && other.id !== vehicle.id)
    .map((other) => ({ vehicle: other, quote: quoteFor(other, stayAny) }))
    .filter((row) => row.quote)
    .sort((a, b) => Number(b.vehicle.photoCount > 0) - Number(a.vehicle.photoCount > 0))
    .slice(0, 4);

  return (
    <div className={s.wrap}>
      <Breadcrumbs items={crumbs} label={t("rv.breadcrumbs")} locale={locale} />
      <JsonLd data={productLd} />
      <div className={galleryClass}>
        <div className={s.galleryMain}>
          <VehiclePhoto aiLabel={aiLabel} eager sizes="(min-width: 900px) 760px, 92vw" vehicle={vehicle} />
        </div>
        {shown.slice(1).map((index) => (
          <div className={s.galleryThumb} key={index}>
            <VehiclePhoto aiLabel={aiLabel} index={index} sizes="(min-width: 900px) 380px, 92vw" vehicle={vehicle} />
          </div>
        ))}
      </div>

      <div className={s.vehicleLayout}>
        <div>
          <h1 className={s.vehicleTitle}>
            {vehicle.name}
            {vehicle.year ? <span> {vehicle.year}</span> : null}
          </h1>
          <p className={s.operator} style={{ marginTop: 16 }}>
            <OperatorMark logoUrl={business.logoUrl} name={business.name} />
            <span>
              <span className={s.operatorName}>{business.name}</span>
              <span className={s.operatorTown}>{place}</span>
            </span>
          </p>
          <ul className={s.vehicleMeta}>
            {facts.map((fact) => (
              <li key={fact.text}>
                <i aria-hidden="true" className={`ti ${fact.icon}`} />
                {fact.text}
              </li>
            ))}
            {deliveryKm > 0 ? (
              <li>
                <i aria-hidden="true" className="ti ti-truck-delivery" />
                {t("rv.delivers")}
              </li>
            ) : null}
          </ul>

          <section className={s.block}>
            <h2 className={s.blockTitle}>{t("rv.pricesTitle")}</h2>
            <div className={s.rates}>
              {rates.map((rate) => (
                <div className={rate.unit === "MON" && longStay ? s.rateBest : s.rate} key={rate.unit}>
                  <span className={s.rateLabel}>{rate.label}</span>
                  <span className={s.rateValue}>{money(rate.amount)}</span>
                  <span className={s.rateSub}>{rate.unit === "DAY" ? perOf(rate.unit) : t("rv.aboutPerDay", { amount: money(perDayOf(rate)) })}</span>
                </div>
              ))}
            </div>
            <p className={s.priceSub} style={{ marginTop: 14 }}>
              {vehicle.deposit > 0 ? t("deposit", { amount: money(vehicle.deposit) }) : t("noDeposit")}
            </p>
            {business.seasons.length ? <p className={s.priceSub} style={{ marginTop: 6 }}>{t("rv.seasonNote")}</p> : null}
          </section>

          <section className={s.block}>
            <h2 className={s.blockTitle}>{t("rv.specsTitle")}</h2>
            <dl className={s.specs}>
              {specs.map((spec) => (
                <div key={spec.label}>
                  <dt>{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className={s.block}>
            <h2 className={s.blockTitle}>{t("rv.includedTitle")}</h2>
            <ul className={s.included}>
              {deliveryKm > 0 ? (
                <li>
                  <i aria-hidden="true" className="ti ti-truck-delivery" />
                  <span>{t("rv.includedDelivery", { km: Math.round(deliveryKm), place })}</span>
                </li>
              ) : (
                <li>
                  <i aria-hidden="true" className="ti ti-map-pin" />
                  <span>{t("rv.includedPickup", { place })}</span>
                </li>
              )}
              <li>
                <i aria-hidden="true" className="ti ti-message-circle" />
                <span>{t("rv.includedDirect", { business: business.name })}</span>
              </li>
              {/* Thailand's compulsory motor insurance: only for vehicles of a business in Thailand. */}
              {business.country.toLowerCase() === "thailand" ? (
                <li>
                  <i aria-hidden="true" className="ti ti-shield-check" />
                  <span>{t("rv.includedCmi", { business: business.name })}</span>
                </li>
              ) : null}
            </ul>
            {extras.length ? (
              <>
                <h3 style={{ fontSize: 16, fontWeight: 650, margin: "24px 0 0" }}>{t("rv.extrasTitle")}</h3>
                <ul className={s.list}>
                  {extras.map((extra) => (
                    <li key={extra.id}>
                      {extra.price > 0 ? t("rv.extraPriced", { name: extra.name, amount: money(extra.price), per: extra.per === "day" ? t("per_daily") : t("rv.perRental") }) : t("rv.extraFree", { name: extra.name })}
                    </li>
                  ))}
                </ul>
              </>
            ) : null}
          </section>

          <section className={s.block}>
            <h2 className={s.blockTitle}>{t("rv.aboutBusiness", { business: business.name })}</h2>
            <div className={s.business}>
              <OperatorMark logoUrl={business.logoUrl} name={business.name} />
              <div>
                <p className={s.businessName}>{business.name}</p>
                <p className={s.priceSub}>{t("rv.businessFacts", { town: place, count: fleetCount })}</p>
                <a className={s.textLink} href={`/${business.slug}`} style={{ fontSize: 14.5, marginTop: 4 }}>
                  {t("allVehicles")}
                </a>
              </div>
            </div>
            {stats.count > 0 ? (
              <div style={{ marginTop: 22 }}>
                <p style={{ margin: 0, fontWeight: 650 }}>
                  <span aria-hidden="true" className={s.stars}>
                    {"★".repeat(Math.round(stats.average))}
                  </span>{" "}
                  {t("rv.reviewSummary", { average: stats.average.toFixed(1), count: stats.count })}
                </p>
                {reviews.map((review) => (
                  <div className={s.review} key={review.id}>
                    <p style={{ margin: 0, fontWeight: 650 }}>
                      <span className={s.stars}>{"★".repeat(review.rating)}</span> {review.name}
                    </p>
                    {review.text ? <p style={{ margin: "6px 0 0" }}>{review.text}</p> : null}
                    {review.reply ? <p className={s.priceSub} style={{ margin: "6px 0 0" }}>{t("rv.replyFrom", { business: business.name, reply: review.reply })}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <aside aria-label={t("rv.bookBoxLabel")} className={s.bookBox}>
          {headline && (quote || stay.mode === "any") ? (
            <p className={s.bookPrice}>
              <span className={s.price}>{money(headline.amount)}</span>
              <span className={s.priceUnit}>{headline.unit}</span>
            </p>
          ) : null}
          {quote ? (
            <p className={s.priceSub} style={{ marginTop: -8 }}>
              {stay.mode === "dates" ? t("rv.whenDates", { from: roveDate(stay.start, locale), to: roveDate(stay.end, locale) }) : t("rv.whenMonthly", { from: roveDate(stay.start, locale) })}
            </p>
          ) : stay.mode !== "any" ? (
            <p style={{ margin: 0, fontWeight: 650 }}>{t("rv.notForDates")}</p>
          ) : null}
          <form action={roveHref(path, locale)} method="get" style={{ display: "grid", gap: 10 }}>
            <div className={s.bookDates}>
              <label className={s.cell}>
                <span className={s.cellLabel}>{t("rv.pickUp")}</span>
                <input className={s.cellInput} defaultValue={stay.start} min={today} name="from" type="date" />
              </label>
              <label className={s.cell}>
                <span className={s.cellLabel}>{t("rv.dropOff")}</span>
                <input className={s.cellInput} defaultValue={stay.mode === "dates" ? stay.end : ""} min={today} name="to" type="date" />
              </label>
            </div>
            <button className={s.btnQuiet} type="submit">
              {t("rv.checkPrice")}
            </button>
          </form>
          <a className={s.btnLarge} href={bookingHref(vehicle, stay)}>
            {t("rv.bookWith", { business: business.name })}
          </a>
          <dl className={s.bookRows}>
            <div>
              <dt>{t("rv.depositLabel")}</dt>
              <dd>{vehicle.deposit > 0 ? money(vehicle.deposit) : t("noDeposit")}</dd>
            </div>
            {vehicle.monthlyRate > 0 && quote?.model !== "monthly" ? (
              <div>
                <dt>{t("rv.rateMonth")}</dt>
                <dd>{money(vehicle.monthlyRate)}</dd>
              </div>
            ) : null}
            <div>
              <dt>{t("rv.deliveryTitle")}</dt>
              <dd>{deliveryKm > 0 ? t("rv.delivers") : t("rv.includedPickup", { place })}</dd>
            </div>
          </dl>
          <p className={s.bookNote}>{t("rv.bookNote", { business: business.name })}</p>
        </aside>
      </div>

      {more.length ? (
        <section className={s.block} style={{ marginTop: 40 }}>
          <h2 className={s.sectionTitle} style={{ fontSize: "clamp(1.6rem, 3vw, 2.2rem)", marginBottom: 24 }}>
            {t("rv.moreFrom", { business: business.name })}
          </h2>
          <div className={`${s.tiles} ${s.tilesScroll}`}>
            {more.map((row) => (
              <VehicleCard delivers={publicDeliveryKm(row.vehicle.area) > 0} freeFrom={null} key={row.vehicle.id} km={null} layout="grid" locale={locale} quote={row.quote!} stay={stayAny} vehicle={row.vehicle} />
            ))}
          </div>
        </section>
      ) : null}

      {headline ? (
        <>
          <div aria-hidden="true" className={s.mobileBarSpace} />
          <div className={s.mobileBar}>
            <p className={s.bookPrice} style={{ display: "grid", gap: 0 }}>
              <span className={s.price}>{money(headline.amount)}</span>
              <span className={s.priceUnit}>{headline.unit}</span>
            </p>
            <a className={s.btnLarge} href={bookingHref(vehicle, stay)}>
              {t("book")}
            </a>
          </div>
        </>
      ) : null}
    </div>
  );
}
