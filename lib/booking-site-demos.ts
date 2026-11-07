import { bookingSiteFrom, type BookingSite } from "@/lib/booking-site";
import type { CatalogVehicle } from "@/lib/public-catalog";

/**
 * Example booking pages for rovehq.io/booking-pages (Rory, 7 Nov 2026). Made-up businesses drawn from this file
 * through the same template components as a real page: nothing is in the database, so they can never appear on
 * rove.rent, in the directory, the partner network or a sitemap. Every one is called "Demo: ..." and says it is an
 * example; there are no reviews, no social accounts and no phone numbers, because none of them exist.
 */

export type BookingDemo = {
  id: string;
  name: string;
  brandColour: string;
  currency: string;
  location: string;
  heroUrl: string | null;
  site: BookingSite;
  vehicles: CatalogVehicle[];
};

const photo = (file: string) => `/site/vehicles/${file}.webp`;

function vehicle(id: string, name: string, kind: CatalogVehicle["kind"], rates: { day?: number; week?: number; month?: number }, extra: Partial<CatalogVehicle> = {}): CatalogVehicle {
  return {
    id,
    name,
    year: 2024,
    color: null,
    kind,
    photoUrl: null,
    photoUrls: [],
    details: [],
    dailyRate: rates.day || 0,
    weeklyRate: rates.week || 0,
    monthlyRate: rates.month || 0,
    deposit: 0,
    busy: [],
    ...extra
  };
}

const withPhoto = (file: string) => ({ photoUrl: photo(file), photoUrls: [photo(file)] });
const weekdays = (open: string, close: string, sunday: boolean) => [...Array.from({ length: 6 }, () => ({ open, close })), sunday ? { open, close } : null];

