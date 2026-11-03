/**
 * Driving licence details European operators check (Rory, 3 Nov 2026).
 *
 * EU / UK licence categories (Directive 2006/126/EC, field 9 on the card): AM mopeds, A1 light motorbikes (125 cc),
 * A2 (35 kW), A any motorbike, B cars (with light trailer), BE car with trailer, then the larger vehicles.
 * Saved as text on customers.license_type ("A2, B"), the column the app already had for licence class.
 *
 * DVLA check code: a UK driver makes one at gov.uk/view-driving-licence ("Share your driving licence"); the rental
 * business uses it with the last 8 characters of the licence number to see points and entitlements. It lasts 21 days.
 */

export const LICENCE_CATEGORIES = ["AM", "A1", "A2", "A", "B", "BE", "C1", "C1E", "C", "CE", "D1", "D"] as const;
export type LicenceCategory = (typeof LICENCE_CATEGORIES)[number];

const KNOWN = new Set<string>(LICENCE_CATEGORIES);

/** "a2, B; be" or ["A2", "B"] -> ["A2", "B", "BE"], in the usual order, unknown ones left out. */
export function licenceCategoriesOf(value: unknown): LicenceCategory[] {
  const parts = (Array.isArray(value) ? value : String(value || "").split(/[\s,;/]+/))
    .map((part) => String(part || "").trim().toUpperCase())
    .filter((part) => KNOWN.has(part));
  return LICENCE_CATEGORIES.filter((category) => parts.includes(category));
}

/** The text saved: "A2, B". Empty when none. */
export function licenceCategoriesText(value: unknown): string {
  return licenceCategoriesOf(value).join(", ");
}

/** A DVLA check code as typed ("ab12 cd34" -> "AB12CD34"); 8 letters and digits, else empty. */
export function cleanDvlaCode(value: unknown): string {
  const code = String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
  return code.length === 8 ? code : "";
}
