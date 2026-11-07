import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { DESTINATIONS, destinationPath } from "@/lib/rove/destinations";
import { roveToday, searchMarket } from "@/lib/rove/market";
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
  const place = String(query.place || "").trim().slice(0, 60);
  const title = place ? t("rv.searchTitlePlace", { place }) : t("rv.searchTitle");
  // Search results change with every query: followed, but not indexed (the destination pages are what's indexed).
  return roveMetadata({ title: `${title} | Rove`, description: t("rv.homeDescription"), path: "/search", locale, section: "search", noindex: true, ogTitle: title });
}

export default async function SearchPage({ params, searchParams }: Props) {
  const [locale, query] = await Promise.all([roveLocale(params), searchParams]);
  const t = await getTranslations("directory");
  const today = roveToday();
  const parsed = parseRoveQuery(query, today);
  const [results, words] = await Promise.all([
    searchMarket({
      point: parsed.point,
      stay: parsed.stay,
      filter: { kind: parsed.kind || null, size: parsed.size, engine: null, gearbox: parsed.gearbox },
      maxPerDay: parsed.max,
      deliveryOnly: parsed.delivery,
      sort: parsed.sort
    }),
    searchWords()
  ]);
  const currency = results[0]?.vehicle.business.currency || "THB";
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
  const filterHidden: Record<string, string> = {
    ...(parsed.size ? { size: parsed.size } : {}),
    ...(parsed.gearbox ? { gearbox: parsed.gearbox } : {}),
    ...(parsed.max ? { max: String(parsed.max) } : {}),
    ...(parsed.delivery ? { delivery: "1" } : {}),
    ...(parsed.sort !== "price" ? { sort: parsed.sort } : {})
  };
  const action = roveHref("/search", locale);

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
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>{heading}</h1>
        <p className={s.pageLede}>{when}</p>
      </header>
      <div style={{ marginTop: 16 }}>
        <SearchForm
          action={action}
          hidden={filterHidden}
          initial={{ place: parsed.place, lat: query.lat && parsed.point ? parsed.point.lat : null, lng: query.lng && parsed.point ? parsed.point.lng : null, from: base.from || "", to: stay.mode === "dates" ? stay.end : "", kind: parsed.kind, monthly: stay.mode === "monthly" }}
          today={today}
          words={words}
        />
      </div>
      {parsed.placeUnknown ? <p className={`${s.small} ${s.muted}`} style={{ marginTop: 10 }}>{t("rv.placeUnknown", { place: parsed.place })}</p> : null}

      <div className={s.resultsLayout}>
        <FiltersDisclosure className={s.filters} summary={t("rv.filters")}>
        <form action={action} method="get">
          {Object.entries(base).map(([name, value]) => (
            <input key={name} name={name} type="hidden" value={value} />
          ))}
          <fieldset className={s.filterGroup}>
            <legend>{t("rv.sortBy")}</legend>
            <select className={s.input} defaultValue={parsed.sort} name="sort">
              <option value="price">{t("rv.sort_price")}</option>
              <option value="price_desc">{t("rv.sort_price_desc")}</option>
              <option value="deposit">{t("rv.sort_deposit")}</option>
              {parsed.point ? <option value="nearest">{t("rv.sort_nearest")}</option> : null}
            </select>
          </fieldset>
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
              {t("rv.budgetLabel", { currency })}
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
          <button className={s.button} style={{ width: "100%", marginTop: 16 }} type="submit">
            {t("rv.applyFilters")}
          </button>
          <p className={`${s.small} ${s.muted}`} style={{ marginTop: 10, marginBottom: 0 }}>
            <a href={`${action}?${new URLSearchParams(base).toString()}`}>{t("rv.clearFilters")}</a>
          </p>
        </form>
        </FiltersDisclosure>

        <section aria-live="polite">
          <div className={s.resultsBar}>
            <p style={{ margin: 0, fontWeight: 700 }}>{results.length ? t("rv.resultsCount", { count: results.length }) : t("noneTitle")}</p>
            {stay.mode === "any" && results.length ? <p className={`${s.small} ${s.muted}`} style={{ margin: 0 }}>{t("rv.addDatesHint")}</p> : null}
          </div>
          {results.length ? (
            <div className={s.resultList}>
              {results.map((result, index) => (
                <VehicleCard delivers={result.delivers} eager={index < 2} freeFrom={result.freeFrom} key={result.vehicle.id} km={result.km} locale={locale} quote={result.quote} stay={stay} vehicle={result.vehicle} />
              ))}
            </div>
          ) : (
            <div className={s.empty} style={{ marginTop: 14 }}>
              <p style={{ margin: 0 }}>{t("noneBody")}</p>
              <p className={s.muted} style={{ marginTop: 12, marginBottom: 6 }}>
                {t("rv.browseDestinations")}
              </p>
              <ul className={s.chipRow} style={{ listStyle: "none", padding: 0, margin: 0 }}>
                {DESTINATIONS.map((destination) => (
                  <li key={destination.slug}>
                    <a className={s.badge} href={destinationPath(destination)} style={{ textDecoration: "none" }}>
                      {destination.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className={`${s.small} ${s.muted}`} style={{ marginTop: 18 }}>
            {t("footer")}
          </p>
        </section>
      </div>
    </div>
  );
}
