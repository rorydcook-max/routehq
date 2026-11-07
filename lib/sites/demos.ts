import type { CatalogVehicle } from "@/lib/public-catalog";
import type { Extra } from "@/lib/price-rules";
import { siteConfigFrom, type SiteConfig } from "@/lib/sites/config";
import type { ArtId, ImageRef } from "@/lib/sites/images";
import { buildPolicies } from "@/lib/sites/policies";
import { isTemplateId, type TemplateId } from "@/lib/sites/templates";
import type { SiteArea, SiteData } from "@/lib/sites/types";

/**
 * Example websites for rovehq.io/booking-pages (Rory, 7 Nov 2026), one per template. Made-up businesses drawn from
 * this file through the same components as a real site: nothing is in the database, so they never appear on
 * rove.rent, in the directory, the partner network or a sitemap. Each is named "Demo: ..." and the page says it is an
 * example. There are no reviews (reviews are never made up), and booking and the contact form are switched off.
 */

export type SiteDemo = {
  id: string;
  name: string;
  brandColour: string;
  place: string;
  currency: string;
  address: string;
  config: SiteConfig;
  vehicles: CatalogVehicle[];
  extras: Extra[];
  areas: SiteArea[];
  insuranceExcess: number;
  paymentMethods: string[];
  offer: string;
};

const photo = (file: string) => `/site/vehicles/${file}.webp`;
const withPhoto = (file: string) => ({ photoUrl: photo(file), photoUrls: [photo(file)] });
const week = (open: string, close: string, sunday: boolean) => [...Array.from({ length: 6 }, () => ({ open, close })), sunday ? { open, close } : null];

function vehicle(id: string, name: string, kind: CatalogVehicle["kind"], rates: { day?: number; week?: number; month?: number }, extra: Partial<CatalogVehicle> = {}): CatalogVehicle {
  return { id, name, year: 2024, color: null, kind, photoUrl: null, photoUrls: [], details: [], dailyRate: rates.day || 0, weeklyRate: rates.week || 0, monthlyRate: rates.month || 0, deposit: 0, busy: [], ...extra };
}

