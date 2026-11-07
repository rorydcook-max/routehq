"use client";

import dynamic from "next/dynamic";
import { Loader2, Search } from "lucide-react";
import { useState } from "react";
import { PlaceField } from "@/components/place-field";
import { findPlace, validPoint } from "@/lib/place-coords";
import { fromKm, toKm, type DistanceUnit } from "@/lib/regional";
import { DEFAULT_RADIUS_KM, type ServiceArea } from "@/lib/service-area";

type Say = (key: string, values?: Record<string, string | number>) => string;

// Leaflet only loads when a location is being edited: no weight on any other page.
const ServiceAreaMap = dynamic(() => import("@/components/service-area-map"), {
  ssr: false,
  loading: () => <div className="h-64 w-full animate-pulse rounded-xl bg-[var(--panel-secondary)] sm:h-72" />
});

const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/**
 * Where a location is and how far it delivers: type an area or address (or drag the pin), and a radius shown as a
 * circle. Posts latitude, longitude and serviceRadiusKm (always km) with the branch form.
 */
export function BranchServiceArea({
  initial,
  fallback,
  country,
  unit,
  say
}: {
  /** The branch as saved (absent for a new one). */
  initial?: { latitude: number | null; longitude: number | null; service_radius_km: number | null } | null;
  /** Where search places it today (its town when it has no pin), to start the map there. */
  fallback?: ServiceArea | null;
  country: string;
  unit: DistanceUnit;
  say: Say;
}) {
  const own = validPoint(initial?.latitude, initial?.longitude);
  const start = own || (fallback ? { lat: fallback.lat, lng: fallback.lng } : null) || countryCentre(country);
  const [point, setPoint] = useState<{ lat: number; lng: number }>(start);
  const [pinned, setPinned] = useState(Boolean(own));
  const savedKm = initial?.service_radius_km;
  const [radius, setRadius] = useState(savedKm === null || savedKm === undefined ? "" : String(Math.round(fromKm(Number(savedKm), unit) * 10) / 10));
  const [typed, setTyped] = useState("");
  const [finding, setFinding] = useState(false);
  const [findFailed, setFindFailed] = useState(false);
  const radiusKm = radius.trim() === "" ? DEFAULT_RADIUS_KM : Math.max(0, toKm(Number(radius) || 0, unit));

  function moveTo(lat: number, lng: number) {
    setPoint({ lat, lng });
    setPinned(true);
    setFindFailed(false);
  }

  // An address not in the built-in list: one lookup on OpenStreetMap's Nominatim, only when asked (its usage policy).
  async function findAddress() {
    const query = typed.trim();
    if (!query) return;
    setFinding(true);
    setFindFailed(false);
    try {
      const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(country ? `${query}, ${country}` : query)}`, {
        headers: { Accept: "application/json" }
      });
      const rows = (await response.json()) as Array<{ lat: string; lon: string }>;
      const hit = rows?.[0] ? validPoint(rows[0].lat, rows[0].lon) : null;
      if (hit) moveTo(hit.lat, hit.lng);
      else setFindFailed(true);
    } catch {
      setFindFailed(true);
    }
    setFinding(false);
  }

  return (
    <div className="space-y-3 sm:col-span-2">
      <input name="latitude" type="hidden" value={pinned ? point.lat.toFixed(6) : ""} />
      <input name="longitude" type="hidden" value={pinned ? point.lng.toFixed(6) : ""} />
      <input name="serviceRadiusKm" type="hidden" value={radius.trim() === "" ? "" : String(Math.round(radiusKm * 10) / 10)} />
      <div>
        <span className={labelClass}>{say("br_where")}</span>
        <div className="mt-1 flex gap-2">
          <div className="min-w-0 flex-1">
            <PlaceField
              ariaLabel={say("br_where")}
              className="w-full"
              country={country}
              onPick={(place, text) => {
                setTyped(text);
                if (place) moveTo(place.lat, place.lng);
              }}
              placeholder={say("br_wherePh")}
            />
          </div>
          <button className="secondary-action pressable shrink-0 px-4" disabled={finding || !typed.trim()} onClick={findAddress} type="button">
            {finding ? <Loader2 className="animate-spin" size={16} /> : <Search size={16} />}
            {say("br_find")}
          </button>
        </div>
        {findFailed ? <p className="mt-1 text-sm font-semibold text-[var(--danger)]">{say("br_findNone")}</p> : null}
      </div>
      <ServiceAreaMap label={say("br_mapLabel")} lat={point.lat} lng={point.lng} onMove={moveTo} radiusKm={radiusKm} />
      <label className="block">
        <span className={labelClass}>{say("br_radius")}</span>
        <span className="mt-1 flex items-center gap-2">
          <input
            className="w-28"
            inputMode="decimal"
            max={unit === "mi" ? 300 : 500}
            min={0}
            name="serviceRadiusShown"
            onChange={(event) => setRadius(event.target.value)}
            placeholder={String(Math.round(fromKm(DEFAULT_RADIUS_KM, unit)))}
            step="any"
            type="number"
            value={radius}
          />
          <span className="font-semibold text-[var(--foreground-secondary)]">{unit === "mi" ? say("br_unitMi") : say("br_unitKm")}</span>
        </span>
      </label>
    </div>
  );
}

/** Somewhere sensible to start the map when nothing else is known: the country's best-known place. */
function countryCentre(country: string) {
  const known: Record<string, string> = { Thailand: "Bangkok", "United Kingdom": "London", Spain: "Madrid", Greece: "Athens", "Türkiye": "Antalya" };
  const place = findPlace(known[country] || "", country);
  return place ? { lat: place.lat, lng: place.lng } : { lat: 13.7563, lng: 100.5018 };
}
