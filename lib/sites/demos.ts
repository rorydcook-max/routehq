import type { CatalogVehicle } from "@/lib/public-catalog";
import type { Extra } from "@/lib/price-rules";
import { siteConfigFrom, type SiteConfig, type SiteFaq, type SiteHours } from "@/lib/sites/config";
import type { ArtId, ImageRef } from "@/lib/sites/images";
import { buildPolicies } from "@/lib/sites/policies";
import { isTemplateId, type TemplateId } from "@/lib/sites/templates";
import type { SiteArea, SiteData } from "@/lib/sites/types";

/**
 * Example websites for rovehq.io/booking-pages (Rory, 7 Nov 2026), one per template. Made-up businesses drawn from
 * this file through the same components as a real site: nothing is in the database, so they never appear on
 * rove.rent, in the directory, the partner network or a sitemap. Each is named "Demo: ..." and the page says it is an
 * example. There are no reviews (reviews are never made up), and booking and the contact form are switched off.
 *
 * RoveHQ serves rental businesses worldwide (sites-global, 7 Nov 2026: "our audience is potentially global"), so the
 * examples are spread across Europe, the Americas, Asia, Oceania, Africa and the Middle East, each priced in its own
 * currency with vehicles, payment methods and policies that fit the place. Phone numbers are from ranges reserved
 * for fiction (UK 020 7946 0xxx, North America 555-01xx, Australia 02 5550 xxxx) or left out.
 */

export type SiteDemo = {
  id: string;
  name: string;
  brandColour: string;
  place: string;
  currency: string;
  address: string;
  phone: string;
  config: SiteConfig;
  vehicles: CatalogVehicle[];
  extras: Extra[];
  areas: SiteArea[];
  insuranceExcess: number;
  paymentMethods: string[];
  offer: string;
};

const photo = (file: string) => `/site/vehicles/${file}.webp`;
const withPhoto = (file: "toyota-yaris" | "toyota-corolla" | "mitsubishi-pajero-sport" | "vespa-vxl") => ({ photoUrl: photo(file), photoUrls: [photo(file)] });
const week = (open: string, close: string, sunday: boolean): SiteHours => [...Array.from({ length: 6 }, () => ({ open, close })), sunday ? { open, close } : null];
const art = (id: ArtId): ImageRef => ({ kind: "art", id });
const car = (vehicleId: string): ImageRef => ({ kind: "vehicle", vehicleId });

function vehicle(id: string, name: string, kind: CatalogVehicle["kind"], rates: { day?: number; week?: number; month?: number }, extra: Partial<CatalogVehicle> = {}): CatalogVehicle {
  return { id, name, year: 2024, color: null, kind, photoUrl: null, photoUrls: [], details: [], dailyRate: rates.day || 0, weeklyRate: rates.week || 0, monthlyRate: rates.month || 0, deposit: 0, busy: [], ...extra };
}

type Spec = {
  id: string;
  template: TemplateId;
  name: string;
  brand: string;
  place: string;
  currency: string;
  phone?: string;
  offer?: string;
  hero: ImageRef | null;
  about: ImageRef | null;
  highlights: string[];
  faqs: SiteFaq[];
  hours: SiteHours;
  cancellation: string;
  requirements?: string;
  vehicles: CatalogVehicle[];
  extras: Extra[];
  areas: SiteArea[];
  excess: number;
  pay: string[];
};

/** One example business, labelled as made up in its own About text. */
function demo(spec: Spec): SiteDemo {
  const label = spec.template.charAt(0).toUpperCase() + spec.template.slice(1);
  return {
    id: spec.id,
    name: `Demo: ${spec.name}`,
    brandColour: spec.brand,
    place: spec.place,
    currency: spec.currency,
    address: "",
    phone: spec.phone || "",
    offer: spec.offer || "both_dates",
    config: siteConfigFrom({
      template: spec.template,
      images: { hero: spec.hero, about: spec.about },
      highlights: spec.highlights,
      faqs: spec.faqs,
      hours: spec.hours,
      policyNotes: { cancellation: spec.cancellation, requirements: spec.requirements || "" },
      text: { "about.body": `A made-up rental business in ${spec.place}, used to show the ${label} template. Every vehicle and price here is an example, and nothing can be booked.` }
    }),
    vehicles: spec.vehicles,
    extras: spec.extras,
    areas: spec.areas,
    insuranceExcess: spec.excess,
    paymentMethods: spec.pay
  };
}

// Questions several examples share, worded for anywhere.
const IDP_FAQ: SiteFaq = { q: "Do I need an international driving permit?", a: "If your license isn't in English or doesn't use the Latin alphabet, bring an international driving permit with it." };
const EU_SCOOTER_FAQ: SiteFaq = { q: "Can I ride a 125cc on my car license?", a: "Many European car licenses cover 125cc scooters after a few years of driving, but the rules differ by country. Bigger bikes need a full motorcycle license. Ask us if you're not sure." };
const FUEL_FAQ: SiteFaq = { q: "Is fuel included?", a: "Vehicles go out with a full tank. Bring them back full, or we charge for the fuel used." };
const US_INSURANCE_FAQ: SiteFaq = { q: "Is insurance included?", a: "Every rate includes the state minimum liability cover. Add our damage waiver, or use cover from your own auto policy or credit card." };
const EU_CANCEL = "Free cancellation up to 48 hours before pickup.";
const US_CANCEL = "Free cancellation up to 24 hours before pickup.";

