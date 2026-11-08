import { preload } from "react-dom";
import { getTranslations } from "next-intl/server";
import { VehicleArt } from "@/components/vehicle-art";
import { AiImageLabel } from "@/components/ai-image-label";
import { photoProps, PHOTO_ROUTE } from "@/lib/photo-url";
import type { Quote, RoveVehicle, Stay } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { roveDate, roveMoney } from "@/lib/rove/static";
import { Icon, type IconName } from "./icon";
import s from "../rove.module.css";

/** The query a vehicle's own page and its booking link carry: the dates asked for. */
export function stayQuery(stay: Stay) {
  const query = new URLSearchParams();
  if (stay.mode === "dates") {
    query.set("from", stay.start);
    query.set("to", stay.end);
  } else if (stay.mode === "monthly") {
    query.set("from", stay.start);
    query.set("monthly", "1");
  }
  return query;
}

/**
 * The business's own booking page for this vehicle (rove.rent/<their-name>), with the dates, and tagged
 * via=directory so the booking shows in their RoveHQ as "came from rove.rent".
 */
export function bookingHref(vehicle: RoveVehicle, stay: Stay) {
  const query = new URLSearchParams({ vehicle: vehicle.id });
  if (stay.mode !== "any" || stay.start) query.set("from", stay.start);
  if (stay.mode === "dates") query.set("to", stay.end);
  // A monthly search opens the booking page on Monthly (rent/[slug]/page.tsx), not on set dates.
  if (stay.mode === "monthly") query.set("monthly", "1");
  query.set("via", "directory");
  return `/${vehicle.business.slug}?${query.toString()}`;
}

export function vehicleHref(vehicle: RoveVehicle, stay: Stay, locale: string) {
  const query = stayQuery(stay).toString();
  return `${roveHref(`/vehicles/${vehicle.id}`, locale)}${query ? `?${query}` : ""}`;
}

/** A listed vehicle's nth photo at its stable address (app/api/rove-photo), or null when it has none. */
export function vehiclePhotoUrl(vehicle: Pick<RoveVehicle, "id" | "photoCount"> & { photos?: string[] }, index = 0) {
  // The photo's own address (cached for a year, changes when the photo does); the nth-photo address as a fallback.
  return vehicle.photoCount > index ? vehicle.photos?.[index] || `${PHOTO_ROUTE}${vehicle.id}/${index}` : null;
}

/**
 * What a vehicle is called on Rove: make and model (with trim), else its kind ("Car", "Scooter") in the page's
 * language, so a card, link or photo never goes without a name.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function vehicleTitle(vehicle: Pick<RoveVehicle, "name" | "kind">, t: (key: any) => string) {
  return (vehicle.name || "").trim() || t(`kind_${vehicle.kind === "other" ? "car" : vehicle.kind}`);
}

export function VehiclePhoto({ vehicle, index = 0, eager = false, sizes = "(min-width: 960px) 360px, 100vw", aiLabel, label }: { vehicle: RoveVehicle; index?: number; eager?: boolean; sizes?: string; aiLabel?: string; label?: string }) {
  const url = vehiclePhotoUrl(vehicle, index);
  const name = (label || vehicle.name || "").trim();
  if (url) {
    // A stable address, resized to the slot (lib/photo-url.ts), so cached pages keep working and phones load less.
    // `aiLabel` (gallery.aiImage) marks a photo AI made (components/ai-image-label.tsx).
    const picture = photoProps(url, sizes);
    // The page's lead photo is its largest paint: asked for from the <head>, before the stylesheets and fonts.
    if (eager) preload(picture.src, { as: "image", fetchPriority: "high", ...("srcSet" in picture && picture.srcSet ? { imageSrcSet: picture.srcSet, imageSizes: sizes } : {}) });
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img alt={`${name}${vehicle.year ? ` ${vehicle.year}` : ""}`} decoding="async" fetchPriority={eager ? "high" : undefined} height={900} loading={eager ? "eager" : "lazy"} width={1200} {...picture} />
        {aiLabel ? <AiImageLabel label={aiLabel} show={vehicle.photoAi?.[index]} /> : null}
      </>
    );
  }
  return <VehicleArt className="!absolute !inset-0 !h-full !w-full !rounded-none" colour={vehicle.color || ""} kind={vehicle.kind as any} model={vehicle.name} size="xl" />;
}

/** The key facts as short icon-led items: kind, seats, gearbox, engine (two-wheelers), year. */
export async function vehicleFacts(vehicle: RoveVehicle) {
  const t = await getTranslations("directory");
  return [
    { icon: vehicle.kind === "car" || vehicle.kind === "van" || vehicle.kind === "other" ? "car" : "motorbike", text: t(`kind_${vehicle.kind === "other" ? "car" : vehicle.kind}`) },
    vehicle.seats ? { icon: "users", text: t("seats", { count: vehicle.seats }) } : null,
    vehicle.gearbox ? { icon: "manual-gearbox", text: t(`rv.gearbox_${vehicle.gearbox}`) } : null,
    vehicle.engineCc && vehicle.kind !== "car" ? { icon: "engine", text: `${vehicle.engineCc} cc` } : null,
    vehicle.year ? { icon: "calendar", text: String(vehicle.year) } : null
  ].filter(Boolean) as Array<{ icon: IconName; text: string }>;
}

