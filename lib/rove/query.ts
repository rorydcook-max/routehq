import { findPlace, normalizePlace, searchPlaces, validPoint } from "@/lib/place-coords";
import { DESTINATIONS } from "@/lib/rove/destinations";
import type { SearchSort, Stay } from "@/lib/rove/market";
import { CAR_SIZES, GEARBOXES, type CarSize, type Gearbox } from "@/lib/vehicle-filters";

/** A rove.rent search address (?place=&lat=&lng=&from=&to=&monthly=&kind=&size=&gearbox=&max=&delivery=&sort=), read safely. */
export type RoveQuery = {
  place?: string;
  lat?: string;
  lng?: string;
  from?: string;
  to?: string;
  monthly?: string;
  kind?: string;
  size?: string;
  gearbox?: string;
  max?: string;
  delivery?: string;
  /** "1": only businesses that allow ride-hailing and delivery work (Settings › Rentals). */
  commercial?: string;
  sort?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["car", "scooter", "motorbike", "van", "atv", "ebike"];
const SORTS: SearchSort[] = ["price", "price_desc", "deposit", "nearest"];

export type ParsedQuery = {
  place: string;
  point: { lat: number; lng: number } | null;
  /** A whole destination was asked for: vehicles based anywhere in it. */
  within: { center: { lat: number; lng: number }; radiusKm: number } | null;
  /** A place was typed that isn't one we know: the search then covers everywhere. */
  placeUnknown: boolean;
  stay: Stay;
  kind: string;
  size: CarSize | null;
  gearbox: Gearbox | null;
  max: number | null;
  delivery: boolean;
  commercial: boolean;
  sort: SearchSort;
};

export function parseRoveQuery(query: RoveQuery, today: string): ParsedQuery {
  const place = String(query.place || "").trim().slice(0, 80);
  let point = validPoint(query.lat, query.lng);
  let placeUnknown = false;
  // One of Rove's destinations by name ("Crete", "Algarve", "Cancún"): the whole destination, whatever the
  // built-in places list knows.
  const wanted = normalizePlace(place);
  const destination = wanted
    ? DESTINATIONS.find((candidate) => [candidate.name, candidate.placeName, candidate.slug.replace(/-/g, " ")].some((name) => normalizePlace(name) === wanted)) || null
    : null;
  if (destination) point = destination.center;
  if (!point && place) {
    const known = findPlace(place) || searchPlaces(place, { limit: 1 })[0] || null;
    if (known) point = { lat: known.lat, lng: known.lng };
    else placeUnknown = true;
  }
  const from = ISO.test(String(query.from || "")) && String(query.from) >= today ? String(query.from) : today;
  const to = ISO.test(String(query.to || "")) && String(query.to) > from ? String(query.to) : "";
  const monthly = query.monthly === "1";
  const stay: Stay = to && !monthly ? { mode: "dates", start: from, end: to } : monthly ? { mode: "monthly", start: from } : { mode: "any", start: from };
  const kind = KINDS.includes(String(query.kind || "")) ? String(query.kind) : "";
  const max = Number(query.max);
  const sort = SORTS.includes(query.sort as SearchSort) ? (query.sort as SearchSort) : "price";
  return {
    // A destination asked for by its address form ("koh-samui") shows by its name ("Koh Samui"), not the raw slug.
    place: destination ? destination.name : place,
    point,
    within: destination ? { center: destination.center, radiusKm: destination.radiusKm } : null,
    placeUnknown,
    stay,
    kind,
    size: kind === "car" || !kind ? (CAR_SIZES.includes(query.size as CarSize) ? (query.size as CarSize) : null) : null,
    gearbox: GEARBOXES.includes(query.gearbox as Gearbox) ? (query.gearbox as Gearbox) : null,
    max: Number.isFinite(max) && max > 0 ? max : null,
    delivery: query.delivery === "1",
    commercial: query.commercial === "1",
    sort: sort === "nearest" && !point ? "price" : sort
  };
}
