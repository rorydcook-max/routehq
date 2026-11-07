/**
 * RoveHQ for each kind of rental business (SEO, 7 Nov 2026): /car-rental-software, /scooter-rental-software and
 * /motorcycle-rental-software. The words are in locales/<lang>/common.json (marketing.seg<Key>…), English first;
 * each feature links to the help article that shows it. Only features RoveHQ has today.
 * Safe to import from the proxy (no server-only imports).
 */

export type SegmentId = "car" | "scooter" | "motorcycle";

export type Segment = {
  id: SegmentId;
  path: string;
  /** Key part: marketing.seg<key>Title, seg<key>F1Title … */
  key: "Car" | "Scooter" | "Moto";
  /** The footer and cross-link label: marketing.<navKey>. */
  navKey: "navCarRental" | "navScooterRental" | "navMotorcycleRental";
  /** One help article per feature (seg<key>F1 … F6), in order. */
  features: string[];
  /** How many questions (seg<key>Q1/A1 …). */
  questions: number;
};

export const SEGMENTS: Record<SegmentId, Segment> = {
  car: {
    id: "car",
    path: "/car-rental-software",
    key: "Car",
    navKey: "navCarRental",
    features: ["online-booking-page", "handover-checks", "deposits", "booking-and-price-rules", "paperwork-and-renewals", "vehicle-report"],
    questions: 4
  },
  scooter: {
    id: "scooter",
    path: "/scooter-rental-software",
    key: "Scooter",
    navKey: "navScooterRental",
    features: ["create-a-booking", "handover-checks", "deposits", "booking-and-price-rules", "calendar", "plans-and-billing"],
    questions: 4
  },
  motorcycle: {
    id: "motorcycle",
    path: "/motorcycle-rental-software",
    key: "Moto",
    navKey: "navMotorcycleRental",
    features: ["create-a-booking", "booking-and-price-rules", "handover-checks", "service-and-maintenance", "deposits", "partners"],
    questions: 4
  }
};

export const SEGMENT_IDS = Object.keys(SEGMENTS) as SegmentId[];
