import { getTranslations } from "next-intl/server";
import { VehicleArt } from "@/components/vehicle-art";
import type { Quote, RoveVehicle, Stay } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { roveDate, roveMoney } from "@/lib/rove/static";
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
  query.set("via", "directory");
  return `/${vehicle.business.slug}?${query.toString()}`;
}

export function vehicleHref(vehicle: RoveVehicle, stay: Stay, locale: string) {
  const query = stayQuery(stay).toString();
  return `${roveHref(`/vehicles/${vehicle.id}`, locale)}${query ? `?${query}` : ""}`;
}

export function VehiclePhoto({ vehicle, index = 0, eager = false }: { vehicle: RoveVehicle; index?: number; eager?: boolean }) {
  if (vehicle.photoCount > index) {
    // A stable address that always hands out a fresh signed link (app/api/rove-photo), so cached pages keep working.
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={`${vehicle.name}${vehicle.year ? ` ${vehicle.year}` : ""}`} decoding="async" loading={eager ? "eager" : "lazy"} src={`/api/rove-photo/${vehicle.id}/${index}`} />;
  }
  return <VehicleArt className="!absolute !inset-0 !h-full !w-full !rounded-none" colour={vehicle.color || ""} kind={vehicle.kind as any} model={vehicle.name} size="xl" />;
}

export async function VehicleCard({
  vehicle,
  quote,
  delivers,
  km,
  freeFrom,
  stay,
  locale,
  eager = false
}: {
  vehicle: RoveVehicle;
  quote: Quote;
  delivers: boolean;
  km: number | null;
  freeFrom: string | null;
  stay: Stay;
  locale: string;
  eager?: boolean;
}) {
  const t = await getTranslations("directory");
  const money = (value: number) => roveMoney(value, vehicle.business.currency, locale);
  const facts = [
    t(`kind_${vehicle.kind === "other" ? "car" : vehicle.kind}`),
    vehicle.seats ? t("seats", { count: vehicle.seats }) : null,
    vehicle.gearbox ? t(`rv.gearbox_${vehicle.gearbox}`) : null,
    vehicle.engineCc && vehicle.kind !== "car" ? `${vehicle.engineCc} cc` : null,
    vehicle.year ? String(vehicle.year) : null
  ].filter(Boolean) as string[];
  const href = vehicleHref(vehicle, stay, locale);
  return (
    <article className={s.result}>
      <a aria-hidden="true" className={s.resultPhoto} href={href} tabIndex={-1}>
        <VehiclePhoto eager={eager} vehicle={vehicle} />
      </a>
      <div className={s.resultBody}>
        <div>
          <h3 className={s.resultName}>
            <a href={href}>{vehicle.name}</a>
          </h3>
          <ul className={s.facts}>
            {facts.map((fact) => (
              <li key={fact}>{fact}</li>
            ))}
          </ul>
          <p className={s.operator}>
            {t("rv.fromBusiness", { business: vehicle.business.name, town: vehicle.business.town || vehicle.business.region })}
            {km !== null ? <span className={s.muted}> {t("rv.kmAway", { km: km < 1 ? "<1" : String(Math.round(km)) })}</span> : null}
          </p>
          <div className={s.badges}>
            {delivers ? (
              <span className={s.badgeDelivery}>
                <i aria-hidden="true" className="ti ti-truck-delivery" /> {km !== null ? t("rv.deliversHere") : t("rv.delivers")}
              </span>
            ) : null}
            {freeFrom ? <span className={s.badge}>{t("rv.freeFrom", { date: roveDate(freeFrom, locale) })}</span> : null}
            {quote.seasonal ? <span className={s.badge}>{t("rv.seasonPrice")}</span> : null}
          </div>
        </div>
        <div className={s.priceBox}>
          {quote.total !== null ? (
            <>
              <span className={s.price}>{money(quote.total)}</span>
              <span className={s.priceUnit}>{t("rv.totalFor", { count: quote.days || 0 })}</span>
              <span className={`${s.small} ${s.muted}`}>{t("rv.ratePer", { amount: money(quote.rate), per: t(`per_${quote.model}`) })}</span>
            </>
          ) : (
            <>
              <span className={s.price}>{money(quote.rate)}</span>
              <span className={s.priceUnit}>{t(`per_${quote.model}`)}</span>
            </>
          )}
          <span className={`${s.small} ${s.muted}`}>{vehicle.deposit > 0 ? t("deposit", { amount: money(vehicle.deposit) }) : t("noDeposit")}</span>
          <a className={s.button} href={bookingHref(vehicle, stay)}>
            {t("book")}
          </a>
        </div>
      </div>
    </article>
  );
}
