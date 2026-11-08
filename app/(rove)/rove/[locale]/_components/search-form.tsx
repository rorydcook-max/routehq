"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { PlaceField, type PickedPlace } from "@/components/place-field";
import s from "../rove.module.css";

export type SearchWords = {
  where: string;
  wherePlaceholder: string;
  from: string;
  to: string;
  kind: string;
  anyKind: string;
  monthly: string;
  search: string;
  kinds: Array<{ value: string; label: string }>;
};

export type SearchValues = { place: string; lat: number | null; lng: number | null; from: string; to: string; kind: string; monthly: boolean };

/**
 * The search: where (suggestions from the built-in places, lib/place-coords.ts), dates (or a monthly rental with no
 * end date) and the kind of vehicle. A plain GET form, so it works before the page's script has loaded too; extra
 * fields (the search page's filters) ride along as hidden inputs.
 */
export function SearchForm({ action, today, words, initial, hidden = {} }: { action: string; today: string; words: SearchWords; initial: SearchValues; hidden?: Record<string, string> }) {
  const [picked, setPicked] = useState<PickedPlace | null>(initial.place && initial.lat !== null && initial.lng !== null ? { name: initial.place, region: "", lat: initial.lat, lng: initial.lng } : null);
  const [typed, setTyped] = useState(initial.place);
  const [from, setFrom] = useState(initial.from);
  const [monthly, setMonthly] = useState(initial.monthly);

  return (
    <form action={action} className={s.searchPanel} method="get" role="search">
      <label className={s.field}>
        {words.where}
        <PlaceField
          ariaLabel={words.where}
          className={s.input}
          initial={initial.place ? { name: initial.place, region: "", lat: initial.lat ?? 0, lng: initial.lng ?? 0 } : null}
          onPick={(place, text) => {
            setPicked(place);
            setTyped(text);
          }}
          placeholder={words.wherePlaceholder}
        />
      </label>
      <input name="place" type="hidden" value={picked?.name || typed} />
      {picked ? (
        <>
          <input name="lat" type="hidden" value={String(picked.lat)} />
          <input name="lng" type="hidden" value={String(picked.lng)} />
        </>
      ) : null}
      <div className={s.inputRow}>
        <label className={s.field}>
          {words.from}
          <input className={s.input} min={today} name="from" onChange={(event) => setFrom(event.target.value)} type="date" value={from} />
        </label>
        <label className={s.field}>
          {words.to}
          <input className={s.input} defaultValue={initial.to} disabled={monthly} min={from || today} name="to" type="date" />
        </label>
      </div>
      <label className={s.field}>
        {words.kind}
        <select className={s.input} defaultValue={initial.kind} name="kind">
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
      <button className={`${s.button} ${s.searchButton}`} type="submit">
        <Search aria-hidden="true" size={18} />
        {words.search}
      </button>
      <label className={`${s.check} ${s.checkRow}`}>
        <input checked={monthly} name="monthly" onChange={(event) => setMonthly(event.target.checked)} type="checkbox" value="1" />
        {words.monthly}
      </label>
    </form>
  );
}
