/**
 * rove.rent's page addresses, just the names: kept apart from the content (lib/rove/destinations.ts,
 * destinations-world.ts, guides.ts) so the proxy and the browser's analytics check (lib/analytics.ts) stay small.
 * Add a destination, country or guide here AND in its content file.
 */
export const GUIDE_SLUGS = [
  "do-i-need-an-international-driving-permit",
  "car-rental-insurance-explained",
  "renting-a-car-in-europe",
  "renting-a-scooter-in-greece",
  "renting-a-scooter-in-thailand",
  "international-driving-permit-thailand",
  "monthly-car-rental-thailand",
  "renting-a-scooter-in-bali"
];

export const COUNTRY_SLUGS = [
  "portugal",
  "spain",
  "greece",
  "italy",
  "croatia",
  "malta",
  "united-states",
  "mexico",
  "costa-rica",
  "japan",
  "new-zealand",
  "south-africa",
  "united-arab-emirates",
  "morocco",
  "thailand",
  "indonesia"
];

/** "<country>/<place>" for every destination page. */
export const DESTINATION_KEYS = [
  "portugal/algarve",
  "portugal/madeira",
  "spain/mallorca",
  "spain/tenerife",
  "greece/crete",
  "greece/santorini",
  "italy/sardinia",
  "italy/amalfi-coast",
  "croatia/split",
  "malta/malta-and-gozo",
  "united-states/maui",
  "united-states/miami-florida-keys",
  "mexico/cancun-riviera-maya",
  "costa-rica/guanacaste",
  "japan/okinawa",
  "new-zealand/queenstown",
  "south-africa/cape-town",
  "united-arab-emirates/dubai",
  "morocco/marrakech",
  "thailand/koh-samui",
  "thailand/koh-phangan",
  "thailand/phuket",
  "thailand/chiang-mai",
  "thailand/bangkok",
  "thailand/pattaya",
  "thailand/krabi",
  "indonesia/bali"
];
