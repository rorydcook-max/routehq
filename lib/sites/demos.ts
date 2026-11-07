import type { CatalogVehicle } from "@/lib/public-catalog";
import type { Extra } from "@/lib/price-rules";
import { siteConfigFrom, type SiteConfig } from "@/lib/sites/config";
import { buildPolicies } from "@/lib/sites/policies";
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
  return SITE_DEMOS.find((demo) => demo.id === id) || null;
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