/** The three shown in full on rovehq.io/booking-pages (computer and phone pictures in public/site/booking-pages). */
export const SITE_DEMOS: SiteDemo[] = [
  demo({
    id: "saltwater",
    template: "coast",
    name: "Saltwater Rentals",
    brand: "#1f6f8b",
    place: "Algarve",
    currency: "EUR",
    hero: art("tide"),
    about: car("sw-corolla"),
    highlights: ["Delivered to your villa or hotel", "Child seats on request", "Helmets in every size", "Help on the phone, seven days a week"],
    faqs: [
      { q: "What do I need to bring?", a: "Your passport or ID card and a driving license that covers the vehicle, held for at least a year." },
      { q: "Can you deliver to my villa?", a: "Yes, anywhere within 20 km of Lagos. Further along the coast, ask us first." }
    ],
    hours: week("08:30", "19:00", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("sw-yaris", "Toyota Yaris", "car", { day: 42, week: 260, month: 790 }, { color: "Black", details: ["Manual", "Petrol", "5 seats"], deposit: 300, ...withPhoto("toyota-yaris") }),
      vehicle("sw-corolla", "Toyota Corolla Touring Sports", "car", { day: 55, week: 340, month: 990 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 400, ...withPhoto("toyota-corolla") }),
      vehicle("sw-500", "Fiat 500 Cabrio", "car", { day: 48, week: 300 }, { color: "Mint", details: ["Manual", "Petrol", "4 seats"], deposit: 300 }),
      vehicle("sw-vespa", "Vespa Primavera 125", "scooter", { day: 35, week: 210, month: 590 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 300, ...withPhoto("vespa-vxl") }),
      vehicle("sw-liberty", "Piaggio Liberty 125", "scooter", { day: 28, week: 170, month: 450 }, { color: "White", details: ["Automatic", "125cc"], deposit: 250 })
    ],
    extras: [
      { id: "sw-x1", name: "Child seat", price: 5, per: "day", kind: "car" },
      { id: "sw-x2", name: "Collision damage waiver (CDW)", price: 12, per: "day", kind: "all", preset: "damage_waiver", excess: 250 }
    ],
    areas: [{ name: "Lagos, Algarve", radiusKm: 20 }],
    excess: 1200,
    pay: ["card", "cash"]
  }),
  demo({
    id: "redline",
    template: "moto",
    name: "Redline Moto",
    brand: "#e4572e",
    place: "Lisbon",
    currency: "EUR",
    hero: car("rl-vespa"),
    about: null,
    highlights: ["Two helmets with every bike", "Phone mount on request", "Free drop-off in Baixa and Alfama", "Roadside help, day and night"],
    faqs: [EU_SCOOTER_FAQ, FUEL_FAQ],
    hours: week("09:00", "20:00", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("rl-vespa", "Vespa Primavera 125", "scooter", { day: 40, week: 240, month: 650 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 400, ...withPhoto("vespa-vxl") }),
      vehicle("rl-liberty", "Piaggio Liberty 125", "scooter", { day: 30, week: 180, month: 480 }, { color: "White", details: ["Automatic", "125cc"], deposit: 300 }),
      vehicle("rl-pcx", "Honda PCX 125", "scooter", { day: 35, week: 210, month: 560 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 300 }),
      vehicle("rl-xmax", "Yamaha XMAX 300", "scooter", { day: 55, week: 330 }, { color: "Grey", details: ["Automatic", "300cc"], deposit: 600 }),
      vehicle("rl-tracer", "Yamaha Tracer 7", "motorbike", { day: 110, week: 660 }, { color: "Blue", details: ["Manual", "690cc"], deposit: 1000 }),
      vehicle("rl-gs", "BMW R 1250 GS", "motorbike", { day: 150, week: 900 }, { color: "White", details: ["Manual", "1254cc", "Panniers"], deposit: 1500 })
    ],
    extras: [
      { id: "rl-x1", name: "Young rider", price: 8, per: "day", kind: "bike", preset: "young_driver", minAge: 23 },
      { id: "rl-x2", name: "Damage waiver", price: 9, per: "day", kind: "bike", preset: "damage_waiver", excess: 200 }
    ],
    areas: [{ name: "Lisbon city center", radiusKm: 6 }],
    excess: 800,
    pay: ["card", "cash"]
  }),
  demo({
    id: "northpoint",
    template: "summit",
    name: "Northpoint Car Rental",
    brand: "#1e3a8a",
    place: "Denver",
    currency: "USD",
    phone: "+1 303 555 0142",
    offer: "both_monthly",
    hero: car("np-corolla"),
    about: art("contour"),
    highlights: ["Pickup at Denver International Airport", "AWD cars and ski racks in winter", "Monthly rates for long stays", "No hidden fees"],
    faqs: [
      US_INSURANCE_FAQ,
      { q: "Do you rent by the month?", a: "Yes. Choose Monthly when you book; the price renews each month until you give notice." }
    ],
    hours: week("07:00", "21:00", true),
    cancellation: US_CANCEL,
    requirements: "Drivers must be 21 or over, with a credit card in their name for the deposit hold.",
    vehicles: [
      vehicle("np-yaris", "Toyota Yaris Cross", "car", { day: 54, week: 329, month: 1190 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 250 }),
      vehicle("np-corolla", "Toyota Corolla", "car", { day: 59, week: 349, month: 1290 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 250, ...withPhoto("toyota-corolla") }),
      vehicle("np-rav4", "Toyota RAV4 AWD", "car", { day: 79, week: 479, month: 1690 }, { color: "Blue", details: ["Automatic", "AWD", "5 seats"], deposit: 300 }),
      vehicle("np-outback", "Subaru Outback", "car", { day: 85, week: 509, month: 1790 }, { color: "Green", details: ["Automatic", "AWD", "5 seats"], deposit: 300 }),
      vehicle("np-jeep", "Jeep Grand Cherokee", "car", { day: 99, week: 599, month: 2190 }, { color: "Black", details: ["Automatic", "4x4", "5 seats"], deposit: 400 }),
      vehicle("np-sienna", "Toyota Sienna", "van", { day: 109, week: 659 }, { color: "White", details: ["Automatic", "Hybrid", "8 seats"], deposit: 400 })
    ],
    extras: [
      { id: "np-x1", name: "Delivery to your address", price: 35, per: "rental", kind: "car" },
      { id: "np-x2", name: "Ski rack", price: 15, per: "day", kind: "car" },
      { id: "np-x3", name: "Young driver (under 25)", price: 25, per: "day", kind: "car", preset: "young_driver", minAge: 25 },
      { id: "np-x4", name: "Collision damage waiver", price: 22, per: "day", kind: "car", preset: "damage_waiver", excess: 0 }
    ],
    areas: [
      { name: "Denver", radiusKm: 30 },
      { name: "Denver International Airport", radiusKm: null }
    ],
    excess: 1000,
    pay: ["card"]
  })
];

/*
 * Template previews (sites2): every template can be opened as an example at /rent/demo/<template id>, and its gallery
 * picture (public/site/templates/<id>.webp, scripts/site-template-previews.mjs) is taken from there. Coast, Moto and
 * Summit show the three businesses above; each of the others has its own made-up business somewhere in the world.
 * Only four vehicle photos ship with the app (public/site/vehicles), so most vehicles show the built-in drawings.
 */