export const SITE_DEMOS: SiteDemo[] = [
  {
    id: "saltwater",
    name: "Demo: Saltwater Rentals",
    brandColour: "#1f6f8b",
    place: "Lamai Beach",
    currency: "THB",
    address: "",
    offer: "both_dates",
    config: siteConfigFrom({
      template: "coast",
      images: { hero: { kind: "art", id: "tide" }, about: { kind: "vehicle", vehicleId: "demo-sw2" } },
      highlights: ["Delivered to your villa", "Child seats on request", "Helmets in every size", "Help on the phone, day and night"],
      faqs: [
        { q: "What do I need to bring?", a: "Your passport and a driving license that covers the vehicle. An international driving permit is best." },
        { q: "Can you deliver to my hotel?", a: "Yes, anywhere within 15 km of the shop. Further out, ask us first." }
      ],
      hours: week("08:00", "19:00", true),
      policyNotes: { cancellation: "Free cancellation up to 48 hours before pickup.", requirements: "" },
      text: { "about.body": "A small, made-up rental shop used to show the Coast template. The cars, scooters and prices are examples, and nothing here can be booked." }
    }),
    vehicles: [
      vehicle("demo-sw1", "Toyota Yaris", "car", { day: 950, week: 5900, month: 16500 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 5000, ...withPhoto("toyota-yaris") }),
      vehicle("demo-sw2", "Toyota Corolla Altis", "car", { day: 1250, week: 7800, month: 22000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 5000, ...withPhoto("toyota-corolla") }),
      vehicle("demo-sw3", "Vespa VXL 150", "scooter", { day: 450, week: 2700, month: 7500 }, { color: "Mint", details: ["Automatic", "150cc"], deposit: 3000, ...withPhoto("vespa-vxl") }),
      vehicle("demo-sw4", "Mitsubishi Pajero Sport", "car", { day: 1850, week: 11800, month: 36000 }, { color: "Grey", details: ["Automatic", "Diesel", "7 seats"], deposit: 10000, ...withPhoto("mitsubishi-pajero-sport") }),
      vehicle("demo-sw5", "Honda Click 125", "scooter", { day: 250, week: 1500, month: 3500 }, { color: "White", details: ["Automatic", "125cc"], deposit: 2000 })
    ],
    extras: [
      { id: "d1", name: "Child seat", price: 100, per: "day", kind: "car" },
      { id: "d2", name: "Damage waiver", price: 200, per: "day", kind: "all", preset: "damage_waiver", excess: 3000 }
    ],
    areas: [{ name: "Lamai Beach", radiusKm: 15 }],
    insuranceExcess: 10000,
    paymentMethods: ["cash", "promptpay", "bank_transfer"]
  },
  {
    id: "redline",
    name: "Demo: Redline Moto",
    brandColour: "#e4572e",
    place: "Chiang Mai",
    currency: "THB",
    address: "",
    offer: "both_dates",
    config: siteConfigFrom({
      template: "moto",
      images: { hero: { kind: "vehicle", vehicleId: "demo-rl1" }, about: null },
      highlights: ["Two helmets with every bike", "Phone mount on request", "Free pickup in the Old City", "Roadside help, day and night"],
      faqs: [
        { q: "Do I need a motorbike license?", a: "Yes. Bring a motorcycle license or an international driving permit that covers motorcycles." },
        { q: "Is fuel included?", a: "Bikes go out with a full tank. Bring them back full, or pay for the fuel used." }
      ],
      hours: week("08:00", "20:00", true),
      social: { whatsapp: "", line: "", facebook: "", instagram: "", tiktok: "" },
      text: { "about.body": "A made-up scooter and motorbike shop used to show the Moto template. Every bike and price here is an example." }
    }),
    vehicles: [
      vehicle("demo-rl1", "Vespa VXL 150", "scooter", { day: 450, week: 2700, month: 7500 }, { color: "Mint", details: ["Automatic", "150cc"], deposit: 5000, ...withPhoto("vespa-vxl") }),
      vehicle("demo-rl2", "Honda Click 125", "scooter", { day: 250, week: 1500, month: 3500 }, { color: "White", details: ["Automatic", "125cc"], deposit: 2000 }),
      vehicle("demo-rl3", "Yamaha NMAX 155", "scooter", { day: 350, week: 2100, month: 5000 }, { color: "Black", details: ["Automatic", "155cc"], deposit: 3000 }),
      vehicle("demo-rl4", "Honda PCX 160", "scooter", { day: 400, week: 2400, month: 6000 }, { color: "Red", details: ["Automatic", "160cc"], deposit: 3000 }),
      vehicle("demo-rl5", "Honda CB500X", "motorbike", { day: 1400, week: 8800 }, { color: "Red", details: ["Manual", "500cc"], deposit: 10000 }),
      vehicle("demo-rl6", "Kawasaki Versys 650", "motorbike", { day: 1600, week: 9900 }, { color: "Green", details: ["Manual", "650cc"], deposit: 10000 })
    ],
    extras: [{ id: "r1", name: "Young rider", price: 50, per: "day", kind: "bike", preset: "young_driver", minAge: 21 }],
    areas: [{ name: "Old City", radiusKm: 5 }],
    insuranceExcess: 5000,
    paymentMethods: ["cash", "promptpay"]
  },
  {
    id: "northpoint",
    name: "Demo: Northpoint Car Hire",
    brandColour: "#1e3a8a",
    place: "Phuket",
    currency: "THB",
    address: "",
    offer: "both_monthly",
    config: siteConfigFrom({
      template: "summit",
      images: { hero: { kind: "vehicle", vehicleId: "demo-np3" }, about: { kind: "vehicle", vehicleId: "demo-np2" } },
      highlights: ["Meet and greet at the airport", "Insurance on every car", "Monthly rates for long stays", "No hidden fees"],
      faqs: [
        { q: "Can I return the car somewhere else?", a: "Yes, anywhere on the island for a small fee." },
        { q: "Do you rent by the month?", a: "Yes. Choose Monthly when you book; the price renews each month until you give notice." }
      ],
      hours: week("08:30", "18:30", false),
      policyNotes: { cancellation: "Free cancellation up to 24 hours before pickup.", requirements: "Drivers must be 21 or over." },
      text: { "about.body": "A made-up car hire business used to show the Summit template. The cars and prices are examples only." }
    }),
    vehicles: [
      vehicle("demo-np1", "Toyota Yaris Ativ", "car", { day: 900, week: 5600, month: 15500 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 5000, ...withPhoto("toyota-yaris") }),
      vehicle("demo-np2", "Toyota Corolla Altis", "car", { day: 1200, week: 7500, month: 21000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 5000, ...withPhoto("toyota-corolla") }),
      vehicle("demo-np3", "Mitsubishi Pajero Sport", "car", { day: 1800, week: 11500, month: 34000 }, { color: "Grey", details: ["Automatic", "Diesel", "7 seats"], deposit: 10000, ...withPhoto("mitsubishi-pajero-sport") }),
      vehicle("demo-np4", "Honda City", "car", { day: 950, week: 5900, month: 16500 }, { color: "Blue", details: ["Automatic", "Petrol", "5 seats"], deposit: 5000 }),
      vehicle("demo-np5", "Toyota Fortuner", "car", { day: 2000, week: 12800, month: 38000 }, { color: "Black", details: ["Automatic", "Diesel", "7 seats"], deposit: 15000 }),
      vehicle("demo-np6", "Toyota Hiace Commuter", "van", { day: 2400, week: 15000 }, { color: "White", details: ["Manual", "12 seats"], deposit: 15000 })
    ],
    extras: [{ id: "n1", name: "Airport delivery", price: 500, per: "rental", kind: "car" }],
    areas: [
      { name: "Phuket Town", radiusKm: 30 },
      { name: "Phuket Airport", radiusKm: null }
    ],
    insuranceExcess: 8000,
    paymentMethods: ["cash", "bank_transfer", "card"]
  }
];

