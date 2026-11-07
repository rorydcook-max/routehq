"use client";

import { VehicleArt } from "@/components/vehicle-art";
import { headlineRate } from "@/lib/rental-estimate";
import type { CatalogVehicle } from "@/lib/public-catalog";
import { useSite } from "../site-context";
import { SectionHead } from "./parts";
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

        {layout === "rail" ? (
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
                  {book(vehicle, `${s.focus} min-h-11 rounded-full px-4 text-[15px] font-semibold text-[var(--s-accent)] underline decoration-2 underline-offset-4`)}
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
                  <p className="mt-2 text-[16px] font-bold text-[var(--s-accent)]">{price(vehicle)}</p>
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
