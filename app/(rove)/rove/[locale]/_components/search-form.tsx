"use client";

import { useState } from "react";
import { PlaceField, type PickedPlace } from "@/components/place-field";
import s from "../rove.module.css";

export type SearchWords = {
  where: string;
  wherePlaceholder: string;
  from: string;
  to: string;
  start: string;
  kind: string;
  anyKind: string;
  modeLabel: string;
  modeDates: string;
  modeMonthly: string;
  monthlyNote: string;
  search: string;
  kinds: Array<{ value: string; label: string }>;
};

export type SearchValues = { place: string; lat: number | null; lng: number | null; from: string; to: string; kind: string; monthly: boolean };

/**
 * The search: where (suggestions from the built-in places, lib/place-coords.ts), set dates or a monthly rental with
 * no end date, and the kind of vehicle. A plain GET form, so it works before the page's script has loaded too; extra
 * fields (the search page's filters) ride along as hidden inputs. "hero" is the home page's big panel, "bar" the
 * compact one at the top of results and destination pages.
 */
export function SearchForm({
  action,
  today,
  words,
  initial,
  hidden = {},
  variant = "bar"
}: {
  action: string;
  today: string;
  words: SearchWords;
  initial: SearchValues;
  hidden?: Record<string, string>;
  variant?: "hero" | "bar";
}) {
  const [picked, setPicked] = useState<PickedPlace | null>(initial.place && initial.lat !== null && initial.lng !== null ? { name: initial.place, region: "", lat: initial.lat, lng: initial.lng } : null);
  const [typed, setTyped] = useState(initial.place);
  const [from, setFrom] = useState(initial.from);
  const [monthly, setMonthly] = useState(initial.monthly);

  return (
    <form action={action} className={variant === "hero" ? s.searchHero : s.searchBar} method="get" role="search">
      <div aria-label={words.modeLabel} className={s.modeSwitch} role="radiogroup">
        <label className={s.modeOption}>
          <input checked={!monthly} name="mode" onChange={() => setMonthly(false)} type="radio" value="dates" />
          <span>
            <i aria-hidden="true" className="ti ti-calendar-event" />
            {words.modeDates}
          </span>
        </label>
        <label className={s.modeOption}>
          <input checked={monthly} name="mode" onChange={() => setMonthly(true)} type="radio" value="monthly" />
          <span>
            <i aria-hidden="true" className="ti ti-calendar-repeat" />
            {words.modeMonthly}
          </span>
        </label>
        {monthly ? <span className={s.modeNote}>{words.monthlyNote}</span> : null}
      </div>
      {monthly ? <input name="monthly" type="hidden" value="1" /> : null}
      <div className={monthly ? `${s.searchFields} ${s.searchFieldsMonthly}` : s.searchFields}>
        <label className={`${s.cell} ${s.cellWhere}`}>
          <span className={s.cellLabel}>{words.where}</span>
          <span className={s.cellControl}>
            <i aria-hidden="true" className={`ti ti-map-pin ${s.cellIcon}`} />
            <PlaceField
              ariaLabel={words.where}
              className={s.cellInput}
              initial={initial.place ? { name: initial.place, region: "", lat: initial.lat ?? 0, lng: initial.lng ?? 0 } : null}
              onPick={(place, text) => {
                setPicked(place);
                setTyped(text);
              }}
              placeholder={words.wherePlaceholder}
            />
          </span>
        </label>
        <input name="place" type="hidden" value={picked?.name || typed} />
        {picked ? (
          <>
            <input name="lat" type="hidden" value={String(picked.lat)} />
            <input name="lng" type="hidden" value={String(picked.lng)} />
          </>
        ) : null}
        <label className={s.cell}>
          <span className={s.cellLabel}>{monthly ? words.start : words.from}</span>
          <input className={s.cellInput} min={today || undefined} name="from" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        {monthly ? null : (
          <label className={s.cell}>
            <span className={s.cellLabel}>{words.to}</span>
            <input className={s.cellInput} defaultValue={initial.to} min={from || today || undefined} name="to" type="date" />
          </label>
        )}
        <label className={s.cell}>
          <span className={s.cellLabel}>{words.kind}</span>
          <select className={s.cellInput} defaultValue={initial.kind} name="kind">
            <option value="">{words.anyKind}</option>
            {[...words.kinds].sort((a, b) => a.label.localeCompare(b.label)).map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </label>
        {Object.entries(hidden).map(([name, value]) => (
          <input key={name} name={name} type="hidden" value={value} />
        ))}
        <button className={s.searchSubmit} type="submit">
          <i aria-hidden="true" className="ti ti-search" />
          <span>{words.search}</span>
        </button>
      </div>
    </form>
  );
}