/** The business as a small mark: its logo, else its initial. */
export function OperatorMark({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  return (
    <span aria-hidden="true" className={s.opMark}>
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" loading="lazy" src={logoUrl} />
      ) : (
        name.trim().charAt(0).toUpperCase()
      )}
    </span>
  );
}

export async function VehicleCard({
  vehicle,
  quote,
  delivers,
  km,
  freeFrom,
  stay,
  locale,
  eager = false,
  layout = "list"
}: {
  vehicle: RoveVehicle;
  quote: Quote;
  delivers: boolean;
  km: number | null;
  freeFrom: string | null;
  stay: Stay;
  locale: string;
  eager?: boolean;
  layout?: "list" | "grid";
}) {
  const t = await getTranslations("directory");
  const gallery = await getTranslations("gallery");
  const money = (value: number) => roveMoney(value, vehicle.business.currency, locale);
  const facts = await vehicleFacts(vehicle);
  const href = vehicleHref(vehicle, stay, locale);
  const title = vehicleTitle(vehicle, t);
  const town = vehicle.business.town || vehicle.business.region;
  // The headline price: the exact total for set dates, else the rate for the period asked (or the business's lead rate).
  const showTotal = quote.total !== null;
  const lead = showTotal ? money(quote.total as number) : money(quote.rate);
  const leadUnit = showTotal ? t("rv.totalFor", { count: quote.days || 0 }) : t(`per_${quote.model}`);
  // A second line: the monthly rate when the lead isn't monthly (long stays are Rove's thing), else the daily one.
  const second =
    quote.model !== "monthly" && vehicle.monthlyRate > 0
      ? t("rv.orMonthly", { amount: money(vehicle.monthlyRate) })
      : quote.model === "monthly" && vehicle.dailyRate > 0
        ? t("rv.orDaily", { amount: money(vehicle.dailyRate) })
        : null;

  return (
    <article className={layout === "grid" ? s.cardTile : s.card}>
      {/* A second way in for pointers, hidden from screen readers; named too, so a vehicle with no photo (drawn art)
          never leaves a bare link that tools read out as its address. */}
      <a aria-hidden="true" aria-label={title} className={s.cardPhoto} href={href} tabIndex={-1}>
        <VehiclePhoto aiLabel={gallery("aiImage")} eager={eager} label={title} sizes={layout === "grid" ? "(min-width: 1100px) 300px, (min-width: 640px) 45vw, 82vw" : "(min-width: 960px) 320px, (min-width: 640px) 40vw, 100vw"} vehicle={vehicle} />
        <span className={s.cardTags}>
          {delivers ? (
            <span className={s.tagDelivery}>
              <Icon name="truck-delivery" /> {km !== null ? t("rv.deliversHere") : t("rv.delivers")}
            </span>
          ) : null}
          {vehicle.monthlyRate > 0 ? <span className={s.tagMonthly}>{t("rv.monthlyTag")}</span> : null}
        </span>
      </a>
      <div className={s.cardBody}>
        <div className={s.cardMain}>
          <h3 className={s.cardTitle}>
            <a href={href}>
              {title}
              {vehicle.year ? <span className={s.cardYear}> {vehicle.year}</span> : null}
            </a>
          </h3>
          <ul className={s.facts}>
            {facts
              .filter((fact) => fact.text !== String(vehicle.year))
              .map((fact) => (
                <li key={fact.text}>
                  <Icon name={fact.icon} />
                  {fact.text}
                </li>
              ))}
          </ul>
          <p className={s.operator}>
            <OperatorMark logoUrl={vehicle.business.logoUrl} name={vehicle.business.name} />
            <span>
              <span className={s.operatorName}>{vehicle.business.name}</span>
              <span className={s.operatorTown}>
                {town}
                {km !== null ? ` ${t("rv.kmAway", { km: km < 1 ? "<1" : String(Math.round(km)) })}` : ""}
              </span>
            </span>
          </p>
          {freeFrom || quote.seasonal ? (
            <p className={s.cardNotes}>
              {freeFrom ? <span>{t("rv.freeFrom", { date: roveDate(freeFrom, locale) })}</span> : null}
              {quote.seasonal ? <span>{t("rv.seasonPrice")}</span> : null}
            </p>
          ) : null}
        </div>
        <div className={s.cardPrice}>
          <p className={s.priceLine}>
            <span className={s.price}>{lead}</span>
            <span className={s.priceUnit}>{leadUnit}</span>
          </p>
          {showTotal ? <p className={s.priceSub}>{t("rv.ratePer", { amount: money(quote.rate), per: t(`per_${quote.model}`) })}</p> : second ? <p className={s.priceSub}>{second}</p> : null}
          <p className={s.priceSub}>{vehicle.deposit > 0 ? t("deposit", { amount: money(vehicle.deposit) }) : t("noDeposit")}</p>
          <div className={s.cardActions}>
            <a className={s.btnQuiet} href={href}>
              {t("rv.viewDetails")}
            </a>
            <a className={s.btn} href={bookingHref(vehicle, stay)}>
              {t("book")}
            </a>
          </div>
        </div>
      </div>
    </article>
  );
}
