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
import { roveDate, roveLocale, roveMoney } from "@/lib/rove/static";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { JsonLd } from "../../_components/json-ld";
import { bookingHref, VehiclePhoto } from "../../_components/vehicle-card";
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
  const image = vehicle.photoCount ? `${roveOrigin()}/api/rove-photo/${vehicle.id}/0` : null;
  return roveMetadata({ title: `${title} | Rove`, description, path: `/vehicles/${vehicle.id}`, locale, section: "vehicle", image, ogTitle: title });
}

export default async function VehiclePage({ params, searchParams }: Props) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const t = await getTranslations("directory");
  const vehicle = await findVehicle(id);
  if (!vehicle) notFound();
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
    ...(vehicle.photoCount ? { image: photos.map((index) => `${roveOrigin()}/api/rove-photo/${vehicle.id}/${index}`) } : {}),
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

  return (
    <div className={s.wrap}>
      <Breadcrumbs items={crumbs} label={t("rv.breadcrumbs")} locale={locale} />
      <JsonLd data={productLd} />
      <div className={s.vehicleLayout}>
        <div>
          <div className={s.gallery}>
            <div className={s.galleryMain} style={{ position: "relative" }}>
              <VehiclePhoto eager vehicle={vehicle} />
            </div>
            {photos.slice(1).map((index) => (
              <div className={s.galleryThumb} key={index}>
                <VehiclePhoto index={index} vehicle={vehicle} />
              </div>
            ))}
          </div>
          <h1 className={s.pageTitle} style={{ marginTop: 22 }}>
            {fullName}
          </h1>
          <p className={s.pageLede} style={{ fontSize: 17 }}>
            {t("rv.fromBusiness", { business: business.name, town: place })}
          </p>
          <dl className={s.specs}>
            {specs.map((spec) => (
              <div key={spec.label}>
                <dt>{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>

          <section className={s.sectionTight}>
            <h2 className={s.h3}>{t("rv.pricesTitle")}</h2>
            <table className={s.rateTable} style={{ marginTop: 10 }}>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.unit}>
                    <td>{rate.label}</td>
                    <td>{money(rate.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td>{t("rv.depositLabel")}</td>
                  <td>{vehicle.deposit > 0 ? money(vehicle.deposit) : t("noDeposit")}</td>
                </tr>
              </tbody>
            </table>
            {business.seasons.length ? <p className={`${s.small} ${s.muted}`}>{t("rv.seasonNote")}</p> : null}
          </section>

          <section className={s.sectionTight} style={{ paddingTop: 0 }}>
            <h2 className={s.h3}>{t("rv.includedTitle")}</h2>
            <ul className={s.list}>
              {publicDeliveryKm(vehicle.area) > 0 ? <li>{t("rv.includedDelivery", { km: Math.round(publicDeliveryKm(vehicle.area)), place })}</li> : <li>{t("rv.includedPickup", { place })}</li>}
              <li>{t("rv.includedDirect", { business: business.name })}</li>
              {/* Thailand's compulsory motor insurance: only for vehicles of a business in Thailand. */}
              {business.country.toLowerCase() === "thailand" ? <li>{t("rv.includedCmi", { business: business.name })}</li> : null}
            </ul>
            {extras.length ? (
              <>
                <h3 style={{ fontSize: 16, margin: "18px 0 0" }}>{t("rv.extrasTitle")}</h3>
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

          <section className={s.sectionTight} style={{ paddingTop: 0 }}>
            <h2 className={s.h3}>{t("rv.aboutBusiness", { business: business.name })}</h2>
            <div style={{ display: "flex", gap: 14, alignItems: "center", marginTop: 12 }}>
              {business.logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt={`${business.name} logo`} src={business.logoUrl} style={{ maxHeight: 48, maxWidth: 120, objectFit: "contain" }} />
              ) : null}
              <p style={{ margin: 0 }}>
                {t("rv.businessFacts", { town: place, count: fleetCount })}
                <br />
                <a href={`/${business.slug}`} style={{ fontWeight: 700 }}>
                  {t("allVehicles")}
                </a>
              </p>
            </div>
            {stats.count > 0 ? (
              <div style={{ marginTop: 18 }}>
                <p style={{ margin: 0, fontWeight: 700 }}>
                  <span aria-hidden="true" className={s.stars}>
                    {"★".repeat(Math.round(stats.average))}
                  </span>{" "}
                  {t("rv.reviewSummary", { average: stats.average.toFixed(1), count: stats.count })}
                </p>
                {reviews.map((review) => (
                  <div className={s.review} key={review.id}>
                    <p style={{ margin: 0, fontWeight: 700 }}>
                      <span className={s.stars}>{"★".repeat(review.rating)}</span> {review.name}
                    </p>
                    {review.text ? <p style={{ margin: "6px 0 0" }}>{review.text}</p> : null}
                    {review.reply ? <p className={`${s.small} ${s.muted}`} style={{ margin: "6px 0 0" }}>{t("rv.replyFrom", { business: business.name, reply: review.reply })}</p> : null}
                  </div>
                ))}
              </div>
            ) : null}
          </section>
        </div>

        <aside className={s.bookBox} aria-label={t("rv.bookBoxLabel")}>
          {quote ? (
            <div>
              <span className={s.price}>{quote.total !== null ? money(quote.total) : money(quote.rate)}</span>{" "}
              <span className={s.priceUnit}>{quote.total !== null ? t("rv.totalFor", { count: quote.days || 0 }) : t(`per_${quote.model}`)}</span>
              <p className={`${s.small} ${s.muted}`} style={{ margin: "6px 0 0" }}>
                {stay.mode === "dates" ? t("rv.whenDates", { from: roveDate(stay.start, locale), to: roveDate(stay.end, locale) }) : t("rv.whenMonthly", { from: roveDate(stay.start, locale) })}
              </p>
            </div>
          ) : stay.mode !== "any" ? (
            <p style={{ margin: 0, fontWeight: 700 }}>{t("rv.notForDates")}</p>
          ) : (
            <div>
              <span className={s.price}>{money(rates[0]?.amount || 0)}</span> <span className={s.priceUnit}>{rates[0]?.unit === "DAY" ? t("per_daily") : rates[0]?.unit === "WEE" ? t("per_weekly") : t("per_monthly")}</span>
            </div>
          )}
          <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>
            {vehicle.deposit > 0 ? t("deposit", { amount: money(vehicle.deposit) }) : t("noDeposit")}
          </p>
          <form action={roveHref(path, locale)} method="get" style={{ display: "grid", gap: 10 }}>
            <div className={s.inputRow} style={{ display: "grid" }}>
              <label className={s.field}>
                {t("rv.pickUp")}
                <input className={s.input} defaultValue={stay.start} min={today} name="from" type="date" />
              </label>
              <label className={s.field}>
                {t("rv.dropOff")}
                <input className={s.input} defaultValue={stay.mode === "dates" ? stay.end : ""} min={today} name="to" type="date" />
              </label>
            </div>
            <button className={s.buttonGhost} type="submit">
              {t("rv.checkPrice")}
            </button>
          </form>
          <a className={s.button} href={bookingHref(vehicle, stay)}>
            {t("rv.bookWith", { business: business.name })}
          </a>
          <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>
            {t("rv.bookNote", { business: business.name })}
          </p>
        </aside>
      </div>
    </div>
  );
}
