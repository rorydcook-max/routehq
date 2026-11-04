/**
 * Rental software operators move to RoveHQ from, for the importer's "Where is your data now?" step and the website's
 * switching pages. Plain names only (no logos or trademarks). How each one lets data out was researched in
 * November 2026: docs/competitor-exports.md has the sources. Safe in client and server code.
 *
 * - `help`: the software's own help article on exporting, when there is one.
 * - `steps`: keys in the "importer" namespace, shown in order (sw_generic_* take {name}).
 * - `dateOrder`: how its exports usually write 05/06/2026 when the file itself can't say (US tools: month first).
 * - `distance`: what its mileage columns are in when the heading doesn't say.
 * - `preset`: the importer recognises its export files by their headings and reads them without the AI.
 * - `slug`: its page on the website (/switch/<slug>).
 */
export type SoftwareId =
  | "anolla"
  | "anyrent"
  | "appointrent"
  | "booqable"
  | "carrentalsolutions"
  | "checkfront"
  | "coastr"
  | "easyrentpro"
  | "fareharbor"
  | "fleetee"
  | "hq"
  | "lokki"
  | "motostack"
  | "myrent"
  | "navotar"
  | "prohire"
  | "rcm"
  | "rentcentric"
  | "renteon"
  | "rentle"
  | "rentsyst"
  | "rentware"
  | "rentworks"
  | "rezdy"
  | "toprentapp"
  | "tsd"
  | "vevs"
  | "way2rentals"
  | "wheelbase"
  | "wheelsys";

export type Software = {
  id: SoftwareId;
  name: string;
  slug: string;
  help?: string;
  steps: string[];
  dateOrder?: "dmy" | "mdy";
  distance?: "km" | "mi";
  preset: boolean;
};

const GENERIC = ["sw_generic_1", "sw_generic_2", "sw_generic_3"];

// Europe and the UK (added 4 November 2026): day-first dates everywhere; kilometres in the EU, miles in the UK.
const EU = { dateOrder: "dmy", distance: "km" } as const;
const UK = { dateOrder: "dmy", distance: "mi" } as const;

