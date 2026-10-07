/** Groups vehicles by type (cars, motorbikes, scooters…) so the fleet reads at a glance. */

export type VehicleKind = "car" | "van" | "motorbike" | "scooter" | "ebike" | "atv" | "other";

type Category = { id: string; code: string; name: string };

const ORDER: VehicleKind[] = ["car", "van", "motorbike", "scooter", "ebike", "atv", "other"];

const PLURAL: Record<VehicleKind, string> = {
  car: "Cars",
  van: "Vans",
  motorbike: "Motorbikes",
  scooter: "Scooters",
  ebike: "E-bikes",
  atv: "ATVs",
  other: "Other vehicles"
};

const SINGULAR: Record<VehicleKind, string> = {
  car: "Car",
  van: "Van",
  motorbike: "Motorbike",
  scooter: "Scooter",
  ebike: "E-bike",
  atv: "ATV",
  other: "Vehicle"
};

export function kindFromCategory(category?: Pick<Category, "code" | "name"> | null): VehicleKind {
  if (!category) return "other";
  const text = `${category.code} ${category.name}`.toLowerCase();
  if (/e-?bike|electric bi/.test(text)) return "ebike";
  if (/scooter/.test(text)) return "scooter";
  if (/motor|bike/.test(text)) return "motorbike";
  if (/\bvan\b|minibus|bus/.test(text)) return "van";
  if (/atv|quad/.test(text)) return "atv";
  if (/car|sedan|suv|pickup|truck/.test(text)) return "car";
  return "other";
}

export function kindLabel(kind: VehicleKind, count = 2) {
  return count === 1 ? SINGULAR[kind] : PLURAL[kind];
}

/** True for anything on two wheels, used for the "Cars / Bikes" split. */
export function isTwoWheeler(kind: VehicleKind) {
  return kind === "motorbike" || kind === "scooter" || kind === "ebike";
}

export type VehicleGroup<V> = { kind: VehicleKind; label: string; vehicles: V[]; out: number; free: number; other: number };

export function groupVehiclesByKind<V extends { categoryId?: string | null; status: string; freeUntil?: string | null }>(vehicles: V[], categories: Category[]): VehicleGroup<V>[] {
  const byId = new Map(categories.map((category) => [category.id, category]));
  const buckets = new Map<VehicleKind, V[]>();
  for (const vehicle of vehicles) {
    const kind = kindFromCategory(vehicle.categoryId ? byId.get(vehicle.categoryId) : null);
    buckets.set(kind, [...(buckets.get(kind) || []), vehicle]);
  }
  return ORDER.filter((kind) => buckets.has(kind)).map((kind) => {
    const list = buckets.get(kind) || [];
    const out = list.filter((vehicle) => vehicle.status === "Rented").length;
    const free = list.filter((vehicle) => vehicle.status === "Available" || Boolean(vehicle.freeUntil)).length;
    return { kind, label: PLURAL[kind], vehicles: list, out, free, other: list.length - out - free };
  });
}
