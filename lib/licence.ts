/**
 * Driving licence details European operators check (Rory, 3 Nov 2026).
 *
 * EU / UK licence categories (Directive 2006/126/EC, field 9 on the card): AM mopeds, A1 light motorbikes (125 cc),
 * A2 (35 kW), A any motorbike, B cars (with light trailer), BE car with trailer, then the larger vehicles.
 * Saved as text on customers.license_type ("A2, B"), the column the app already had for licence class.
 *
 * DVLA check code: a UK driver makes one at gov.uk/view-driving-licence ("Share your driving licence"); the rental
 * business uses it with the last 8 characters of the licence number to see points and entitlements. It lasts 21 days.
 *
 * Türkiye (4 Nov 2026): Turkish licences use M for mopeds (the EU's AM) and B1 for four-wheeled motorcycles and quads
 * (ATVs), beside A1, A2, A, B and the rest (Highway Traffic Act 2918, art. 39). A B licence alone does not cover a
 * 125 cc motorbike in Türkiye: since 10 Feb 2024 (Karayolları Trafik Yönetmeliği art. 85, Resmî Gazete 32456) a
 * Turkish B holder of 2+ years may add A1 rights only after a course and a practical exam, recorded on the system.
 * A foreign licence may be used by a foreign visitor for up to 6 months from entry (Yönetmelik art. 88).
 */

export const LICENCE_CATEGORIES = ["AM", "A1", "A2", "A", "B", "BE", "C1", "C1E", "C", "CE", "D1", "D"] as const;
/** The categories offered for a business in Türkiye, in the order they are printed on a Turkish licence. */
export const TR_LICENCE_CATEGORIES = ["M", "A1", "A2", "A", "B1", "B", "BE", "C1", "C1E", "C", "CE", "D1", "D"] as const;
export type LicenceCategory = (typeof LICENCE_CATEGORIES)[number] | (typeof TR_LICENCE_CATEGORIES)[number];

/** Every known category in one order (EU AM and Turkish M are both mopeds, kept apart because the cards say so). */
const ORDER: readonly LicenceCategory[] = ["AM", "M", "A1", "A2", "A", "B1", "B", "BE", "C1", "C1E", "C", "CE", "D1", "D"];
const KNOWN = new Set<string>(ORDER);

/** The checkboxes to offer: Türkiye's categories for a business there, the EU/UK ones everywhere else. */
export function licenceCategoriesFor(countryCode: string | null | undefined): readonly LicenceCategory[] {
  return String(countryCode || "").toUpperCase() === "TR" ? TR_LICENCE_CATEGORIES : LICENCE_CATEGORIES;
}

/** "a2, B; be" or ["A2", "B"] -> ["A2", "B", "BE"], in the usual order, unknown ones left out. */
export function licenceCategoriesOf(value: unknown): LicenceCategory[] {
  const parts = (Array.isArray(value) ? value : String(value || "").split(/[\s,;/]+/))
    .map((part) => String(part || "").trim().toUpperCase())
    .filter((part) => KNOWN.has(part));
  return ORDER.filter((category) => parts.includes(category));
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

/** Türkiye: how long a foreign visitor may drive on their own licence, counted from the day they entered. */
export const TR_FOREIGN_LICENCE_MONTHS = 6;

/**
 * A Turkish identity number (T.C. Kimlik No) as typed, checked with its published checksum: 11 digits, not starting
 * with 0; digit 10 = ((d1+d3+d5+d7+d9)*7 - (d2+d4+d6+d8)) mod 10; digit 11 = (sum of the first ten) mod 10.
 * Empty when it isn't a valid number, so a typo is caught before it goes into a KABİS entry.
 */
export function cleanTcKimlikNo(value: unknown): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!/^[1-9]\d{10}$/.test(digits)) return "";
  const d = digits.split("").map(Number);
  const odd = d[0] + d[2] + d[4] + d[6] + d[8];
  const even = d[1] + d[3] + d[5] + d[7];
  const tenth = (((odd * 7 - even) % 10) + 10) % 10;
  const eleventh = d.slice(0, 10).reduce((sum, digit) => sum + digit, 0) % 10;
  return d[9] === tenth && d[10] === eleventh ? digits : "";
}
