/**
 * Finer vehicle filters for the partner search (7 Nov 2026), worked out from what vehicles already record in
 * vehicles.specifications: body_class / body_type (free text: "sedan", "Pick Up", "mpv"…), seating_capacity (or seats),
 * engine_cc and transmission ("AT", "MT", "Automatic"…). There is no fixed body-type list, so the car size is derived:
 * a pickup or truck body → Pickup; 7 or more seats (or an MPV/minivan body) → 7+ seats; SUV/crossover → SUV;
 * sedan/saloon → Sedan; hatchback/city/compact → Small car. A car with none of these recorded only shows under "Any size".
 * No server code: the browser uses the value lists too.
 */

export type CarSize = "small" | "sedan" | "suv" | "seven" | "pickup";
export const CAR_SIZES: CarSize[] = ["small", "sedan", "suv", "seven", "pickup"];

export type EngineBand = "upto125" | "mid" | "big";
export const ENGINE_BANDS: EngineBand[] = ["upto125", "mid", "big"];

export type Gearbox = "auto" | "manual";
export const GEARBOXES: Gearbox[] = ["auto", "manual"];

/** Kinds that have an engine size worth filtering on. */
export const ENGINE_KINDS = ["motorbike", "scooter"];

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});

export function seatsOf(specs: unknown): number | null {
  const raw = record(specs);
  const seats = Number(raw.seating_capacity || raw.seats || 0);
  return seats > 0 ? seats : null;
}

export function carSizeOf(specs: unknown): CarSize | null {
  const raw = record(specs);
  const body = `${raw.body_class || ""} ${raw.body_type || ""}`.toLowerCase();
  const seats = seatsOf(raw);
  if (/pick\s*-?\s*up|pickup|truck|ute\b/.test(body)) return "pickup";
  if ((seats !== null && seats >= 7) || /mpv|minivan|people carrier|7\s*-?\s*seat/.test(body)) return "seven";
  if (/suv|crossover|4x4|jeep|off.?road/.test(body)) return "suv";
  if (/sedan|saloon/.test(body)) return "sedan";
  if (/hatch|city|compact|mini|small|kei|eco/.test(body)) return "small";
  return null;
}

export function engineCcOf(specs: unknown): number | null {
  const cc = Number(record(specs).engine_cc || 0);
  return cc > 0 ? cc : null;
}

export function engineBandOf(specs: unknown): EngineBand | null {
  const cc = engineCcOf(specs);
  if (cc === null) return null;
  if (cc <= 125) return "upto125";
  if (cc < 400) return "mid";
  return "big";
}

/** Automatic or manual from the free-text gearbox. Scooters and e-bikes with nothing recorded count as automatic. */
export function gearboxOf(specs: unknown, kind?: string): Gearbox | null {
  const text = String(record(specs).transmission || "").trim().toLowerCase();
  if (/^a\/?t$|auto|cvt|dct|dsg|semi|e-?cvt|อัตโนมัติ/.test(text)) return "auto";
  if (/^m\/?t$|manual|stick|gear|ธรรมดา/.test(text)) return "manual";
  if (!text && (kind === "scooter" || kind === "ebike")) return "auto";
  return null;
}

export type VehicleFilter = { kind: string | null; size: CarSize | null; engine: EngineBand | null; gearbox: Gearbox | null };

/** Clean filter values from a request: anything unknown is ignored. */
export function cleanVehicleFilter(input: { kind?: unknown; size?: unknown; engine?: unknown; gearbox?: unknown }): VehicleFilter {
  const kind = String(input.kind || "").trim().slice(0, 20);
  return {
    kind: kind && kind !== "any" ? kind : null,
    size: CAR_SIZES.includes(input.size as CarSize) ? (input.size as CarSize) : null,
    engine: ENGINE_BANDS.includes(input.engine as EngineBand) ? (input.engine as EngineBand) : null,
    gearbox: GEARBOXES.includes(input.gearbox as Gearbox) ? (input.gearbox as Gearbox) : null
  };
}

/** Does a vehicle of this kind, with these specifications, pass the filter? Size only applies to cars, engine size to bikes. */
export function passesVehicleFilter(filter: VehicleFilter, kind: string, specs: unknown) {
  if (filter.kind && kind !== filter.kind) return false;
  if (filter.size && (kind !== "car" || carSizeOf(specs) !== filter.size)) return false;
  if (filter.engine && (!ENGINE_KINDS.includes(kind) || engineBandOf(specs) !== filter.engine)) return false;
  if (filter.gearbox && gearboxOf(specs, kind) !== filter.gearbox) return false;
  return true;
}