export function siteDemo(id: string) {
  return SITE_DEMOS.find((demo) => demo.id === id) || templateDemo(id);
}

/*
 * Template previews (sites2): every template can be opened as an example at /rent/demo/<template id>, and its gallery
 * picture (public/site/templates/<id>.webp, scripts/site-template-previews.mjs) is taken from there. Each borrows one
 * of the three demo businesses above with its own made-up name, place and brand colour; a few bring their own fleet
 * (no photos for those: the vehicle drawings stand in). Like the demos, all are labelled and nothing can be booked.
 */

const PREMIUM: CatalogVehicle[] = [
  vehicle("demo-sw4", "Mitsubishi Pajero Sport", "car", { day: 2400, week: 15500, month: 45000 }, { color: "Grey", details: ["Automatic", "Diesel", "7 seats"], deposit: 20000, ...withPhoto("mitsubishi-pajero-sport") }),
  vehicle("demo-px1", "Mercedes-Benz E 300", "car", { day: 4800, week: 30000, month: 85000 }, { color: "Black", details: ["Automatic", "Petrol", "5 seats"], deposit: 30000 }),
  vehicle("demo-px2", "BMW X5 xDrive45e", "car", { day: 6500, week: 41000, month: 115000 }, { color: "White", details: ["Automatic", "Plug-in hybrid", "5 seats"], deposit: 40000 }),
  vehicle("demo-px3", "Toyota Alphard", "van", { day: 5200, week: 33000 }, { color: "Black", details: ["Automatic", "Chauffeur on request", "7 seats"], deposit: 30000 }),
  vehicle("demo-sw2", "Toyota Corolla Altis", "car", { day: 1450, week: 9000, month: 26000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 10000, ...withPhoto("toyota-corolla") })
];
const ELECTRIC: CatalogVehicle[] = [
  vehicle("demo-sw2", "Toyota Corolla Altis Hybrid", "car", { day: 1250, week: 7800, month: 22000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 5000, ...withPhoto("toyota-corolla") }),
  vehicle("demo-ev1", "BYD Atto 3", "car", { day: 1600, week: 10000, month: 29000 }, { color: "Blue", details: ["Electric", "420 km range", "5 seats"], deposit: 10000 }),
  vehicle("demo-ev2", "MG4 Electric", "car", { day: 1400, week: 8800, month: 25000 }, { color: "White", details: ["Electric", "350 km range", "5 seats"], deposit: 10000 }),
  vehicle("demo-ev3", "Tesla Model 3", "car", { day: 2600, week: 16500, month: 48000 }, { color: "Red", details: ["Electric", "510 km range", "5 seats"], deposit: 20000 }),
  vehicle("demo-ev4", "NIU MQi GT", "ebike", { day: 350, week: 2100, month: 5500 }, { color: "Grey", details: ["Electric", "70 km range"], deposit: 3000 })
];
const CAMPERS: CatalogVehicle[] = [
  vehicle("demo-cv1", "Toyota Hiace Camper", "van", { day: 3200, week: 20000 }, { color: "White", details: ["Manual", "Sleeps 2", "Kitchen"], deposit: 20000 }),
  vehicle("demo-cv2", "Volkswagen California", "van", { day: 4200, week: 26500 }, { color: "Blue", details: ["Automatic", "Sleeps 4", "Pop-up roof"], deposit: 25000 }),
  vehicle("demo-cv3", "Isuzu D-Max with roof tent", "car", { day: 2200, week: 13800 }, { color: "Orange", details: ["Manual", "4x4", "Sleeps 2"], deposit: 15000 }),
  vehicle("demo-sw4", "Mitsubishi Pajero Sport", "car", { day: 1850, week: 11800, month: 36000 }, { color: "Grey", details: ["Automatic", "Diesel", "7 seats"], deposit: 10000, ...withPhoto("mitsubishi-pajero-sport") })
];
const ADVENTURE: CatalogVehicle[] = [
  vehicle("demo-tr1", "Honda CRF300L", "motorbike", { day: 1100, week: 6900 }, { color: "Red", details: ["Manual", "300cc", "Off-road"], deposit: 10000 }),
  vehicle("demo-tr2", "Royal Enfield Himalayan 450", "motorbike", { day: 1500, week: 9500 }, { color: "Sand", details: ["Manual", "450cc", "Adventure"], deposit: 15000 }),
  vehicle("demo-tr3", "Kawasaki KLX230", "motorbike", { day: 900, week: 5600 }, { color: "Green", details: ["Manual", "230cc", "Off-road"], deposit: 8000 }),
  vehicle("demo-rl5", "Honda CB500X", "motorbike", { day: 1400, week: 8800 }, { color: "Red", details: ["Manual", "500cc"], deposit: 10000 }),
  vehicle("demo-rl6", "Kawasaki Versys 650", "motorbike", { day: 1600, week: 9900 }, { color: "Green", details: ["Manual", "650cc"], deposit: 10000 })
];
const CLASSICS: CatalogVehicle[] = [
  vehicle("demo-rl1", "Vespa VXL 150", "scooter", { day: 550, week: 3300, month: 9000 }, { color: "Mint", details: ["Automatic", "150cc"], deposit: 5000, ...withPhoto("vespa-vxl") }),
  vehicle("demo-dv1", "Vespa Primavera 125", "scooter", { day: 600, week: 3600, month: 9500 }, { color: "Cream", details: ["Automatic", "125cc"], deposit: 5000 }),
  vehicle("demo-dv2", "Lambretta V200 Special", "scooter", { day: 700, week: 4200 }, { color: "Red", details: ["Automatic", "200cc"], deposit: 6000 }),
  vehicle("demo-dv3", "Royal Alloy GP150", "scooter", { day: 500, week: 3000 }, { color: "Blue", details: ["Automatic", "150cc"], deposit: 5000 }),
  vehicle("demo-dv4", "Vespa GTS 300", "scooter", { day: 900, week: 5400 }, { color: "Grey", details: ["Automatic", "300cc"], deposit: 8000 })
];
const MONTHLY: CatalogVehicle[] = [
  vehicle("demo-np2", "Toyota Corolla Altis", "car", { month: 21000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 10000, ...withPhoto("toyota-corolla") }),
  vehicle("demo-np1", "Toyota Yaris Ativ", "car", { month: 15500 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 8000, ...withPhoto("toyota-yaris") }),
  vehicle("demo-np3", "Mitsubishi Pajero Sport", "car", { month: 34000 }, { color: "Grey", details: ["Automatic", "Diesel", "7 seats"], deposit: 15000, ...withPhoto("mitsubishi-pajero-sport") }),
  vehicle("demo-nm1", "Honda City", "car", { month: 16500 }, { color: "Blue", details: ["Automatic", "Petrol", "5 seats"], deposit: 8000 }),
  vehicle("demo-nm2", "Honda Click 125", "scooter", { month: 3500 }, { color: "White", details: ["Automatic", "125cc"], deposit: 2000 }),
  vehicle("demo-nm3", "Yamaha NMAX 155", "scooter", { month: 5000 }, { color: "Black", details: ["Automatic", "155cc"], deposit: 3000 })
];