export const BOOKING_DEMOS: BookingDemo[] = [
  {
    id: "coastal-scooters",
    name: "Demo: Coastal Scooters",
    brandColour: "#d9480f",
    currency: "THB",
    location: "Beach road scooter hire",
    heroUrl: photo("vespa-vxl"),
    site: bookingSiteFrom({
      booking_site: {
        template: "scooter",
        headline: "Scooters for the beach and beyond",
        subline: "Helmets in every size. Pick up at the shop or have it brought to you.",
        about: "A small, made-up scooter shop used to show the Scooter shop template. Every price and vehicle here is an example.",
        why: ["Two helmets with every scooter", "Free delivery nearby", "Phone holder on request", "Help on the phone if anything goes wrong"],
        faqs: [
          { q: "Do I need a license?", a: "Yes. Bring a motorcycle license or an international driving permit that covers motorcycles." },
          { q: "Is fuel included?", a: "Scooters go out with a full tank. Bring them back full, or pay for the fuel used." }
        ],
        hours: weekdays("08:00", "20:00", true),
        off: ["map"],
        order: ["vehicles", "why", "faqs", "hours", "about"]
      }
    }),
    vehicles: [
      vehicle("demo-s1", "Honda Click 125", "scooter", { day: 250, week: 1500, month: 3500 }, { color: "White", details: ["Automatic", "125cc"], deposit: 2000 }),
      vehicle("demo-s2", "Vespa VXL 150", "scooter", { day: 450, week: 2700, month: 7500 }, { color: "Mint", details: ["Automatic", "150cc"], deposit: 5000, ...withPhoto("vespa-vxl") }),
      vehicle("demo-s3", "Yamaha NMAX 155", "scooter", { day: 350, week: 2100, month: 5000 }, { color: "Black", details: ["Automatic", "155cc"], deposit: 3000 }),
      vehicle("demo-s4", "Honda PCX 160", "scooter", { day: 400, week: 2400, month: 6000 }, { color: "Red", details: ["Automatic", "160cc"], deposit: 3000 })
    ]
  },
  {
    id: "harbor-car-hire",
    name: "Demo: Harbor Car Hire",
    brandColour: "#1d5c8a",
    currency: "THB",
    location: "Car hire by the harbor",
    heroUrl: photo("toyota-corolla"),
    site: bookingSiteFrom({
      booking_site: {
        template: "photo",
        headline: "Clean cars, ready when you land",
        subline: "Book online in two minutes. We meet you at the pier or your hotel.",
        about: "A made-up car hire business used to show the Photo-led template. The cars and prices are examples only.",
        why: ["Free child seats", "Meet and greet at the pier", "Insurance included", "No hidden fees"],
        faqs: [
          { q: "Can I return the car somewhere else?", a: "Yes, anywhere on the island for a small fee." },
          { q: "What do I need to bring?", a: "Your passport and a driving licence that is valid in Thailand." }
        ],
        hours: weekdays("08:30", "18:30", false),
        off: ["map"],
        order: ["vehicles", "why", "about", "faqs", "hours"]
      }
    }),
    vehicles: [
      vehicle("demo-c1", "Toyota Yaris", "car", { day: 900, week: 5600, month: 16000 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 5000, ...withPhoto("toyota-yaris") }),
      vehicle("demo-c2", "Toyota Corolla Altis", "car", { day: 1200, week: 7500, month: 22000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 5000, ...withPhoto("toyota-corolla") }),
      vehicle("demo-c3", "Mitsubishi Pajero Sport", "car", { day: 1800, week: 11500, month: 35000 }, { color: "Grey", details: ["Automatic", "Diesel", "7 seats"], deposit: 10000, ...withPhoto("mitsubishi-pajero-sport") })
    ]
  },
  {
    id: "long-stay-wheels",
    name: "Demo: Long Stay Wheels",
    brandColour: "#2f6b4f",
    currency: "THB",
    location: "Monthly car and scooter rentals",
    heroUrl: photo("toyota-yaris"),
    site: bookingSiteFrom({
      booking_site: {
        template: "monthly",
        headline: "Your car for the month, without the paperwork",
        subline: "One price each month. Keep it as long as you like and give two weeks' notice when you're done.",
        about: "A made-up monthly rental business used to show the Monthly rentals template. Every price here is an example.",
        why: ["One price each month", "Servicing included", "Swap cars when you need to", "Two weeks' notice to stop"],
        faqs: [
          { q: "Is there a minimum stay?", a: "One month. After that, you can stop any time with two weeks' notice." },
          { q: "How do I pay?", a: "The first month and the deposit when you pick up, then each month by bank transfer." }
        ],
        hours: weekdays("09:00", "18:00", false),
        off: ["map"],
        order: ["vehicles", "faqs", "about", "hours"]
      }
    }),
    vehicles: [
      vehicle("demo-m1", "Toyota Yaris Ativ", "car", { month: 11000 }, { color: "White", details: ["Automatic", "Petrol", "5 seats"], deposit: 10000, ...withPhoto("toyota-yaris") }),
      vehicle("demo-m2", "Honda City", "car", { month: 12500 }, { color: "Blue", details: ["Automatic", "Petrol", "5 seats"], deposit: 10000 }),
      vehicle("demo-m3", "Toyota Corolla Cross", "car", { month: 18000 }, { color: "Silver", details: ["Automatic", "Hybrid", "5 seats"], deposit: 15000, ...withPhoto("toyota-corolla") }),
      vehicle("demo-m4", "Honda Click 125", "scooter", { month: 3500 }, { color: "Black", details: ["Automatic", "125cc"], deposit: 3000 })
    ]
  },
  {
    id: "island-fleet",
    name: "Demo: Island Fleet Rentals",
    brandColour: "#5b3a9b",
    currency: "THB",
    location: "Cars, vans and scooters",
    heroUrl: null,
    site: bookingSiteFrom({
      booking_site: {
        template: "compact",
        headline: "Every vehicle we have, on one page",
        subline: "Pick your dates to see what is free. Book in two minutes.",
        about: "A made-up rental business with a bigger fleet, used to show the Compact list template. The vehicles and prices are examples.",
        faqs: [
          { q: "Can you deliver?", a: "Yes, to most hotels for a small fee." },
          { q: "Is insurance included?", a: "Basic insurance is included with every car and van." }
        ],
        hours: weekdays("08:00", "19:00", true),
        off: ["map"],
        order: ["vehicles", "faqs", "hours", "about"]
      }
    }),
    vehicles: [
      vehicle("demo-f1", "Honda Click 125", "scooter", { day: 200, week: 1200, month: 3000 }, { color: "White", details: ["Automatic"] }),
      vehicle("demo-f2", "Yamaha NMAX 155", "scooter", { day: 300, week: 1800, month: 4500 }, { color: "Grey", details: ["Automatic"] }),
      vehicle("demo-f3", "Vespa VXL 150", "scooter", { day: 450, week: 2700 }, { color: "Mint", details: ["Automatic"], ...withPhoto("vespa-vxl") }),
      vehicle("demo-f4", "Toyota Yaris", "car", { day: 850, week: 5200, month: 15000 }, { color: "Red", details: ["Automatic", "5 seats"], ...withPhoto("toyota-yaris") }),
      vehicle("demo-f5", "Toyota Corolla Altis", "car", { day: 1100, week: 7000, month: 21000 }, { color: "Silver", details: ["Automatic", "5 seats"], ...withPhoto("toyota-corolla") }),
      vehicle("demo-f6", "Mitsubishi Pajero Sport", "car", { day: 1700, week: 11000, month: 33000 }, { color: "Grey", details: ["Automatic", "7 seats"], ...withPhoto("mitsubishi-pajero-sport") }),
      vehicle("demo-f7", "Toyota Hiace Commuter", "van", { day: 2200, week: 14000 }, { color: "White", details: ["Manual", "12 seats"] }),
      vehicle("demo-f8", "Toyota Hilux Revo", "car", { day: 1300, week: 8200, month: 24000 }, { color: "Black", details: ["Automatic", "Pick-up"] })
    ]
  }
];

export function bookingDemo(id: string) {
  return BOOKING_DEMOS.find((demo) => demo.id === id) || null;
}
