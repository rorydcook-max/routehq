"use client";

import { MapPin } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { searchPlaces, type PlacePoint } from "@/lib/place-coords";

export type PickedPlace = { name: string; region: string; lat: number; lng: number };

/**
 * A text field with town/area suggestions from the built-in places (lib/place-coords.ts). Picking one gives its
 * coordinates; typing again clears the pick until another is chosen. Keyboard: arrows, Enter, Escape.
 */
export function PlaceField({
  country,
  initial,
  onPick,
  placeholder,
  className = "mt-1 w-full",
  ariaLabel,
  inputId
}: {
  country?: string;
  initial?: PickedPlace | null;
  onPick: (place: PickedPlace | null, typed: string) => void;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  inputId?: string;
}) {
  const listId = useId();
  const [text, setText] = useState(initial?.name || "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const suggestions = useMemo(() => (open ? searchPlaces(text, { country, limit: 7 }) : []), [open, text, country]);

  function pick(place: PlacePoint) {
    setText(place.name);
    setOpen(false);
    onPick({ name: place.name, region: place.region, lat: place.lat, lng: place.lng }, place.name);
  }

  return (
    <div className="relative">
      <input
        aria-activedescendant={open && suggestions[active] ? `${listId}-${active}` : undefined}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-expanded={open && suggestions.length > 0}
        aria-label={ariaLabel}
        autoComplete="off"
        className={className}
        id={inputId}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onChange={(event) => {
          setText(event.target.value);
          setActive(0);
          setOpen(true);
          onPick(null, event.target.value);
        }}
        onFocus={() => text && setOpen(true)}
        onKeyDown={(event) => {
          if (!suggestions.length) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index - 1 + suggestions.length) % suggestions.length);
          } else if (event.key === "Enter" && open) {
            event.preventDefault();
            pick(suggestions[active] || suggestions[0]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        role="combobox"
        type="text"
        value={text}
      />
      {open && suggestions.length ? (
        <ul className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-[var(--border)] bg-[var(--panel)] py-1 shadow-lg" id={listId} role="listbox">
          {suggestions.map((place, index) => (
            <li
              aria-selected={index === active}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 ${index === active ? "bg-[var(--primary-light)]" : ""}`}
              id={`${listId}-${index}`}
              key={`${place.country}-${place.region}-${place.name}`}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(place);
              }}
              onMouseEnter={() => setActive(index)}
              role="option"
            >
              <MapPin aria-hidden="true" className="shrink-0 text-[var(--muted)]" size={15} />
              <span className="min-w-0">
                <span className="font-semibold text-[var(--foreground)]">{place.name}</span>
                <span className="text-sm text-[var(--muted)]">
                  {" · "}
                  {place.region}
                  {country && place.country !== country ? `, ${place.country}` : ""}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
