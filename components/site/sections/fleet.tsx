"use client";

import type { ReactNode } from "react";
import { VehicleArt } from "@/components/vehicle-art";
import { headlineRate } from "@/lib/rental-estimate";
import type { CatalogVehicle } from "@/lib/public-catalog";
import { useSite } from "../site-context";
import { imageTreatment, SectionHead } from "./parts";
import s from "../site.module.css";

/** The vehicles shown: the owner's picks in their order, else up to six with photos first, then cheapest. */
export function featuredVehicles(vehicles: CatalogVehicle[], featured: string[]) {
  if (featured.length) return featured.map((id) => vehicles.find((vehicle) => vehicle.id === id)).filter(Boolean) as CatalogVehicle[];
  return [...vehicles].sort((a, b) => Number(Boolean(b.photoUrl)) - Number(Boolean(a.photoUrl))).slice(0, 6);
}

function usePrice() {
  const { money, t } = useSite();
  return (vehicle: CatalogVehicle) => {
    const rate = headlineRate(vehicle);
    return rate ? t(`fleet_from_${rate.per}`, { amount: money(rate.amount) }) : null;
  };
}

function Picture({ vehicle, className = "" }: { vehicle: CatalogVehicle; className?: string }) {
  return vehicle.photoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={vehicle.name} className={`absolute inset-0 h-full w-full object-cover ${className}`} decoding="async" height={900} loading="lazy" src={vehicle.photoUrl} width={1200} />
  ) : (
    <div className="absolute inset-0 flex items-center justify-center">
      <VehicleArt className="!h-full !w-full !rounded-none !bg-transparent" colour={vehicle.color} kind={vehicle.kind} model={vehicle.name} size="xl" />
    </div>
  );
}

