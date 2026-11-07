import { findPlace, searchPlaces, validPoint } from "@/lib/place-coords";
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
  sort?: string;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const KINDS = ["car", "scooter", "motorbike", "van", "atv", "ebike"];
const SORTS: SearchSort[] = ["price", "price_desc", "deposit", "nearest"];

export type ParsedQuery = {
  place: string;
  point: { lat: number; lng: number } | null;
  /** A place was typed that isn't one we know: the search then covers everywhere. */
  placeUnknown: boolean;
  stay: Stay;
  kind: string;
  size: CarSize | null;
  gearbox: Gearbox | null;
  max: number | null;
  delivery: boolean;
  sort: SearchSort;
};

export function parseRoveQuery(query: RoveQuery, today: string): ParsedQuery {
  const place = String(query.place || "").trim().slice(0, 80);
  let point = validPoint(query.lat, query.lng);
  let placeUnknown = false;
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
    place,
    point,
    placeUnknown,
    stay,
    kind,
    size: kind === "car" || !kind ? (CAR_SIZES.includes(query.size as CarSize) ? (query.size as CarSize) : null) : null,
    gearbox: GEARBOXES.includes(query.gearbox as Gearbox) ? (query.gearbox as Gearbox) : null,
    max: Number.isFinite(max) && max > 0 ? max : null,
    delivery: query.delivery === "1",
    sort: sort === "nearest" && !point ? "price" : sort
  };
}
