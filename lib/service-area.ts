/**
 * Service area per branch (7 Nov 2026): where each location is (its map pin) and how far around it the business
 * delivers and collects (branches.service_radius_km; 0 = customers come to the branch). The partner search matches a
 * searched place against it; delivery can reuse it later. Not the travel rules ("how far customers may drive").
 *
 * A branch with no pin falls back to its town's centre (lib/place-coords.ts) and one with no radius set to
 * DEFAULT_RADIUS_KM, so every business can be found; Settings nudges the owner to set both. No server code here.
 */
import { findPlace, placeInText, validPoint, type PlacePoint } from "@/lib/place-coords";

/** Assumed delivery radius for a branch that hasn't set one. */
export const DEFAULT_RADIUS_KM = 10;
/** How far past the delivery area (or from a pickup-only branch) a customer is still shown it: a short trip to collect. */
export const PICKUP_REACH_KM = 5;

export type BranchRow = {
  id: string;
  name: string;
  address?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  service_radius_km?: number | string | null;
  is_active?: boolean | null;
};

export type ServiceArea = {
  branchId: string | null;
  name: string;
  lat: number;
  lng: number;
  radiusKm: number;
  /** The branch has its own pin (false: its town's centre is used). */
  pinned: boolean;
  /** The owner set the radius (false: DEFAULT_RADIUS_KM is assumed). */
  radiusSet: boolean;
};

/**
 * The delivery radius a business has actually promised, for anything a customer reads ("Delivers here", "Delivery
 * and collection within 10 km"): 0 (pickup only) when the owner hasn't set one. DEFAULT_RADIUS_KM is only for
 * matching distance, never a public claim.
 */
export function publicDeliveryKm(area: Pick<ServiceArea, "radiusKm" | "radiusSet"> | null | undefined): number {
  return area && area.radiusSet && area.radiusKm > 0 ? area.radiusKm : 0;
}

const record = (value: unknown): Record<string, any> => (value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, any>) : {});

/** The business's town from setup (settings.main_location), as a known place. */
export function mainTown(settings: unknown): PlacePoint | null {
  const main = record(record(settings).main_location);
  const country = String(main.country || "").trim() || undefined;
  return findPlace(String(main.town || main.label || ""), country, String(main.region || "")) || placeInText([main.label, main.town], country);
}

/**
 * Every location's service area, main location first (the first active branch, as everywhere else). A business with
 * no branches gets one area at its setup town. Locations that can't be placed at all are left out.
 */
export function serviceAreasFor(organization: { name?: string | null; settings?: unknown }, branches: BranchRow[]): ServiceArea[] {
  const settings = record(organization.settings);
  const country = String(record(settings.main_location).country || "").trim() || undefined;
  const town = mainTown(settings);
  const active = branches.filter((branch) => branch.is_active !== false);
  const list = active.length ? active : branches;
  if (!list.length) {
    return town ? [{ branchId: null, name: town.name, lat: town.lat, lng: town.lng, radiusKm: DEFAULT_RADIUS_KM, pinned: false, radiusSet: false }] : [];
  }
  const areas: ServiceArea[] = [];
  list.forEach((branch) => {
    const own = validPoint(branch.latitude, branch.longitude);
    // No pin: the place its name or address mentions (first one named), else the business's setup town.
    const guess = own ? null : placeInText([branch.name, branch.address], country) || town;
    const point = own || guess;
    if (!point) return;
    const radius = branch.service_radius_km === null || branch.service_radius_km === undefined || branch.service_radius_km === "" ? null : Number(branch.service_radius_km);
    const radiusSet = radius !== null && Number.isFinite(radius) && radius >= 0;
    areas.push({
      branchId: branch.id,
      name: branch.name,
      lat: point.lat,
      lng: point.lng,
      radiusKm: radiusSet ? (radius as number) : DEFAULT_RADIUS_KM,
      pinned: Boolean(own),
      radiusSet
    });
  });
  return areas;
}