/** Alphabetical by name (the importer and the website list them in this order too). */
export const SOFTWARE: Software[] = [
  { id: "anolla", name: "Anolla", slug: "anolla", steps: ["sw_anolla_1", "sw_generic_2", "sw_generic_3"], ...EU, preset: false },
  { id: "anyrent", name: "AnyRent", slug: "anyrent", steps: GENERIC, ...EU, preset: false },
  { id: "appointrent", name: "Appointrent", slug: "appointrent", steps: GENERIC, ...EU, preset: false },
  { id: "booqable", name: "Booqable", slug: "booqable", help: "https://help.booqable.com/en/articles/5603655", steps: ["sw_booqable_1", "sw_booqable_2", "sw_together"], preset: true },
  { id: "carrentalsolutions", name: "Car Rental Solutions", slug: "car-rental-solutions", help: "https://www.carrentalsolutions.com/marketing/export-renters.html", steps: ["sw_crs_1", "sw_crs_2", "sw_together"], preset: false },
  { id: "checkfront", name: "Checkfront", slug: "checkfront", help: "https://support.checkfront.com/hc/en-us/articles/19868452880668-Importing-and-exporting-via-the-Booking-Index", steps: ["sw_checkfront_1", "sw_checkfront_2", "sw_upload"], preset: true },
  { id: "coastr", name: "Coastr", slug: "coastr", steps: GENERIC, ...UK, preset: false },
  { id: "easyrentpro", name: "Easy Rent Pro", slug: "easy-rent-pro", steps: GENERIC, preset: false },
  { id: "fareharbor", name: "FareHarbor", slug: "fareharbor", help: "https://help.fareharbor.com/hc/en-us/articles/40898072248987-Bookings-reports", steps: ["sw_fareharbor_1", "sw_fareharbor_2", "sw_upload"], dateOrder: "mdy", preset: true },
  { id: "fleetee", name: "Fleetee", slug: "fleetee", steps: GENERIC, ...EU, preset: false },
  { id: "hq", name: "HQ Rental Software", slug: "hq-rental-software", help: "https://hqrs.notion.site/Exporting-To-Excel-27f39e91383c48cfaa2f9d41b1290b1f", steps: ["sw_hq_1", "sw_hq_2", "sw_hq_3"], preset: true },
  { id: "lokki", name: "Lokki", slug: "lokki", steps: GENERIC, ...EU, preset: false },
  { id: "motostack", name: "MotoStack", slug: "motostack", steps: ["sw_ask_1", "sw_ask_2", "sw_upload"], preset: false },
  { id: "myrent", name: "MyRent", slug: "myrent", steps: ["sw_myrent_1", "sw_generic_2", "sw_generic_3"], ...EU, preset: false },
  { id: "prohire", name: "Prohire", slug: "prohire", steps: GENERIC, ...UK, preset: false },
  { id: "rentcentric", name: "Rent Centric", slug: "rent-centric", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: false },
  { id: "rcm", name: "Rental Car Manager", slug: "rental-car-manager", help: "https://support.rentalcarmanager.com/portal/en/kb/articles/booking-export-report", steps: ["sw_rcm_1", "sw_rcm_2", "sw_upload"], dateOrder: "dmy", preset: true },
  // Navotar is now RENTALL (navotar.com redirects to rentallsoftware.com); the id and /switch/navotar stay.
  { id: "navotar", name: "RENTALL (formerly Navotar)", slug: "navotar", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: true },
  { id: "renteon", name: "Renteon", slug: "renteon", steps: GENERIC, ...EU, preset: false },
  { id: "rentsyst", name: "RentSyst", slug: "rentsyst", help: "https://rentsyst.com/faq/question/69/", steps: ["sw_rentsyst_1", "sw_rentsyst_2", "sw_together"], dateOrder: "dmy", preset: true },
  { id: "rentware", name: "Rentware", slug: "rentware", help: "https://rentware.com/en/help/export-your-accounting-data/", steps: ["sw_rentware_1", "sw_rentware_2", "sw_generic_3"], ...EU, preset: false },
  { id: "rentworks", name: "RentWorks / RentWorks Plus", slug: "rentworks", help: "https://www.rentworksplus.com/platform/reporting-analytics", steps: ["sw_rentworks_1", "sw_rentworks_2", "sw_together"], dateOrder: "mdy", distance: "mi", preset: true },
  { id: "rezdy", name: "Rezdy", slug: "rezdy", help: "https://support.rezdy.com/hc/en-us/articles/19867797356316-How-To-Use-the-Sales-Orders-Report", steps: ["sw_rezdy_1", "sw_rezdy_2", "sw_upload"], dateOrder: "dmy", preset: true },
  { id: "toprentapp", name: "TopRentApp", slug: "toprentapp", steps: ["sw_toprentapp_1", "sw_generic_3"], ...EU, preset: false },
  { id: "tsd", name: "TSD Rental", slug: "tsd-rental", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: true },
  // Rentle is now TWICE Commerce; the id and /switch/rentle stay (/switch/twice-commerce redirects there).
  { id: "rentle", name: "TWICE Commerce (formerly Rentle)", slug: "rentle", help: "https://www.twicecommerce.com/docs/admin/tables", steps: ["sw_twice_1", "sw_twice_2", "sw_together"], dateOrder: "dmy", preset: true },
  { id: "vevs", name: "VEVS", slug: "vevs", help: "https://www.vevs.com/how-to/customers.php", steps: ["sw_vevs_1", "sw_vevs_2", "sw_together"], dateOrder: "dmy", preset: true },
  { id: "way2rentals", name: "Way2Rentals", slug: "way2rentals", steps: GENERIC, ...EU, preset: false },
  { id: "wheelbase", name: "Wheelbase", slug: "wheelbase", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: false },
  { id: "wheelsys", name: "Wheelsys", slug: "wheelsys", steps: GENERIC, ...EU, preset: false }
];

export const SOFTWARE_BY_ID = new Map(SOFTWARE.map((item) => [item.id, item]));

export function softwareById(id: unknown): Software | null {
  return SOFTWARE_BY_ID.get(String(id || "") as SoftwareId) || null;
}

export function softwareBySlug(slug: unknown): Software | null {
  return SOFTWARE.find((item) => item.slug === slug) || null;
}
