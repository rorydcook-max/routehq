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
  | "booqable"
  | "carrentalsolutions"
  | "checkfront"
  | "easyrentpro"
  | "fareharbor"
  | "hq"
  | "motostack"
  | "navotar"
  | "rcm"
  | "rentcentric"
  | "rentle"
  | "rentsyst"
  | "rentworks"
  | "rezdy"
  | "tsd"
  | "wheelbase";

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

export const SOFTWARE: Software[] = [
  { id: "booqable", name: "Booqable", slug: "booqable", help: "https://help.booqable.com/en/articles/5603655", steps: ["sw_booqable_1", "sw_booqable_2", "sw_together"], preset: true },
  { id: "carrentalsolutions", name: "Car Rental Solutions", slug: "car-rental-solutions", help: "https://www.carrentalsolutions.com/marketing/export-renters.html", steps: ["sw_crs_1", "sw_crs_2", "sw_together"], preset: false },
  { id: "checkfront", name: "Checkfront", slug: "checkfront", help: "https://support.checkfront.com/hc/en-us/articles/19868452880668-Importing-and-exporting-via-the-Booking-Index", steps: ["sw_checkfront_1", "sw_checkfront_2", "sw_upload"], preset: true },
  { id: "easyrentpro", name: "Easy Rent Pro", slug: "easy-rent-pro", steps: GENERIC, preset: false },
  { id: "fareharbor", name: "FareHarbor", slug: "fareharbor", help: "https://help.fareharbor.com/hc/en-us/articles/40898072248987-Bookings-reports", steps: ["sw_fareharbor_1", "sw_fareharbor_2", "sw_upload"], dateOrder: "mdy", preset: true },
  { id: "hq", name: "HQ Rental Software", slug: "hq-rental-software", help: "https://hqrs.notion.site/Exporting-To-Excel-27f39e91383c48cfaa2f9d41b1290b1f", steps: ["sw_hq_1", "sw_hq_2", "sw_hq_3"], preset: true },
  { id: "motostack", name: "MotoStack", slug: "motostack", steps: ["sw_ask_1", "sw_ask_2", "sw_upload"], preset: false },
  { id: "navotar", name: "Navotar", slug: "navotar", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: true },
  { id: "rcm", name: "Rental Car Manager", slug: "rental-car-manager", help: "https://support.rentalcarmanager.com/portal/en/kb/articles/booking-export-report", steps: ["sw_rcm_1", "sw_rcm_2", "sw_upload"], dateOrder: "dmy", preset: true },
  { id: "rentcentric", name: "Rent Centric", slug: "rent-centric", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: false },
  { id: "rentle", name: "Rentle", slug: "rentle", steps: GENERIC, dateOrder: "dmy", preset: true },
  { id: "rentsyst", name: "RentSyst", slug: "rentsyst", help: "https://rentsyst.com/faq/question/69/", steps: ["sw_rentsyst_1", "sw_rentsyst_2", "sw_together"], dateOrder: "dmy", preset: true },
  { id: "rentworks", name: "RentWorks / RentWorks Plus", slug: "rentworks", help: "https://www.rentworksplus.com/platform/reporting-analytics", steps: ["sw_rentworks_1", "sw_rentworks_2", "sw_together"], dateOrder: "mdy", distance: "mi", preset: true },
  { id: "rezdy", name: "Rezdy", slug: "rezdy", help: "https://support.rezdy.com/hc/en-us/articles/19867797356316-How-To-Use-the-Sales-Orders-Report", steps: ["sw_rezdy_1", "sw_rezdy_2", "sw_upload"], dateOrder: "dmy", preset: true },
  { id: "tsd", name: "TSD Rental", slug: "tsd-rental", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: true },
  { id: "wheelbase", name: "Wheelbase", slug: "wheelbase", steps: GENERIC, dateOrder: "mdy", distance: "mi", preset: false }
];

export const SOFTWARE_BY_ID = new Map(SOFTWARE.map((item) => [item.id, item]));

export function softwareById(id: unknown): Software | null {
  return SOFTWARE_BY_ID.get(String(id || "") as SoftwareId) || null;
}

export function softwareBySlug(slug: unknown): Software | null {
  return SOFTWARE.find((item) => item.slug === slug) || null;
}