type Preview = { base: "saltwater" | "redline" | "northpoint"; name: string; place: string; brand: string; hero: ImageRef | null; about?: ImageRef | null; vehicles?: CatalogVehicle[]; offer?: string };
const art = (id: ArtId): ImageRef => ({ kind: "art", id });
const car = (vehicleId: string): ImageRef => ({ kind: "vehicle", vehicleId });

const PREVIEWS: Partial<Record<TemplateId, Preview>> = {
  lagoon: { base: "saltwater", name: "Green Lagoon Rentals", place: "Koh Phangan", brand: "#2f7d5b", hero: art("palms"), about: car("demo-sw2") },
  riviera: { base: "saltwater", name: "Riviera Car & Vespa", place: "Koh Samet", brand: "#1d5fa8", hero: art("arches"), about: car("demo-sw3") },
  reef: { base: "redline", name: "Reef Scooters", place: "Koh Lanta", brand: "#f0573b", hero: art("sun"), about: null },
  swell: { base: "saltwater", name: "Swell Surf Rentals", place: "Kata Beach", brand: "#e2711d", hero: car("demo-sw3"), about: null },
  pier: { base: "saltwater", name: "Pier 9 Rentals", place: "Koh Tao", brand: "#1b3a6b", hero: car("demo-sw1"), about: car("demo-sw3") },
  villa: { base: "saltwater", name: "Villa Drive Collection", place: "Koh Samui", brand: "#8a6d3b", hero: car("demo-sw4"), about: car("demo-sw2"), vehicles: PREMIUM },
  metro: { base: "northpoint", name: "Metro Car Rental", place: "Bangkok", brand: "#2b59ff", hero: art("city"), about: null },
  runway: { base: "northpoint", name: "Runway Airport Cars", place: "Phuket Airport", brand: "#f2b705", hero: car("demo-np1"), about: null },
  noir: { base: "saltwater", name: "Noir Prestige Cars", place: "Bangkok", brand: "#c9a96e", hero: car("demo-sw4"), about: null, vehicles: PREMIUM },
  trail: { base: "redline", name: "High Trail Moto", place: "Mae Hong Son", brand: "#d9822b", hero: art("peaks"), about: null, vehicles: ADVENTURE },
  dolce: { base: "redline", name: "Dolce Vespa Club", place: "Hua Hin", brand: "#c0392b", hero: car("demo-rl1"), about: art("sun"), vehicles: CLASSICS },
  haven: { base: "northpoint", name: "Haven Family Cars", place: "Rayong", brand: "#3a86ff", hero: car("demo-np3"), about: car("demo-np2") },
  nomad: { base: "northpoint", name: "Nomad Monthly Rentals", place: "Chiang Mai", brand: "#5f6b3a", hero: car("demo-np2"), about: null, vehicles: MONTHLY, offer: "monthly" },
  volt: { base: "northpoint", name: "Volt EV Rentals", place: "Bangkok", brand: "#0f9f5f", hero: car("demo-sw2"), about: null, vehicles: ELECTRIC },
  roam: { base: "northpoint", name: "Roam Campervans", place: "Chiang Rai", brand: "#b5562f", hero: art("peaks"), about: null, vehicles: CAMPERS },
  washi: { base: "saltwater", name: "Washi Rentals", place: "Pai", brand: "#b7282e", hero: art("ripple"), about: null },
  fjord: { base: "northpoint", name: "Fjord Car Hire", place: "Udon Thani", brand: "#d7141a", hero: car("demo-np1"), about: car("demo-np3") },
  folio: { base: "saltwater", name: "Folio Rentals", place: "Krabi", brand: "#7b2d26", hero: car("demo-sw3"), about: null },
  block: { base: "saltwater", name: "Block Rentals", place: "Khon Kaen", brand: "#1f3fff", hero: art("grid"), about: null },
  amber: { base: "saltwater", name: "Amber House Rentals", place: "Koh Chang", brand: "#7a2e4d", hero: car("demo-sw2"), about: car("demo-sw3") },
  neon: { base: "saltwater", name: "Neon Nights Rentals", place: "Pattaya", brand: "#ff2bd6", hero: art("city"), about: null }
};

