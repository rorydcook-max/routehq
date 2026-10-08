/**
 * How good a vehicle is, in the owner's words: set on the vehicle, and moved down
 * by itself when a return or condition report records new damage. It places the
 * vehicle's value within the range of used adverts for its model and year.
 */
export const CONDITIONS = ["new", "like_new", "great", "good", "fair", "poor"] as const;
export type Condition = (typeof CONDITIONS)[number];
export type ConditionRecord = { value: Condition; set_at: string; by: "owner" | "damage"; damage_on?: string };

export function asCondition(value: unknown): Condition | null {
  return CONDITIONS.includes(value as Condition) ? (value as Condition) : null;
}

/**
 * New damage moves the condition down. Scratches alone only take the shine off a
 * new or like-new vehicle; a dent, crack or missing part costs a whole step.
 * Unknown condition is taken as good.
 */
export function afterDamage(current: Condition | null, damage: Array<{ severity?: string }>): Condition | null {
  if (!damage.length) return null;
  const from = current || "good";
  const serious = damage.some((item) => String(item?.severity || "other") !== "scratch");
  const index = CONDITIONS.indexOf(from);
  const next = serious ? CONDITIONS[Math.min(CONDITIONS.length - 1, index + 1)] : index < CONDITIONS.indexOf("great") ? "great" : from;
  return next === from ? null : next;
}

/** Where in the advert range a vehicle in this condition sits: 0 is the lowest advert, 1 the highest. */
const PLACE: Record<Condition, number> = { new: 0.95, like_new: 0.8, great: 0.65, good: 0.5, fair: 0.25, poor: 0.05 };

export function valueForCondition(range: { low: number; typical: number; high: number }, condition: Condition | null) {
  if (!condition || condition === "good") return range.typical;
  const place = PLACE[condition];
  const value = place >= 0.5 ? range.typical + ((place - 0.5) / 0.5) * (range.high - range.typical) : range.low + (place / 0.5) * (range.typical - range.low);
  return Math.round(value / 1000) * 1000;
}
