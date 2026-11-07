/**
 * rove.rent's page addresses, just the names: kept apart from the content (lib/rove/destinations.ts, guides.ts) so
 * the proxy and the browser's analytics check (lib/analytics.ts) stay small. Add a destination or guide here AND in
 * its content file.
 */
export const GUIDE_SLUGS = ["renting-a-scooter-in-thailand", "international-driving-permit-thailand", "monthly-car-rental-thailand", "renting-a-scooter-in-bali"];

export const COUNTRY_SLUGS = ["thailand", "indonesia"];

/** "<country>/<place>" for every destination page. */
export const DESTINATION_KEYS = [
  "thailand/koh-samui",
  "thailand/koh-phangan",
  "thailand/phuket",
  "thailand/chiang-mai",
  "thailand/bangkok",
  "thailand/pattaya",
  "thailand/krabi",
  "indonesia/bali"
];