/** The original example each phase 1 template is shown with. */
const ORIGINAL: Partial<Record<TemplateId, string>> = { coast: "saltwater", moto: "redline", summit: "northpoint" };

/** The example business a template is shown with: /rent/demo/<template id>. */
export function templateDemo(id: string): SiteDemo | null {
  if (!isTemplateId(id)) return null;
  if (ORIGINAL[id]) return SITE_DEMOS.find((demo) => demo.id === ORIGINAL[id]) || null;
  const preview = PREVIEWS[id];
  const base = preview && SITE_DEMOS.find((demo) => demo.id === preview.base);
  if (!preview || !base) return null;
  const name = id.charAt(0).toUpperCase() + id.slice(1);
  const vehicles = preview.vehicles || base.vehicles;
  return {
    ...base,
    id,
    name: `Demo: ${preview.name}`,
    place: preview.place,
    brandColour: preview.brand,
    offer: preview.offer || base.offer,
    vehicles,
    areas: base.areas.map((area, index) => (index === 0 ? { ...area, name: preview.place } : area)).filter((area, index, list) => list.findIndex((other) => other.name === area.name) === index),
    config: siteConfigFrom({
      ...base.config,
      template: id,
      images: { hero: preview.hero, about: preview.about === undefined ? base.config.images.about : preview.about },
      text: { "about.body": `A made-up rental business used to show the ${name} template. Every vehicle and price here is an example, and nothing can be booked.` }
    })
  };
}

type Say = (key: string, values?: Record<string, string | number>) => string;

/** A demo as the page's data, built the same way as a real business's. */
export function demoSiteData(demo: SiteDemo, input: { t: Say; rates: Record<string, number>; visitorCurrency: string | null; today: string }): SiteData {
  return {
    slug: `demo-${demo.id}`,
    business: { name: demo.name, logoUrl: null, place: demo.place, address: demo.address, phone: "", email: "", whatsapp: "", line: "", currency: demo.currency, social: {} },
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
