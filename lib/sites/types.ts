import type { CatalogVehicle } from "@/lib/public-catalog";
import type { Extra, Season } from "@/lib/price-rules";
import type { SiteSocial } from "@/lib/sites/config";

/**
 * Everything a website shows that comes from RoveHQ rather than from the site's own config: the business, its
 * vehicles and booking settings, its policies (worked out from Settings), service areas and real reviews.
 * Built on the server (lib/sites/data.ts, or lib/sites/demos.ts for the examples) and handed to the page as is.
 */

export type SiteBusiness = {
  name: string;
  logoUrl: string | null;
  /** Their town or area ("Koh Samui"), for headlines. */
  place: string;
  address: string;
  phone: string;
  email: string;
  whatsapp: string;
  line: string;
  currency: string;
  /** How customers reach them on social apps (Settings › Business): the site's own social links win over these. */
  social: Partial<SiteSocial>;
};

/** A policy line block, already in the renter's language. */
export type SitePolicy = { id: "delivery" | "deposit" | "insurance" | "requirements" | "payment" | "cancellation"; title: string; lines: string[] };

export type SiteArea = { name: string; radiusKm: number | null };

/** A review a renter left through RoveHQ and the business published. Never made up. */
export type SiteReview = { id: string; rating: number; body: string; name: string; date: string | null; country: string | null; vehicle: string | null; reply: string | null };

export type SiteCatalog = {
  currency: string;
  deposit: number;
  holdHours: number;
  gapDays: number;
  today: string;
  offer: string;
  seasons: Season[];
  extras: Extra[];
  rates: Record<string, number>;
  visitorCurrency: string | null;
  initialStart: string | null;
  initialEnd: string | null;
  initialVehicleId: string | null;
  source: string | null;
  referrer: string | null;
};

export type SiteData = {
  slug: string;
  business: SiteBusiness;
  brandColour: string | null;
  vehicles: CatalogVehicle[];
  catalog: SiteCatalog;
  policies: SitePolicy[];
  areas: SiteArea[];
  reviews: SiteReview[];
  /** All published reviews (the list shows only the latest few). */
  reviewStats: { average: number; count: number };
  /** The Google review link from the Reviews page: shown when there are no reviews yet. */
  googleReviewsUrl: string | null;
  /** Signed URLs for uploaded images, by storage path. */
  uploads: Record<string, string>;
  /** An example business (rovehq.io/booking-pages): labelled, and booking is off. */
  demo: boolean;
};