/** Fleet highlights: a few vehicles with photos and "from" prices; Book opens that vehicle in the booking section. */
export function Fleet() {
  const { data, config, template, t, pickVehicle } = useSite();
  const price = usePrice();
  const vehicles = featuredVehicles(data.vehicles, config.featured);
  if (!vehicles.length) return null;
  const layout = template.layout.fleet;
  const details = (vehicle: CatalogVehicle) => [vehicle.year, ...vehicle.details].filter(Boolean).join(" · ");

  const book = (vehicle: CatalogVehicle, className: string) => (
    <button aria-label={`${t("fleet_book")}: ${vehicle.name}`} className={className} onClick={() => pickVehicle(vehicle.id)} type="button">
      {t("fleet_book")}
    </button>
  );

  return (
    <section aria-labelledby="fleet-title" className={`${s.section} ${layout === "grid" ? s.raised : ""}`} id="fleet">
      <div className={s.wrap}>
        <SectionHead id="fleet" title="fleet.title">
          <p className={`${s.muted} text-[15px] font-semibold`}>{t("fleet_count", { count: data.vehicles.length })}</p>
        </SectionHead>

        {layout === "list" ? (
          <FleetList book={book} details={details} price={price} vehicles={vehicles} />
        ) : layout === "spotlight" ? (
          <FleetSpotlight book={book} price={price} vehicles={vehicles} />
        ) : layout === "masonry" ? (
          <FleetMasonry book={book} details={details} price={price} vehicles={vehicles} />
        ) : layout === "rail" ? (
          // Coast: tall cards in a row that swipes on phones.
          <ul className={`${s.rail} mt-10`}>
            {vehicles.map((vehicle) => (
              <li className="flex flex-col" key={vehicle.id}>
                <div className={`${s.image} aspect-[4/5] bg-[var(--s-raised)]`}>
                  <Picture vehicle={vehicle} />
                </div>
                <h3 className={`${s.display} mt-5 text-[26px]`}>{vehicle.name}</h3>
                <p className={`${s.muted} mt-1 min-h-6 text-[15px]`}>{details(vehicle)}</p>
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-[17px] font-semibold">{price(vehicle)}</p>
                  {book(vehicle, `${s.focus} min-h-11 rounded-full px-4 text-[15px] font-semibold text-[var(--s-accent-text)] underline decoration-2 underline-offset-4`)}
                </div>
              </li>
            ))}
          </ul>
        ) : layout === "tiles" ? (
          // Moto: punchy tiles, the price as big as the name.
          <ul className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {vehicles.map((vehicle, index) => (
              <li className={`${s.card} flex flex-col overflow-hidden`} key={vehicle.id}>
                <div className={`relative aspect-square ${index % 2 ? "bg-[var(--s-raised)]" : "bg-[var(--s-accent-soft)]"}`}>
                  <Picture vehicle={vehicle} />
                </div>
                <div className="flex flex-1 flex-col p-4">
                  <h3 className={`${s.display} text-[22px] sm:text-[26px]`}>{vehicle.name}</h3>
                  <p className="mt-2 text-[16px] font-bold text-[var(--s-accent-text)]">{price(vehicle)}</p>
                  <div className="mt-auto pt-4">{book(vehicle, `${s.btn} !min-h-11 w-full !px-3 text-[15px]`)}</div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          // Summit: an even grid of clean cards with the specs as chips.
          <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {vehicles.map((vehicle) => (
              <li className={`${s.card} flex flex-col overflow-hidden shadow-[0_1px_2px_rgba(10,25,40,0.06),0_12px_32px_-20px_rgba(10,25,40,0.25)]`} key={vehicle.id}>
                <div className="relative aspect-[16/10] bg-[var(--s-raised)]">
                  <Picture vehicle={vehicle} />
                </div>
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="text-[19px] font-bold leading-tight">{vehicle.name}</h3>
                    {vehicle.year ? <span className={`${s.muted} text-[14px] font-semibold`}>{vehicle.year}</span> : null}
                  </div>
                  {vehicle.details.length ? (
                    <ul className="mt-3 flex flex-wrap gap-1.5">
                      {vehicle.details.map((detail) => (
                        <li className="rounded-full bg-[var(--s-raised)] px-2.5 py-1 text-[13px] font-semibold" key={detail}>
                          {detail}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <span aria-hidden="true" className="min-h-5 flex-1" />
                  <div className={`flex items-center justify-between gap-3 border-t pt-4 ${s.line}`}>
                    <p className="text-[16px] font-bold">{price(vehicle)}</p>
                    {book(vehicle, `${s.btn} !min-h-11 !px-5 text-[15px]`)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/* Phase 2 (sites2) layouts. */

type LayoutProps = {
  vehicles: CatalogVehicle[];
  price: (vehicle: CatalogVehicle) => string | null;
  book: (vehicle: CatalogVehicle, className: string) => ReactNode;
  details?: (vehicle: CatalogVehicle) => string;
};

const LINK_BOOK = `${s.focus} min-h-11 px-1 text-[15px] font-semibold text-[var(--s-accent-text)] underline decoration-2 underline-offset-4`;

/** Metro, Runway, Nomad, Washi, Fjord, Block: one row per vehicle with its specs, like a price list. */
function FleetList({ vehicles, price, book }: LayoutProps) {
  return (
    <ul className={`mt-10 divide-y border-y ${s.line} [&>li]:border-[var(--s-line)]`}>
      {vehicles.map((vehicle) => (
        <li className="grid grid-cols-[104px_1fr] items-center gap-x-4 gap-y-3 py-5 sm:grid-cols-[180px_1fr_auto] sm:gap-x-8" key={vehicle.id}>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[calc(var(--s-r-image)*0.6)] bg-[var(--s-raised)]">
            <Picture vehicle={vehicle} />
          </div>
          <div className="min-w-0">
            <h3 className={`${s.display} text-[22px] sm:text-[30px]`}>{vehicle.name}</h3>
            {[vehicle.year, ...vehicle.details].filter(Boolean).length ? (
              <ul className={`${s.muted} mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[15px] font-medium`}>
                {[vehicle.year, ...vehicle.details].filter(Boolean).map((detail) => (
                  <li key={String(detail)}>{detail}</li>
                ))}
              </ul>
            ) : null}
          </div>
          <div className="col-span-2 flex items-center justify-between gap-4 sm:col-span-1 sm:flex-col sm:items-end">
            <p className="text-[17px] font-bold">{price(vehicle)}</p>
            {book(vehicle, `${s.btn} !min-h-11 !px-5 text-[15px]`)}
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Noir, Villa, Riviera, Dolce, Roam: the first vehicle large, the rest in a row under it. */
function FleetSpotlight({ vehicles, price, book }: LayoutProps) {
  const { template, money, t } = useSite();
  const [first, ...rest] = vehicles;
  const treat = imageTreatment(template);
  return (
    <>
      <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1.45fr_1fr] lg:gap-14">
        <div className={`${s.image} ${template.image === "slant" ? "" : treat} aspect-[4/3] bg-[var(--s-raised)] sm:aspect-[16/10]`}>
          <Picture vehicle={first} />
        </div>
        <div>
          <h3 className={`${s.display} text-[36px] sm:text-[52px]`}>{first.name}</h3>
          <ul className={`mt-6 divide-y border-y text-[16px] ${s.line} [&>li]:border-[var(--s-line)]`}>
            {(
              [first.year ? { k: t("spec_year"), v: String(first.year) } : null, ...first.details.slice(0, 4).map((detail) => ({ k: "", v: detail })), first.deposit > 0 ? { k: t("spec_deposit"), v: money(first.deposit) } : null].filter(Boolean) as Array<{ k: string; v: string }>
            ).map((row, index) => (
              <li className="flex justify-between gap-6 py-3" key={index}>
                {row.k ? <span className={s.muted}>{row.k}</span> : null}
                <span className="font-semibold">{row.v}</span>
              </li>
            ))}
          </ul>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
            <p className={`${s.display} text-[26px]`}>{price(first)}</p>
            {book(first, `${s.btn}`)}
          </div>
        </div>
      </div>
      {rest.length ? (
        <ul className="mt-12 grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 lg:grid-cols-4">
          {rest.map((vehicle) => (
            <li className="flex flex-col" key={vehicle.id}>
              <div className={`${s.image} aspect-[4/3] bg-[var(--s-raised)]`}>
                <Picture vehicle={vehicle} />
              </div>
              <h3 className="mt-3 text-[17px] font-bold leading-tight">{vehicle.name}</h3>
              <p className={`${s.muted} mt-1 text-[15px]`}>{price(vehicle)}</p>
              <div className="mt-1">{book(vehicle, LINK_BOOK)}</div>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

const MASONRY_SHAPES = ["aspect-[4/5]", "aspect-square", "aspect-[4/3]", "aspect-[3/4]", "aspect-[5/4]", "aspect-[4/5]"];

/** Lagoon, Folio, Amber: columns of pictures in different shapes, like a magazine spread. */
function FleetMasonry({ vehicles, price, book, details }: LayoutProps) {
  const { template } = useSite();
  const treat = template.image === "frame" ? s.frame : "";
  return (
    <ul className={`${s.masonry} mt-10`}>
      {vehicles.map((vehicle, index) => (
        <li key={vehicle.id}>
          <div className={`${s.image} ${treat} ${MASONRY_SHAPES[index % MASONRY_SHAPES.length]} bg-[var(--s-raised)]`}>
            <Picture vehicle={vehicle} />
          </div>
          <h3 className={`${s.display} mt-4 text-[22px] sm:text-[28px]`}>{vehicle.name}</h3>
          {details?.(vehicle) ? <p className={`${s.muted} mt-1 text-[14.5px]`}>{details(vehicle)}</p> : null}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3">
            <p className="text-[16px] font-semibold">{price(vehicle)}</p>
            {book(vehicle, LINK_BOOK)}
          </div>
        </li>
      ))}
    </ul>
  );
}
