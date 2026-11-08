import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { distanceKm } from "@/lib/place-coords";
import { DESTINATIONS, destinationPath } from "@/lib/rove/destinations";
import { loadMarket, roveToday, searchMarket, type SearchSort } from "@/lib/rove/market";
import { roveHref } from "@/lib/rove/paths";
import { parseRoveQuery, type RoveQuery } from "@/lib/rove/query";
import { itemListLd, roveMetadata } from "@/lib/rove/seo";
import { roveDate, roveLocale } from "@/lib/rove/static";
import { CAR_SIZES, GEARBOXES } from "@/lib/vehicle-filters";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { FiltersDisclosure } from "../_components/filters-disclosure";
import { JsonLd } from "../_components/json-ld";
import { SearchForm } from "../_components/search-form";
import { VehicleCard } from "../_components/vehicle-card";
import { searchWords } from "../_components/words";
import s from "../rove.module.css";

// Live availability and prices for the dates asked: drawn for each search.
export const dynamic = "force-dynamic";

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<RoveQuery> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [locale, query] = await Promise.all([roveLocale(params), searchParams]);
  const t = await getTranslations("directory");
  // The place as the page shows it ("Koh Samui" for ?place=koh-samui).
  const place = parseRoveQuery(query, roveToday()).place.slice(0, 60);
  const title = place ? t("rv.searchTitlePlace", { place }) : t("rv.searchTitle");
  // Search results change with every query: followed, but not indexed (the destination pages are what's indexed).
  return roveMetadata({ title: `${title} | Rove`, description: t("rv.homeDescription2"), path: "/search", locale, section: "search", noindex: true, ogTitle: title });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const [locale, query] = await Promise.all([roveLocale(params), searchParams]);
  const t = await getTranslations("directory");
  const today = roveToday();
  const parsed = parseRoveQuery(query, today);
  const [results, words, market] = await Promise.all([
    searchMarket({
      point: parsed.point,
      within: parsed.within,
      stay: parsed.stay,
      filter: { kind: parsed.kind || null, size: parsed.size, engine: null, gearbox: parsed.gearbox },
      maxPerDay: parsed.max,
      deliveryOnly: parsed.delivery,
      sort: parsed.sort
    }),
    searchWords(),
    loadMarket()
  ]);
  // The budget is in the businesses' own currency; with no results yet there's none to name.
  const currency = results[0]?.vehicle.business.currency || "";
  const stay = parsed.stay;
  const where = parsed.place && !parsed.placeUnknown ? parsed.place : null;
  const heading = where ? t("rv.resultsIn", { place: where }) : t("rv.resultsAnywhere");
  const when =
    stay.mode === "dates"
      ? t("rv.whenDates", { from: roveDate(stay.start, locale), to: roveDate(stay.end, locale) })
      : stay.mode === "monthly"
        ? t("rv.whenMonthly", { from: roveDate(stay.start, locale) })
        : t("rv.whenAny");
  // Everything the search form sends, so the filters keep it (and the form keeps the filters).
  const base: Record<string, string> = {
    ...(parsed.place ? { place: parsed.place } : {}),
    ...(query.lat && query.lng && parsed.point ? { lat: String(parsed.point.lat), lng: String(parsed.point.lng) } : {}),
    ...(stay.start !== today || stay.mode !== "any" ? { from: stay.start } : {}),
    ...(stay.mode === "dates" ? { to: stay.end } : {}),
    ...(stay.mode === "monthly" ? { monthly: "1" } : {}),
    ...(parsed.kind ? { kind: parsed.kind } : {})
  };
  const filterOnly: Record<string, string> = {
    ...(parsed.size ? { size: parsed.size } : {}),
    ...(parsed.gearbox ? { gearbox: parsed.gearbox } : {}),
    ...(parsed.max ? { max: String(parsed.max) } : {}),
    ...(parsed.delivery ? { delivery: "1" } : {})
  };
  const sortHidden: Record<string, string> = parsed.sort !== "price" ? { sort: parsed.sort } : {};
  const action = roveHref("/search", locale);
  const href = (values: Record<string, string>) => {
    const text = new URLSearchParams(values).toString();
    return text ? `${action}?${text}` : action;
  };
  const sorts: SearchSort[] = ["price", "price_desc", "deposit", ...(parsed.point ? (["nearest"] as SearchSort[]) : [])];
  const filtersOn = Object.keys(filterOnly).length;
  // When nothing matches: the places that do have vehicles right now.
  const livePlaces = results.length
    ? []
    : DESTINATIONS.map((destination) => ({ destination, count: market.vehicles.filter((vehicle) => vehicle.area && distanceKm(destination.center, vehicle.area) <= destination.radiusKm).length }))
        .filter((row) => row.count > 0)
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

  return (
    <div className={s.wrap}>
      <Breadcrumbs
        items={[
          { name: "Rove", path: "/" },
          { name: t("rv.searchTitle"), path: "/search" }
        ]}
        label={t("rv.breadcrumbs")}
        locale={locale}
      />
      <JsonLd data={itemListLd(heading, results.slice(0, 30).map((result) => ({ name: result.vehicle.name, path: `/vehicles/${result.vehicle.id}` })), locale)} />
      <header className={s.resultsHead}>
        <div>
          <h1 className={s.resultsTitle}>{heading}</h1>
          <p className={s.resultsWhen}>{when}</p>
        </div>
      </header>
      <SearchForm
        action={action}
        hidden={{ ...filterOnly, ...sortHidden }}
        initial={{ place: parsed.place, lat: query.lat && parsed.point ? parsed.point.lat : null, lng: query.lng && parsed.point ? parsed.point.lng : null, from: base.from || "", to: stay.mode === "dates" ? stay.end : "", kind: parsed.kind, monthly: stay.mode === "monthly" }}
        today={today}
        words={words}
      />
      {parsed.placeUnknown ? (
        <p className={s.hint}>
          <i aria-hidden="true" className="ti ti-info-circle" />
          {t("rv.placeUnknown", { place: parsed.place })}
        </p>
      ) : null}

      <div className={s.resultsLayout}>
        <FiltersDisclosure className={s.filters} summary={filtersOn ? `${t("rv.filters")} (${filtersOn})` : t("rv.filters")}>
          <form action={action} method="get">
            {Object.entries({ ...base, ...sortHidden }).map(([name, value]) => (
              <input key={name} name={name} type="hidden" value={value} />
            ))}
            {!parsed.kind || parsed.kind === "car" ? (
              <fieldset className={s.filterGroup}>
                <legend>{t("rv.carSize")}</legend>
                <div className={s.chipRow}>
                  {(["", ...CAR_SIZES] as string[]).map((size) => (
                    <label className={s.chip} key={size || "any"}>
                      <input defaultChecked={(parsed.size || "") === size} name="size" type="radio" value={size} />
                      <span>{size ? t(`rv.size_${size}`) : t("anyKind")}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            ) : null}
            <fieldset className={s.filterGroup}>
              <legend>{t("rv.gearbox")}</legend>
              <div className={s.chipRow}>
                {(["", ...GEARBOXES] as string[]).map((gearbox) => (
                  <label className={s.chip} key={gearbox || "any"}>
                    <input defaultChecked={(parsed.gearbox || "") === gearbox} name="gearbox" type="radio" value={gearbox} />
                    <span>{gearbox ? t(`rv.gearbox_${gearbox}`) : t("anyKind")}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset className={s.filterGroup}>
              <legend>{t("rv.budget")}</legend>
              <label className={s.field}>
                {currency ? t("rv.budgetLabel", { currency }) : t("rv.budgetLabelPlain")}
                <input className={s.input} defaultValue={parsed.max ? String(parsed.max) : ""} inputMode="numeric" min="0" name="max" placeholder={t("rv.budgetAny")} step="50" type="number" />
              </label>
            </fieldset>
            <fieldset className={s.filterGroup}>
              <legend>{t("rv.deliveryTitle")}</legend>
              <label className={s.check}>
                <input defaultChecked={parsed.delivery} name="delivery" type="checkbox" value="1" />
                {parsed.point ? t("rv.deliveryHereOnly") : t("rv.deliveryOnly")}
              </label>
            </fieldset>
            <div className={s.filterGroup} style={{ display: "grid", gap: 10 }}>
              <button className={s.btn} type="submit">
                {t("rv.applyFilters")}
              </button>
              {filtersOn ? (
                <a className={s.textLink} href={href({ ...base, ...sortHidden })} style={{ justifyContent: "center", fontSize: 14 }}>
                  {t("rv.clearFilters")}
                </a>
              ) : null}
            </div>
          </form>
        </FiltersDisclosure>

        <section aria-live="polite">
          <div className={s.resultsBar}>
            {results.length ? <p className={s.resultsCount}>{t("rv.resultsCount", { count: results.length })}</p> : null}
            {results.length > 1 ? (
              <nav aria-label={t("rv.sortLabel")} className={s.sortTabs}>
                {sorts.map((sort) => (
                  <a aria-current={parsed.sort === sort ? "true" : undefined} className={s.sortTab} href={href({ ...base, ...filterOnly, ...(sort !== "price" ? { sort } : {}) })} key={sort} rel="nofollow">
                    {t(`rv.sort_${sort}`)}
                  </a>
                ))}
              </nav>
            ) : null}
          </div>
          {stay.mode === "any" && results.length ? (
            <p className={s.hint}>
              <i aria-hidden="true" className="ti ti-calendar-event" />
              {t("rv.addDatesHint")}
            </p>
          ) : null}
          {results.length ? (
            <div className={s.resultList}>
              {results.map((result, index) => (
                <VehicleCard delivers={result.delivers} eager={index < 2} freeFrom={result.freeFrom} key={result.vehicle.id} km={result.km} locale={locale} quote={result.quote} stay={stay} vehicle={result.vehicle} />
              ))}
            </div>
          ) : (
            <div className={s.empty} style={{ marginTop: 0 }}>
              <span aria-hidden="true" className={s.emptyIcon}>
                <i className="ti ti-car-off" />
              </span>
              <h2 className={s.emptyTitle}>{t("noneTitle")}</h2>
              <p className={s.emptyBody}>{t("noneBody")}</p>
              <div className={s.emptyActions}>
                {stay.mode !== "monthly" ? (
                  <a className={s.btn} href={href({ ...Object.fromEntries(Object.entries(base).filter(([key]) => key !== "to")), monthly: "1" })}>
                    {t("rv.emptyMonthly")}
                  </a>
                ) : null}
                {parsed.place ? (
                  <a className={s.btnQuiet} href={href(Object.fromEntries(Object.entries(base).filter(([key]) => !["place", "lat", "lng"].includes(key))))}>
                    {t("rv.emptyAnywhere")}
                  </a>
                ) : null}
                {filtersOn ? (
                  <a className={s.btnQuiet} href={href(base)}>
                    {t("rv.clearFilters")}
                  </a>
                ) : null}
              </div>
              {livePlaces.length ? (
                <>
                  <p className={s.asideTitle} style={{ marginTop: 18 }}>
                    {t("rv.emptyPlacesTitle")}
                  </p>
                  <ul className={s.pillLinks}>
                    {livePlaces.map(({ destination, count }) => (
                      <li key={destination.slug}>
                        <a href={destinationPath(destination)}>
                          {destination.name} <span className={s.pillCount}>{count}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </div>
          )}
          <p className={s.disclaimer}>{t("footer")}</p>
        </section>
      </div>
    </div>
  );
}