const TEMPLATE_DEMOS: SiteDemo[] = [
  demo({
    id: "lagoon",
    template: "lagoon",
    name: "Green Lagoon Rentals",
    brand: "#2f7d5b",
    place: "Canggu, Bali",
    currency: "IDR",
    hero: art("palms"),
    about: car("lg-pajero"),
    highlights: ["Delivered to your villa", "Surfboard racks on every scooter", "Helmets in every size", "Help on WhatsApp, day and night"],
    faqs: [
      { q: "Do I need a license for a scooter?", a: "Yes. Bring a motorcycle license or an international driving permit that covers motorcycles, plus your home license." },
      { q: "Can you deliver to my villa?", a: "Yes, anywhere between Canggu, Seminyak and Pererenan, free for rentals of three days or more." }
    ],
    hours: week("08:00", "20:00", true),
    cancellation: "Free cancellation up to 24 hours before pickup.",
    offer: "both_monthly",
    vehicles: [
      vehicle("lg-scoopy", "Honda Scoopy", "scooter", { day: 75000, week: 450000, month: 1400000 }, { color: "Cream", details: ["Automatic", "110cc"], deposit: 1000000 }),
      vehicle("lg-vario", "Honda Vario 160", "scooter", { day: 100000, week: 600000, month: 1800000 }, { color: "Black", details: ["Automatic", "160cc"], deposit: 1000000 }),
      vehicle("lg-nmax", "Yamaha NMAX 155", "scooter", { day: 150000, week: 900000, month: 2600000 }, { color: "Grey", details: ["Automatic", "155cc"], deposit: 1500000 }),
      vehicle("lg-vespa", "Vespa LX 125", "scooter", { day: 250000, week: 1500000 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 2000000, ...withPhoto("vespa-vxl") }),
      vehicle("lg-avanza", "Toyota Avanza", "car", { day: 350000, week: 2100000, month: 6500000 }, { color: "Silver", details: ["Automatic", "Petrol", "7 seats"], deposit: 3000000 }),
      vehicle("lg-pajero", "Mitsubishi Pajero Sport", "car", { day: 900000, week: 5600000 }, { color: "White", details: ["Automatic", "Diesel", "7 seats"], deposit: 5000000, ...withPhoto("mitsubishi-pajero-sport") })
    ],
    extras: [{ id: "lg-x1", name: "Surfboard rack", price: 0, per: "rental", kind: "bike" }],
    areas: [{ name: "Canggu", radiusKm: 10 }],
    excess: 2500000,
    pay: ["cash", "bank_transfer", "wise"]
  }),
  demo({
    id: "riviera",
    template: "riviera",
    name: "Riviera Car & Vespa",
    brand: "#1d5fa8",
    place: "Nice",
    currency: "EUR",
    hero: art("arches"),
    about: car("rv-vespa"),
    highlights: ["Delivered to your hotel on the Promenade", "Convertibles for the coast road", "Child seats on request", "We speak English, French and Italian"],
    faqs: [EU_SCOOTER_FAQ, { q: "Can I drive into Italy or Monaco?", a: "Yes. Monaco is always fine, and Italy is fine for day trips. Tell us when you book." }],
    hours: week("08:30", "19:30", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("rv-500", "Fiat 500 Cabrio", "car", { day: 59, week: 360 }, { color: "Cream", details: ["Manual", "Petrol", "4 seats"], deposit: 500 }),
      vehicle("rv-208", "Peugeot 208", "car", { day: 55, week: 330 }, { color: "Blue", details: ["Manual", "Petrol", "5 seats"], deposit: 500 }),
      vehicle("rv-yaris", "Toyota Yaris Hybrid", "car", { day: 62, week: 370 }, { color: "Black", details: ["Automatic", "Hybrid", "5 seats"], deposit: 500, ...withPhoto("toyota-yaris") }),
      vehicle("rv-mini", "Mini Cooper Convertible", "car", { day: 99, week: 600 }, { color: "Green", details: ["Automatic", "Petrol", "4 seats"], deposit: 800 }),
      vehicle("rv-vespa", "Vespa Primavera 125", "scooter", { day: 49, week: 290 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 400, ...withPhoto("vespa-vxl") })
    ],
    extras: [
      { id: "rv-x1", name: "Hotel delivery", price: 25, per: "rental", kind: "all" },
      { id: "rv-x2", name: "Collision damage waiver (CDW)", price: 15, per: "day", kind: "all", preset: "damage_waiver", excess: 300 }
    ],
    areas: [{ name: "Nice", radiusKm: 12 }],
    excess: 1300,
    pay: ["card"]
  }),
  demo({
    id: "reef",
    template: "reef",
    name: "Reef Scooters",
    brand: "#f0573b",
    place: "Cancún",
    currency: "USD",
    hero: art("sun"),
    about: null,
    highlights: ["Free drop-off in the Hotel Zone", "Two helmets with every scooter", "Locks and phone mounts included", "Roadside help, day and night"],
    faqs: [
      { q: "Do I need a license?", a: "Yes. Bring a valid driving license and your passport. We'll check them at pickup." },
      FUEL_FAQ
    ],
    hours: week("08:00", "20:00", true),
    cancellation: US_CANCEL,
    vehicles: [
      vehicle("rf-dio", "Honda Dio 110", "scooter", { day: 29, week: 170 }, { color: "White", details: ["Automatic", "110cc"], deposit: 150 }),
      vehicle("rf-nmax", "Yamaha NMAX 125", "scooter", { day: 39, week: 230 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 200 }),
      vehicle("rf-pcx", "Honda PCX 125", "scooter", { day: 39, week: 230 }, { color: "Red", details: ["Automatic", "125cc"], deposit: 200 }),
      vehicle("rf-vespa", "Vespa Primavera 125", "scooter", { day: 49, week: 290 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 300, ...withPhoto("vespa-vxl") }),
      vehicle("rf-ebike", "Electric beach cruiser", "ebike", { day: 25, week: 140 }, { color: "Turquoise", details: ["Electric", "50 km range"], deposit: 100 })
    ],
    extras: [{ id: "rf-x1", name: "Damage waiver", price: 8, per: "day", kind: "all", preset: "damage_waiver", excess: 100 }],
    areas: [{ name: "Cancún Hotel Zone", radiusKm: 15 }],
    excess: 500,
    pay: ["card", "cash"]
  }),
  demo({
    id: "swell",
    template: "swell",
    name: "Swell Surf Rentals",
    brand: "#e2711d",
    place: "Byron Bay",
    currency: "AUD",
    phone: "+61 2 5550 1234",
    hero: car("sw2-vespa"),
    about: null,
    highlights: ["Board racks on every car", "Wetsuits and boards to hire", "Pickup from Ballina Byron airport", "Locals who know the breaks"],
    faqs: [
      { q: "Can I take a board?", a: "Yes. Every car has roof racks and straps, and the scooters take a side rack for boards up to 7 feet." },
      { q: "What do I need to bring?", a: "Your driving license (with an English translation or international permit if it isn't in English) and a credit card." }
    ],
    hours: week("07:00", "18:00", true),
    cancellation: "Free cancellation up to 48 hours before pickup.",
    requirements: "Drivers must be 21 or over.",
    vehicles: [
      vehicle("sw2-yaris", "Toyota Yaris", "car", { day: 65, week: 390 }, { color: "Black", details: ["Automatic", "Petrol", "5 seats", "Roof racks"], deposit: 500, ...withPhoto("toyota-yaris") }),
      vehicle("sw2-corolla", "Toyota Corolla", "car", { day: 79, week: 470 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats", "Roof racks"], deposit: 500, ...withPhoto("toyota-corolla") }),
      vehicle("sw2-hiace", "Toyota HiAce surf van", "van", { day: 139, week: 840 }, { color: "Sand", details: ["Automatic", "Diesel", "Sleeps 2"], deposit: 1000 }),
      vehicle("sw2-vespa", "Vespa Primavera 125", "scooter", { day: 65, week: 390 }, { color: "Black", details: ["Automatic", "125cc", "Board rack"], deposit: 300, ...withPhoto("vespa-vxl") }),
      vehicle("sw2-ebike", "Electric fat-tyre bike", "ebike", { day: 49, week: 280 }, { color: "Orange", details: ["Electric", "60 km range"], deposit: 200 })
    ],
    extras: [
      { id: "sw2-x1", name: "Surfboard", price: 25, per: "day", kind: "all" },
      { id: "sw2-x2", name: "Excess reduction", price: 25, per: "day", kind: "car", preset: "damage_waiver", excess: 500 }
    ],
    areas: [
      { name: "Byron Bay", radiusKm: 15 },
      { name: "Ballina Byron Gateway Airport", radiusKm: null }
    ],
    excess: 3000,
    pay: ["card"]
  }),
  demo({
    id: "pier",
    template: "pier",
    name: "Pier 9 Rentals",
    brand: "#1b3a6b",
    place: "Naxos",
    currency: "EUR",
    hero: car("pr-yaris"),
    about: car("pr-vespa"),
    highlights: ["Waiting for you at the ferry port", "Quads for the beach roads", "Free delivery in Naxos Town", "Open every day in season"],
    faqs: [
      { q: "Can you meet me at the ferry?", a: "Yes. Tell us your ferry when you book and we'll be at the port with your vehicle." },
      EU_SCOOTER_FAQ
    ],
    hours: week("08:00", "21:00", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("pr-panda", "Fiat Panda", "car", { day: 40, week: 240 }, { color: "White", details: ["Manual", "Petrol", "5 seats"], deposit: 300 }),
      vehicle("pr-yaris", "Toyota Yaris", "car", { day: 45, week: 270 }, { color: "Black", details: ["Manual", "Petrol", "5 seats"], deposit: 300, ...withPhoto("toyota-yaris") }),
      vehicle("pr-jimny", "Suzuki Jimny", "car", { day: 70, week: 420 }, { color: "Green", details: ["Manual", "4x4", "4 seats"], deposit: 500 }),
      vehicle("pr-quad", "Quad bike 300cc", "atv", { day: 45, week: 270 }, { color: "Red", details: ["Automatic", "300cc", "2 seats"], deposit: 300 }),
      vehicle("pr-vespa", "Vespa Primavera 125", "scooter", { day: 35, week: 210 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 250, ...withPhoto("vespa-vxl") }),
      vehicle("pr-liberty", "Piaggio Liberty 125", "scooter", { day: 25, week: 150 }, { color: "Blue", details: ["Automatic", "125cc"], deposit: 200 })
    ],
    extras: [
      { id: "pr-x1", name: "Ferry port delivery", price: 0, per: "rental", kind: "all" },
      { id: "pr-x2", name: "Full damage waiver (FDW)", price: 10, per: "day", kind: "all", preset: "damage_waiver", excess: 0 }
    ],
    areas: [{ name: "Naxos Town", radiusKm: 8 }],
    excess: 900,
    pay: ["card", "cash"]
  }),
  demo({
    id: "villa",
    template: "villa",
    name: "Villa Drive Collection",
    brand: "#8a6d3b",
    place: "Mallorca",
    currency: "EUR",
    hero: art("arches"),
    about: null,
    highlights: ["Delivered to your villa anywhere on the island", "Collected from Palma airport", "Cars detailed before every rental", "A personal handover, never a counter"],
    faqs: [
      { q: "Do you deliver to villas outside Palma?", a: "Yes, anywhere on Mallorca. Delivery and collection are included for rentals of three days or more." },
      { q: "How much is the deposit?", a: "It depends on the car, from €1,500 to €5,000, held on a credit card and released when the car comes back." }
    ],
    hours: week("08:00", "20:00", true),
    cancellation: "Free cancellation up to 7 days before delivery.",
    requirements: "Drivers must be 25 or over, with at least 3 years of driving.",
    vehicles: [
      vehicle("vl-e", "Mercedes-Benz E 300 e", "car", { day: 220, week: 1350 }, { color: "Black", details: ["Automatic", "Plug-in hybrid", "5 seats"], deposit: 2000 }),
      vehicle("vl-x5", "BMW X5 xDrive50e", "car", { day: 320, week: 1950 }, { color: "White", details: ["Automatic", "Plug-in hybrid", "5 seats"], deposit: 3000 }),
      vehicle("vl-rr", "Range Rover Sport", "car", { day: 390, week: 2400 }, { color: "Grey", details: ["Automatic", "Hybrid", "5 seats"], deposit: 3500 }),
      vehicle("vl-911", "Porsche 911 Carrera Cabriolet", "car", { day: 590, week: 3600 }, { color: "Silver", details: ["Automatic", "Petrol", "4 seats"], deposit: 5000 }),
      vehicle("vl-mini", "Mini Cooper S Convertible", "car", { day: 130, week: 790 }, { color: "Green", details: ["Automatic", "Petrol", "4 seats"], deposit: 1500 }),
      vehicle("vl-v", "Mercedes-Benz V-Class", "van", { day: 260, week: 1600 }, { color: "Black", details: ["Automatic", "Diesel", "7 seats"], deposit: 2500 })
    ],
    extras: [
      { id: "vl-x1", name: "Villa delivery and collection", price: 0, per: "rental", kind: "car" },
      { id: "vl-x2", name: "Premium damage waiver", price: 45, per: "day", kind: "car", preset: "damage_waiver", excess: 500 }
    ],
    areas: [
      { name: "Mallorca", radiusKm: 80 },
      { name: "Palma de Mallorca Airport", radiusKm: null }
    ],
    excess: 3000,
    pay: ["card", "bank_transfer"]
  }),
  demo({
    id: "metro",
    template: "metro",
    name: "Metro Car Rental",
    brand: "#2b59ff",
    place: "London",
    currency: "GBP",
    phone: "+44 20 7946 0123",
    hero: art("city"),
    about: null,
    highlights: ["Every car is ULEZ compliant", "Pickup at King's Cross or Heathrow", "Unlimited mileage", "Vans for moving day"],
    faqs: [
      { q: "Who pays the Congestion Charge?", a: "You do, for the days you drive in the zone. Pay it online with Transport for London on the day." },
      IDP_FAQ
    ],
    hours: week("07:30", "20:00", true),
    cancellation: "Free cancellation up to 24 hours before pickup.",
    requirements: "Drivers must be 23 or over, with a full license held for at least 2 years.",
    vehicles: [
      vehicle("mt-yaris", "Toyota Yaris Hybrid", "car", { day: 45, week: 270 }, { color: "Black", details: ["Automatic", "Hybrid", "5 seats"], deposit: 250, ...withPhoto("toyota-yaris") }),
      vehicle("mt-golf", "Volkswagen Golf", "car", { day: 55, week: 330 }, { color: "Grey", details: ["Manual", "Petrol", "5 seats"], deposit: 250 }),
      vehicle("mt-corolla", "Toyota Corolla Hybrid", "car", { day: 58, week: 350 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 250, ...withPhoto("toyota-corolla") }),
      vehicle("mt-bmw", "BMW 3 Series", "car", { day: 79, week: 470 }, { color: "Black", details: ["Automatic", "Petrol", "5 seats"], deposit: 400 }),
      vehicle("mt-tesla", "Tesla Model 3", "car", { day: 89, week: 530 }, { color: "Red", details: ["Electric", "Automatic", "5 seats"], deposit: 400 }),
      vehicle("mt-transit", "Ford Transit Custom", "van", { day: 85, week: 510 }, { color: "White", details: ["Manual", "Diesel", "3 seats"], deposit: 400 })
    ],
    extras: [
      { id: "mt-x1", name: "Additional driver", price: 12, per: "day", kind: "car" },
      { id: "mt-x2", name: "Excess protection", price: 18, per: "day", kind: "car", preset: "damage_waiver", excess: 250 }
    ],
    areas: [
      { name: "King's Cross, London", radiusKm: null },
      { name: "Heathrow Airport", radiusKm: null }
    ],
    excess: 1250,
    pay: ["card"]
  }),
  demo({
    id: "runway",
    template: "runway",
    name: "Runway Airport Cars",
    brand: "#f2b705",
    place: "Dubai",
    currency: "AED",
    hero: car("rw-corolla"),
    about: null,
    highlights: ["Meet and greet at DXB arrivals", "Salik tolls billed at cost", "Free child seats", "Open around the clock"],
    faqs: [
      { q: "Where do I collect the car?", a: "Our driver meets you in the arrivals hall at Dubai International (DXB) with a name board, then walks you to the car." },
      IDP_FAQ
    ],
    hours: week("00:00", "23:59", true),
    cancellation: "Free cancellation up to 24 hours before your flight lands.",
    requirements: "Drivers must be 21 or over. Visitors from some countries need an international driving permit.",
    vehicles: [
      vehicle("rw-sunny", "Nissan Sunny", "car", { day: 99, week: 590, month: 1900 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 1000 }),
      vehicle("rw-yaris", "Toyota Yaris", "car", { day: 109, week: 650, month: 2100 }, { color: "Black", details: ["Automatic", "Petrol", "5 seats"], deposit: 1000, ...withPhoto("toyota-yaris") }),
      vehicle("rw-corolla", "Toyota Corolla", "car", { day: 139, week: 830, month: 2700 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 1500, ...withPhoto("toyota-corolla") }),
      vehicle("rw-sportage", "Kia Sportage", "car", { day: 179, week: 1070, month: 3500 }, { color: "Grey", details: ["Automatic", "Petrol", "5 seats"], deposit: 1500 }),
      vehicle("rw-pajero", "Mitsubishi Montero Sport", "car", { day: 249, week: 1490, month: 4900 }, { color: "White", details: ["Automatic", "Petrol", "7 seats"], deposit: 2000, ...withPhoto("mitsubishi-pajero-sport") }),
      vehicle("rw-patrol", "Nissan Patrol", "car", { day: 499, week: 2990 }, { color: "Black", details: ["Automatic", "Petrol", "7 seats"], deposit: 3000 })
    ],
    extras: [
      { id: "rw-x1", name: "Airport meet and greet", price: 0, per: "rental", kind: "car" },
      { id: "rw-x2", name: "Full insurance", price: 45, per: "day", kind: "car", preset: "damage_waiver", excess: 0 }
    ],
    areas: [
      { name: "Dubai International Airport (DXB)", radiusKm: null },
      { name: "Dubai", radiusKm: 30 }
    ],
    excess: 1500,
    pay: ["card", "cash"]
  }),
  demo({
    id: "noir",
    template: "noir",
    name: "Noir Prestige Cars",
    brand: "#c9a96e",
    place: "Miami",
    currency: "USD",
    phone: "+1 305 555 0178",
    hero: art("bloom"),
    about: null,
    highlights: ["Delivered to your hotel, home or yacht", "Concierge on call", "Cars detailed before every rental", "Discreet, by appointment"],
    faqs: [
      { q: "What insurance do I need?", a: "Bring proof of full-coverage auto insurance that extends to rentals, or add our damage waiver when you book." },
      { q: "How much is the deposit?", a: "From $2,500 to $10,000 depending on the car, held on a credit card and released when the car comes back." }
    ],
    hours: week("09:00", "21:00", true),
    cancellation: "Free cancellation up to 72 hours before delivery.",
    requirements: "Drivers must be 25 or over, with a credit card in their name.",
    vehicles: [
      vehicle("nr-escalade", "Cadillac Escalade", "car", { day: 395, week: 2490 }, { color: "Black", details: ["Automatic", "Petrol", "7 seats"], deposit: 2500 }),
      vehicle("nr-911", "Porsche 911 Carrera", "car", { day: 695, week: 4390 }, { color: "Silver", details: ["Automatic", "Petrol", "4 seats"], deposit: 5000 }),
      vehicle("nr-g63", "Mercedes-AMG G 63", "car", { day: 895, week: 5590 }, { color: "Black", details: ["Automatic", "Petrol", "5 seats"], deposit: 5000 }),
      vehicle("nr-roma", "Ferrari Roma", "car", { day: 1195, week: 7490 }, { color: "Red", details: ["Automatic", "Petrol", "2+2 seats"], deposit: 7500 }),
      vehicle("nr-huracan", "Lamborghini Huracán EVO", "car", { day: 1295, week: 7990 }, { color: "Green", details: ["Automatic", "Petrol", "2 seats"], deposit: 10000 }),
      vehicle("nr-cullinan", "Rolls-Royce Cullinan", "car", { day: 1695, week: 10490 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 10000 })
    ],
    extras: [
      { id: "nr-x1", name: "Delivery in Miami-Dade", price: 0, per: "rental", kind: "car" },
      { id: "nr-x2", name: "Damage waiver", price: 150, per: "day", kind: "car", preset: "damage_waiver", excess: 2500 }
    ],
    areas: [{ name: "Miami", radiusKm: 40 }],
    excess: 7500,
    pay: ["card", "bank_transfer"]
  }),
  demo({
    id: "trail",
    template: "trail",
    name: "High Trail Moto",
    brand: "#d9822b",
    place: "Queenstown",
    currency: "NZD",
    hero: art("peaks"),
    about: null,
    highlights: ["GPS loaded with South Island routes", "Panniers and top boxes included", "Riding gear to hire", "Guided tours on request"],
    faqs: [
      { q: "What license do I need?", a: "A full motorcycle license for the class of bike. If it isn't in English, bring an international driving permit or an approved translation." },
      { q: "Can I ride gravel roads?", a: "On the adventure and trail bikes, yes. We'll mark the roads that are closed to rentals on your map." }
    ],
    hours: week("08:00", "18:00", true),
    cancellation: "Free cancellation up to 14 days before pickup.",
    requirements: "Riders must be 25 or over for bikes above 650cc.",
    vehicles: [
      vehicle("tr-crf", "Honda CRF300L", "motorbike", { day: 149, week: 890 }, { color: "Red", details: ["Manual", "300cc", "Trail"], deposit: 1000 }),
      vehicle("tr-him", "Royal Enfield Himalayan 450", "motorbike", { day: 179, week: 1070 }, { color: "Sand", details: ["Manual", "450cc", "Adventure"], deposit: 1500 }),
      vehicle("tr-tiger", "Triumph Tiger 900 GT", "motorbike", { day: 255, week: 1530 }, { color: "Grey", details: ["Manual", "888cc", "Adventure"], deposit: 2000 }),
      vehicle("tr-at", "Honda Africa Twin", "motorbike", { day: 265, week: 1590 }, { color: "Red", details: ["Manual", "1084cc", "Adventure"], deposit: 2000 }),
      vehicle("tr-gs", "BMW R 1250 GS", "motorbike", { day: 295, week: 1770 }, { color: "White", details: ["Manual", "1254cc", "Panniers"], deposit: 2500 })
    ],
    extras: [
      { id: "tr-x1", name: "Riding gear set", price: 30, per: "day", kind: "bike" },
      { id: "tr-x2", name: "Excess reduction", price: 35, per: "day", kind: "bike", preset: "damage_waiver", excess: 1000 }
    ],
    areas: [{ name: "Queenstown", radiusKm: null }],
    excess: 3000,
    pay: ["card"]
  }),
  demo({
    id: "dolce",
    template: "dolce",
    name: "Dolce Vespa Club",
    brand: "#c0392b",
    place: "Rome",
    currency: "EUR",
    hero: car("dv-primavera"),
    about: art("sun"),
    highlights: ["Classic and new Vespas", "Two helmets with every scooter", "Hand-drawn routes to the best views", "Delivered to your hotel"],
    faqs: [EU_SCOOTER_FAQ, { q: "Can I ride the classic Vespas?", a: "Yes, if you can ride a manual gearbox. We'll show you the gears before you leave." }],
    hours: week("09:00", "19:30", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("dv-primavera", "Vespa Primavera 125", "scooter", { day: 65, week: 390 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 500, ...withPhoto("vespa-vxl") }),
      vehicle("dv-gts", "Vespa GTS 300", "scooter", { day: 85, week: 510 }, { color: "Grey", details: ["Automatic", "300cc"], deposit: 700 }),
      vehicle("dv-px", "Vespa PX 150 (classic)", "scooter", { day: 95, week: 570 }, { color: "Cream", details: ["Manual", "150cc", "Classic"], deposit: 800 }),
      vehicle("dv-lambretta", "Lambretta X300", "scooter", { day: 80, week: 480 }, { color: "Red", details: ["Automatic", "278cc"], deposit: 700 }),
      vehicle("dv-elettrica", "Vespa Elettrica", "scooter", { day: 70, week: 420 }, { color: "Blue", details: ["Electric", "100 km range"], deposit: 600 })
    ],
    extras: [
      { id: "dv-x1", name: "Hotel delivery", price: 20, per: "rental", kind: "bike" },
      { id: "dv-x2", name: "Damage waiver", price: 12, per: "day", kind: "bike", preset: "damage_waiver", excess: 300 }
    ],
    areas: [{ name: "Rome city center", radiusKm: 5 }],
    excess: 1000,
    pay: ["card", "cash"]
  }),
  demo({
    id: "haven",
    template: "haven",
    name: "Haven Family Cars",
    brand: "#3a86ff",
    place: "Orlando",
    currency: "USD",
    phone: "+1 407 555 0163",
    hero: car("hv-corolla"),
    about: art("sun"),
    highlights: ["Car seats and strollers included", "Delivered to your vacation rental", "Pickup at Orlando International (MCO)", "Minivans that fit the whole family"],
    faqs: [
      US_INSURANCE_FAQ,
      { q: "Do you supply car seats?", a: "Yes, free. Tell us your children's ages when you book and we'll fit the right seats before you arrive." }
    ],
    hours: week("07:00", "22:00", true),
    cancellation: US_CANCEL,
    requirements: "Drivers must be 21 or over, with a credit card in their name.",
    vehicles: [
      vehicle("hv-corolla", "Toyota Corolla", "car", { day: 52, week: 310 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 200, ...withPhoto("toyota-corolla") }),
      vehicle("hv-carnival", "Kia Carnival", "van", { day: 85, week: 510 }, { color: "Grey", details: ["Automatic", "Petrol", "8 seats"], deposit: 300 }),
      vehicle("hv-pacifica", "Chrysler Pacifica", "van", { day: 89, week: 535 }, { color: "White", details: ["Automatic", "Petrol", "7 seats"], deposit: 300 }),
      vehicle("hv-odyssey", "Honda Odyssey", "van", { day: 92, week: 550 }, { color: "Blue", details: ["Automatic", "Petrol", "8 seats"], deposit: 300 }),
      vehicle("hv-sienna", "Toyota Sienna", "van", { day: 95, week: 570 }, { color: "Silver", details: ["Automatic", "Hybrid", "8 seats"], deposit: 300 }),
      vehicle("hv-suburban", "Chevrolet Suburban", "car", { day: 129, week: 775 }, { color: "Black", details: ["Automatic", "Petrol", "8 seats"], deposit: 400 })
    ],
    extras: [
      { id: "hv-x1", name: "Delivery to your vacation rental", price: 25, per: "rental", kind: "car" },
      { id: "hv-x2", name: "Collision damage waiver", price: 19, per: "day", kind: "car", preset: "damage_waiver", excess: 0 }
    ],
    areas: [
      { name: "Orlando", radiusKm: 35 },
      { name: "Orlando International Airport (MCO)", radiusKm: null }
    ],
    excess: 1000,
    pay: ["card"]
  }),
  demo({
    id: "nomad",
    template: "nomad",
    name: "Nomad Monthly Rentals",
    brand: "#5f6b3a",
    place: "Medellín",
    currency: "USD",
    offer: "monthly",
    hero: car("nm-corolla"),
    about: null,
    highlights: ["Monthly prices with maintenance included", "Swap cars any month", "Delivered to your apartment", "English-speaking support"],
    faqs: [
      { q: "How does monthly renting work?", a: "Pick a start date and we charge one month at a time. The rental renews each month until you give a week's notice." },
      { q: "Is maintenance included?", a: "Yes: servicing, tires and the yearly inspection are on us. You pay for fuel and tolls." }
    ],
    hours: week("08:00", "18:00", false),
    cancellation: "Give a week's notice before your next month starts.",
    vehicles: [
      vehicle("nm-picanto", "Kia Picanto", "car", { month: 520 }, { color: "Red", details: ["Manual", "Petrol", "5 seats"], deposit: 300 }),
      vehicle("nm-mazda2", "Mazda 2", "car", { month: 590 }, { color: "Grey", details: ["Automatic", "Petrol", "5 seats"], deposit: 300 }),
      vehicle("nm-duster", "Renault Duster", "car", { month: 690 }, { color: "Orange", details: ["Manual", "Petrol", "5 seats"], deposit: 400 }),
      vehicle("nm-corolla", "Toyota Corolla", "car", { month: 790 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 400, ...withPhoto("toyota-corolla") }),
      vehicle("nm-nmax", "Yamaha NMAX 155", "scooter", { month: 190 }, { color: "Black", details: ["Automatic", "155cc"], deposit: 150 }),
      vehicle("nm-pulsar", "Bajaj Pulsar NS200", "motorbike", { month: 210 }, { color: "Blue", details: ["Manual", "200cc"], deposit: 150 })
    ],
    extras: [{ id: "nm-x1", name: "Apartment delivery", price: 0, per: "rental", kind: "all" }],
    areas: [{ name: "Medellín", radiusKm: 15 }],
    excess: 600,
    pay: ["card", "bank_transfer", "wise"]
  }),
  demo({
    id: "volt",
    template: "volt",
    name: "Volt EV Rentals",
    brand: "#0f9f5f",
    place: "Amsterdam",
    currency: "EUR",
    hero: art("grid"),
    about: null,
    highlights: ["Every car fully electric", "Charged to 80% or more at pickup", "Charging card included", "E-bikes for the city"],
    faqs: [
      { q: "How do I charge on the road?", a: "Every car comes with a charging card that works at most public chargers in the Netherlands and nearby countries. We bill the charging at cost." },
      { q: "Do I have to return it full?", a: "Bring it back with at least 20% battery. Below that, we charge a small top-up fee." }
    ],
    hours: week("08:00", "20:00", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("vt-id3", "Volkswagen ID.3", "car", { day: 69, week: 410, month: 1290 }, { color: "Grey", details: ["Electric", "420 km range", "5 seats"], deposit: 500 }),
      vehicle("vt-m3", "Tesla Model 3", "car", { day: 89, week: 530, month: 1590 }, { color: "Red", details: ["Electric", "510 km range", "5 seats"], deposit: 750 }),
      vehicle("vt-p2", "Polestar 2", "car", { day: 95, week: 570, month: 1690 }, { color: "White", details: ["Electric", "480 km range", "5 seats"], deposit: 750 }),
      vehicle("vt-ev6", "Kia EV6", "car", { day: 99, week: 590, month: 1790 }, { color: "Blue", details: ["Electric", "500 km range", "5 seats"], deposit: 750 }),
      vehicle("vt-my", "Tesla Model Y", "car", { day: 109, week: 650, month: 1890 }, { color: "Black", details: ["Electric", "530 km range", "5 seats"], deposit: 750 }),
      vehicle("vt-ebike", "City e-bike", "ebike", { day: 25, week: 140, month: 390 }, { color: "Black", details: ["Electric", "80 km range"], deposit: 150 })
    ],
    extras: [{ id: "vt-x1", name: "Collision damage waiver (CDW)", price: 14, per: "day", kind: "car", preset: "damage_waiver", excess: 300 }],
    areas: [{ name: "Amsterdam", radiusKm: null }],
    excess: 1500,
    pay: ["card"]
  }),
  demo({
    id: "roam",
    template: "roam",
    name: "Roam Campervans",
    brand: "#b5562f",
    place: "Reykjavík",
    currency: "ISK",
    hero: art("peaks"),
    about: null,
    highlights: ["Free pickup at Keflavík airport", "Bedding, cooker and heater included", "Unlimited kilometers", "4x4 campers for the highland roads"],
    faqs: [
      { q: "Can I drive the highland F-roads?", a: "Only in our 4x4 campers, and only when the roads are open. Two-wheel-drive vans must stay on regular roads." },
      { q: "Can I sleep anywhere?", a: "No: in Iceland you need to stay at a campsite. We'll give you a map of the ones open in your season." }
    ],
    hours: week("08:00", "20:00", true),
    cancellation: "Free cancellation up to 30 days before pickup.",
    requirements: "Drivers must be 23 or over, with a license held for at least a year.",
    vehicles: [
      vehicle("rm-duster", "Dacia Duster 4x4 camper", "car", { day: 19900, week: 129000 }, { color: "Orange", details: ["Manual", "4x4", "Sleeps 2"], deposit: 100000 }),
      vehicle("rm-trafic", "Renault Trafic camper", "van", { day: 24900, week: 159000 }, { color: "White", details: ["Manual", "Diesel", "Sleeps 3", "Kitchen"], deposit: 150000 }),
      vehicle("rm-cruiser", "Toyota Land Cruiser with roof tent", "car", { day: 34900, week: 225000 }, { color: "Grey", details: ["Automatic", "4x4", "Sleeps 2"], deposit: 200000 }),
      vehicle("rm-california", "Volkswagen California", "van", { day: 39900, week: 259000 }, { color: "Blue", details: ["Automatic", "Pop-up roof", "Sleeps 4"], deposit: 200000 })
    ],
    extras: [
      { id: "rm-x1", name: "Gravel protection", price: 2500, per: "day", kind: "car" },
      { id: "rm-x2", name: "Super collision damage waiver (SCDW)", price: 4500, per: "day", kind: "car", preset: "damage_waiver", excess: 75000 }
    ],
    areas: [
      { name: "Keflavík International Airport", radiusKm: null },
      { name: "Reykjavík", radiusKm: 15 }
    ],
    excess: 350000,
    pay: ["card"]
  }),
  demo({
    id: "washi",
    template: "washi",
    name: "Washi Rentals",
    brand: "#b7282e",
    place: "Kyoto",
    currency: "JPY",
    hero: art("ripple"),
    about: car("ws-corolla"),
    highlights: ["Two minutes from Kyoto Station", "ETC toll cards on request", "English navigation in every car", "Child seats free"],
    faqs: [
      { q: "Can I drive in Japan on my license?", a: "Bring an international driving permit (1949 Geneva Convention) with your license, or an official Japanese translation for licenses from some countries. We can't rent without one." },
      { q: "What is the ETC card?", a: "It pays expressway tolls at the gate without stopping. We bill the tolls when you return the car." }
    ],
    hours: week("08:00", "20:00", true),
    cancellation: "Free cancellation up to 7 days before pickup.",
    vehicles: [
      vehicle("ws-nbox", "Honda N-BOX", "car", { day: 6600, week: 39600 }, { color: "White", details: ["Automatic", "Kei car", "4 seats"], deposit: 0 }),
      vehicle("ws-yaris", "Toyota Yaris", "car", { day: 7700, week: 46200 }, { color: "Black", details: ["Automatic", "Hybrid", "5 seats"], deposit: 0, ...withPhoto("toyota-yaris") }),
      vehicle("ws-corolla", "Toyota Corolla", "car", { day: 9900, week: 59400 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 0, ...withPhoto("toyota-corolla") }),
      vehicle("ws-sienta", "Toyota Sienta", "van", { day: 11000, week: 66000 }, { color: "Beige", details: ["Automatic", "Hybrid", "7 seats"], deposit: 0 }),
      vehicle("ws-alphard", "Toyota Alphard", "van", { day: 22000, week: 132000 }, { color: "Black", details: ["Automatic", "Hybrid", "7 seats"], deposit: 0 })
    ],
    extras: [
      { id: "ws-x1", name: "ETC toll card", price: 330, per: "rental", kind: "car" },
      { id: "ws-x2", name: "Collision damage waiver", price: 1100, per: "day", kind: "car", preset: "damage_waiver", excess: 0 }
    ],
    areas: [{ name: "Kyoto Station", radiusKm: null }],
    excess: 50000,
    pay: ["card", "cash"]
  }),
  demo({
    id: "fjord",
    template: "fjord",
    name: "Fjord Car Hire",
    brand: "#d7141a",
    place: "Bergen",
    currency: "NOK",
    hero: car("fj-corolla"),
    about: art("contour"),
    highlights: ["Electric cars charged and ready", "Tolls and ferries billed at cost", "Winter tires from October to April", "Pickup at Bergen Airport"],
    faqs: [
      { q: "How do tolls and ferries work?", a: "Every car has an AutoPASS tag. Road tolls and most car ferries are charged to it, and we bill them at cost after your rental." },
      { q: "Are winter tires included?", a: "Yes. From October to April every car has winter tires at no extra cost." }
    ],
    hours: week("07:00", "21:00", true),
    cancellation: EU_CANCEL,
    requirements: "Drivers must be 21 or over, with a license held for at least a year.",
    vehicles: [
      vehicle("fj-yaris", "Toyota Yaris Hybrid", "car", { day: 690, week: 4140 }, { color: "Black", details: ["Automatic", "Hybrid", "5 seats"], deposit: 3000, ...withPhoto("toyota-yaris") }),
      vehicle("fj-corolla", "Toyota Corolla Touring Sports", "car", { day: 790, week: 4740 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 3000, ...withPhoto("toyota-corolla") }),
      vehicle("fj-id4", "Volkswagen ID.4", "car", { day: 1090, week: 6540 }, { color: "Grey", details: ["Electric", "AWD", "5 seats"], deposit: 4000 }),
      vehicle("fj-enyaq", "Skoda Enyaq", "car", { day: 1150, week: 6900 }, { color: "Green", details: ["Electric", "5 seats"], deposit: 4000 }),
      vehicle("fj-ex40", "Volvo EX40", "car", { day: 1290, week: 7740 }, { color: "White", details: ["Electric", "AWD", "5 seats"], deposit: 5000 }),
      vehicle("fj-transporter", "Volkswagen Transporter", "van", { day: 1390, week: 8340 }, { color: "White", details: ["Manual", "Diesel", "9 seats"], deposit: 5000 })
    ],
    extras: [{ id: "fj-x1", name: "Excess reduction", price: 150, per: "day", kind: "car", preset: "damage_waiver", excess: 2500 }],
    areas: [
      { name: "Bergen city center", radiusKm: null },
      { name: "Bergen Airport", radiusKm: null }
    ],
    excess: 12000,
    pay: ["card"]
  }),
  demo({
    id: "folio",
    template: "folio",
    name: "Folio Rentals",
    brand: "#7b2d26",
    place: "Cape Town",
    currency: "ZAR",
    hero: car("fo-vespa"),
    about: car("fo-pajero"),
    highlights: ["Delivered anywhere in the City Bowl", "Unlimited kilometers", "Cross-border letters for Namibia", "Pickup at Cape Town International"],
    faqs: [
      { q: "Can I drive to Namibia or Botswana?", a: "Yes, with a cross-border letter from us. Ask when you book: it takes two working days." },
      IDP_FAQ
    ],
    hours: week("07:30", "18:00", true),
    cancellation: EU_CANCEL,
    requirements: "Drivers must be 23 or over, with a credit card in their name.",
    vehicles: [
      vehicle("fo-polo", "Volkswagen Polo Vivo", "car", { day: 450, week: 2700, month: 9500 }, { color: "White", details: ["Manual", "Petrol", "5 seats"], deposit: 3000 }),
      vehicle("fo-corolla", "Toyota Corolla", "car", { day: 690, week: 4140, month: 14500 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 4000, ...withPhoto("toyota-corolla") }),
      vehicle("fo-ranger", "Ford Ranger double cab", "car", { day: 1050, week: 6300 }, { color: "Grey", details: ["Automatic", "Diesel", "4x4", "5 seats"], deposit: 6000 }),
      vehicle("fo-pajero", "Mitsubishi Pajero Sport", "car", { day: 1150, week: 6900 }, { color: "White", details: ["Automatic", "Diesel", "7 seats"], deposit: 6000, ...withPhoto("mitsubishi-pajero-sport") }),
      vehicle("fo-vespa", "Vespa Primavera 125", "scooter", { day: 450, week: 2700 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 2500, ...withPhoto("vespa-vxl") })
    ],
    extras: [
      { id: "fo-x1", name: "Cross-border letter", price: 950, per: "rental", kind: "car", preset: "cross_border", countries: "Namibia, Botswana" },
      { id: "fo-x2", name: "Super waiver", price: 180, per: "day", kind: "all", preset: "damage_waiver", excess: 2500 }
    ],
    areas: [
      { name: "Cape Town City Bowl", radiusKm: 10 },
      { name: "Cape Town International Airport", radiusKm: null }
    ],
    excess: 15000,
    pay: ["card", "bank_transfer"]
  }),
  demo({
    id: "block",
    template: "block",
    name: "Block Rentals",
    brand: "#1f3fff",
    place: "Berlin",
    currency: "EUR",
    hero: art("grid"),
    about: null,
    highlights: ["Cars, scooters and cargo bikes", "Green zone sticker on every car", "Open seven days", "No paperwork at pickup"],
    faqs: [EU_SCOOTER_FAQ, { q: "Can I drive into the low emission zone?", a: "Yes. Every car has the green environmental sticker for Berlin's Umweltzone." }],
    hours: week("08:00", "22:00", true),
    cancellation: "Free cancellation up to 24 hours before pickup.",
    vehicles: [
      vehicle("bl-yaris", "Toyota Yaris", "car", { day: 49, week: 290, month: 890 }, { color: "Black", details: ["Manual", "Petrol", "5 seats"], deposit: 300, ...withPhoto("toyota-yaris") }),
      vehicle("bl-500e", "Fiat 500e", "car", { day: 55, week: 330, month: 990 }, { color: "Blue", details: ["Electric", "Automatic", "4 seats"], deposit: 300 }),
      vehicle("bl-golf", "Volkswagen Golf", "car", { day: 59, week: 350, month: 1090 }, { color: "Grey", details: ["Manual", "Petrol", "5 seats"], deposit: 400 }),
      vehicle("bl-vespa", "Vespa Primavera 125", "scooter", { day: 39, week: 230, month: 650 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 300, ...withPhoto("vespa-vxl") }),
      vehicle("bl-cargo", "Electric cargo bike", "ebike", { day: 45, week: 260 }, { color: "Black", details: ["Electric", "Fits 2 kids"], deposit: 200 })
    ],
    extras: [{ id: "bl-x1", name: "Damage waiver", price: 11, per: "day", kind: "all", preset: "damage_waiver", excess: 300 }],
    areas: [{ name: "Berlin", radiusKm: 10 }],
    excess: 1000,
    pay: ["card"]
  }),
  demo({
    id: "amber",
    template: "amber",
    name: "Amber House Rentals",
    brand: "#7a2e4d",
    place: "Tuscany",
    currency: "EUR",
    hero: car("am-corolla"),
    about: car("am-vespa"),
    highlights: ["Delivered to your agriturismo", "Maps that mark the ZTL zones", "Wine-route ideas from us", "Child seats on request"],
    faqs: [
      { q: "What is a ZTL?", a: "A limited traffic zone in a town center. Driving in without a permit brings a fine, so our maps show where they are." },
      EU_SCOOTER_FAQ
    ],
    hours: week("08:30", "19:00", true),
    cancellation: EU_CANCEL,
    vehicles: [
      vehicle("am-500", "Fiat 500", "car", { day: 45, week: 270 }, { color: "Cream", details: ["Manual", "Hybrid", "4 seats"], deposit: 400 }),
      vehicle("am-panda", "Fiat Panda 4x4", "car", { day: 55, week: 330 }, { color: "Green", details: ["Manual", "Petrol", "4x4", "5 seats"], deposit: 400 }),
      vehicle("am-yaris", "Toyota Yaris", "car", { day: 52, week: 310 }, { color: "Black", details: ["Automatic", "Hybrid", "5 seats"], deposit: 400, ...withPhoto("toyota-yaris") }),
      vehicle("am-corolla", "Toyota Corolla Touring Sports", "car", { day: 69, week: 410 }, { color: "White", details: ["Automatic", "Hybrid", "5 seats"], deposit: 500, ...withPhoto("toyota-corolla") }),
      vehicle("am-tonale", "Alfa Romeo Tonale", "car", { day: 95, week: 570 }, { color: "Red", details: ["Automatic", "Hybrid", "5 seats"], deposit: 800 }),
      vehicle("am-vespa", "Vespa Primavera 125", "scooter", { day: 55, week: 330 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 400, ...withPhoto("vespa-vxl") })
    ],
    extras: [
      { id: "am-x1", name: "Delivery to your villa", price: 30, per: "rental", kind: "all" },
      { id: "am-x2", name: "Collision damage waiver (CDW)", price: 15, per: "day", kind: "all", preset: "damage_waiver", excess: 300 }
    ],
    areas: [{ name: "Siena", radiusKm: 40 }],
    excess: 1200,
    pay: ["card"]
  }),
  demo({
    id: "neon",
    template: "neon",
    name: "Neon Nights Rentals",
    brand: "#ff2bd6",
    place: "Seoul",
    currency: "KRW",
    hero: art("city"),
    about: null,
    highlights: ["Pickup at Incheon Airport or Gangnam", "Hi-pass toll card in every car", "English navigation", "Late returns until midnight"],
    faqs: [
      IDP_FAQ,
      { q: "How do tolls work?", a: "Every car has a Hi-pass card for expressway tolls. We bill what you used when you return." }
    ],
    hours: week("08:00", "23:59", true),
    cancellation: "Free cancellation up to 24 hours before pickup.",
    requirements: "Drivers must be 21 or over, with a license held for at least a year.",
    vehicles: [
      vehicle("nn-avante", "Hyundai Avante", "car", { day: 75000, week: 450000 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 300000 }),
      vehicle("nn-k5", "Kia K5", "car", { day: 95000, week: 570000 }, { color: "Grey", details: ["Automatic", "Hybrid", "5 seats"], deposit: 300000 }),
      vehicle("nn-ioniq5", "Hyundai Ioniq 5", "car", { day: 120000, week: 720000 }, { color: "Silver", details: ["Electric", "450 km range", "5 seats"], deposit: 500000 }),
      vehicle("nn-carnival", "Kia Carnival", "van", { day: 150000, week: 900000 }, { color: "Black", details: ["Automatic", "Diesel", "9 seats"], deposit: 500000 }),
      vehicle("nn-g80", "Genesis G80", "car", { day: 190000, week: 1140000 }, { color: "Black", details: ["Automatic", "Petrol", "5 seats"], deposit: 1000000 })
    ],
    extras: [{ id: "nn-x1", name: "Full insurance", price: 25000, per: "day", kind: "car", preset: "damage_waiver", excess: 0 }],
    areas: [
      { name: "Gangnam, Seoul", radiusKm: null },
      { name: "Incheon International Airport", radiusKm: null }
    ],
    excess: 500000,
    pay: ["card"]
  })
];

/** The country each example is in, for rovehq.io/booking-pages ("Algarve, Portugal"). */
const COUNTRY: Record<string, string> = {
  saltwater: "Portugal",
  redline: "Portugal",
  northpoint: "Colorado, USA",
  lagoon: "Indonesia",
  riviera: "France",
  reef: "Mexico",
  swell: "Australia",
  pier: "Greece",
  villa: "Spain",
  metro: "UK",
  runway: "UAE",
  noir: "Florida, USA",
  trail: "New Zealand",
  dolce: "Italy",
  haven: "Florida, USA",
  nomad: "Colombia",
  volt: "Netherlands",
  roam: "Iceland",
  washi: "Japan",
  fjord: "Norway",
  folio: "South Africa",
  block: "Germany",
  amber: "Italy",
  neon: "South Korea"
};

/** Where an example is, in English: "Algarve, Portugal", "Canggu, Bali, Indonesia". */
export function demoWhere(demo: SiteDemo) {
  return [demo.place, COUNTRY[demo.id]].filter(Boolean).join(", ");
}

/** A demo by its id: one of the three showcase businesses, or a template's own example. */
export function siteDemo(id: string) {
  return SITE_DEMOS.find((demo) => demo.id === id) || templateDemo(id);
}

/** The original example each phase 1 template is shown with. */
const ORIGINAL: Partial<Record<TemplateId, string>> = { coast: "saltwater", moto: "redline", summit: "northpoint" };

/** The example business a template is shown with: /rent/demo/<template id>. */
export function templateDemo(id: string): SiteDemo | null {
  if (!isTemplateId(id)) return null;
  if (ORIGINAL[id]) return SITE_DEMOS.find((demo) => demo.id === ORIGINAL[id]) || null;
  return TEMPLATE_DEMOS.find((demo) => demo.config.template === id) || null;
}

type Say = (key: string, values?: Record<string, string | number>) => string;

/** A demo as the page's data, built the same way as a real business's. */
export function demoSiteData(demo: SiteDemo, input: { t: Say; rates: Record<string, number>; visitorCurrency: string | null; today: string }): SiteData {
  return {
    slug: `demo-${demo.id}`,
    business: { name: demo.name, logoUrl: null, place: demo.place, address: demo.address, phone: demo.phone, email: "", whatsapp: "", line: "", currency: demo.currency, social: {} },
    brandColour: demo.brandColour,
    vehicles: demo.vehicles,
    catalog: {
      currency: demo.currency,
      deposit: 0,
      holdHours: 24,
      gapDays: 0,
      today: input.today,
      offer: demo.offer,
      seasons: [],
      extras: demo.extras,
      rates: input.rates,
      visitorCurrency: input.visitorCurrency,
      initialStart: null,
      initialEnd: null,
      initialVehicleId: null,
      source: null,
      referrer: null
    },
    policies: buildPolicies(
      {
        currency: demo.currency,
        deposits: demo.vehicles.map((item) => item.deposit),
        insuranceExcess: demo.insuranceExcess,
        extras: demo.extras,
        areas: demo.areas,
        paymentMethods: demo.paymentMethods,
        holdHours: 24,
        notes: demo.config.policyNotes
      },
      input.t
    ),
    areas: demo.areas,
    reviews: [],
    reviewStats: { average: 0, count: 0 },
    googleReviewsUrl: null,
    uploads: {},
    demo: true
  };
}
