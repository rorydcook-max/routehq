/**
 * rove.rent's destinations (task "roverent", 7 Nov 2026): one page per place at /<country>/<place>, with the live
 * vehicles of listed businesses there and a short local guide. Add a place by adding a row here (and, for a new
 * country, its rules below) and its address to lib/rove/guide-slugs.ts: the page, the sitemap, the home page's list
 * and the proxy pick it up.
 *
 * Every fact in the guides is sourced (the `sources` lists, shown on the page). Rules change: re-check these when a
 * page is edited, and leave a fact out rather than guess. Researched 7 Nov 2026.
 * No server code: the proxy imports this file.
 */

export type Source = { label: string; url: string };

export type CountryRules = {
  slug: string;
  name: string;
  /** For place-coords lookups (lib/place-coords.ts country names). */
  placeCountry: string;
  /** The rules a renter needs everywhere in the country, each with where it comes from. */
  licence: string[];
  motorbike: string[];
  helmet: string[];
  deposits: string[];
  insurance: string[];
  safety: string[];
  sources: Source[];
};

export type Destination = {
  country: string;
  slug: string;
  name: string;
  /** Province or region, as written in lib/place-coords.ts. */
  region: string;
  /** The place's name in lib/place-coords.ts, so the search can start there. */
  placeName: string;
  center: { lat: number; lng: number };
  /** A listed vehicle counts here when its home location is within this distance of the centre. */
  radiusKm: number;
  /** One or two sentences for the top of the page and the search-result snippet. */
  intro: string;
  /** Getting around: local, sourced notes. */
  gettingAround: string[];
  /** When a monthly rental makes sense here (local context; the page adds real prices). */
  monthly: string;
  sources: Source[];
};

const SRC = {
  thGov: { label: "Thailand.go.th: temporary driving licence for foreign tourists", url: "https://thailand.go.th/event-detail/001_01_226" },
  tat: { label: "Tourism Authority of Thailand: visitor information (driving)", url: "https://www.tatnews.org/?p=80727" },
  ukTh: { label: "GOV.UK foreign travel advice: Thailand", url: "https://www.gov.uk/foreign-travel-advice/thailand" },
  auTh: { label: "Smartraveller (Australian Government): Thailand", url: "https://www.smartraveller.gov.au/destinations/asia/thailand" },
  helmet: { label: "The Nation: helmet fines of up to 2,000 baht from 1 June 2025", url: "https://www.nationthailand.com/news/policy/40050536" },
  cmi: { label: "Motorist Thailand: what compulsory motor insurance (Por Ror Bor) covers", url: "https://www.motorist.co.th/en/article/5425/what-is-compulsory-motor-insurance-por-ror-bor-differences-from-voluntary-insurance" },
  ukId: { label: "GOV.UK foreign travel advice: Indonesia", url: "https://www.gov.uk/foreign-travel-advice/indonesia" },
  auId: { label: "Smartraveller (Australian Government): Indonesia", url: "https://www.smartraveller.gov.au/destinations/asia/indonesia" },
  idLeft: { label: "Expat Focus: driving in Indonesia", url: "https://www.expatfocus.com/indonesia/guide/indonesia-driving" },
  baliBan: { label: "Bali.live: governor revisits tourist motorbike rules (March 2025)", url: "https://bali.live/p/bali-governor-wayan-koster-revisits-tourist-motorbike-regulations" },
  baliChecks: { label: "InDaily / The New Daily: Bali police checks on tourist riders (May 2025)", url: "https://www.indailysa.com.au/news/in-depth/2025/05/13/bali-scooter-tourists" },
  samuiRing: { label: "The Nation: Koh Samui's 50 km ring road (Highway 4169)", url: "https://www.nationthailand.com/in-focus/40005698" },
  hw1095: { label: "Wikipedia: Highway 1095 (Chiang Mai to Pai and Mae Hong Son)", url: "https://en.wikipedia.org/wiki/Highway_1095_(Thailand)" }
} satisfies Record<string, Source>;

export const ROVE_SOURCES = SRC;

export const COUNTRIES: Record<string, CountryRules> = {
  thailand: {
    slug: "thailand",
    name: "Thailand",
    placeCountry: "Thailand",
    licence: [
      "As a visitor you need your home driving licence plus an International Driving Permit (IDP). Thailand's government lists IDPs issued under the 1949 Geneva Convention; the UK government tells UK drivers to carry the 1968 version. Get the type your licensing authority says is valid for Thailand before you travel.",
      "A driving licence from another ASEAN country is also accepted.",
      "The legal driving age is 18."
    ],
    motorbike: [
      "To ride a scooter or motorbike you need a licence that covers motorcycles. A car licence alone doesn't cover a scooter, even if a rental shop tells you otherwise.",
      "Riding without the right licence can invalidate your travel insurance, so a claim after an accident may be refused."
    ],
    helmet: [
      "Riders and passengers must both wear a helmet (Land Traffic Act, section 122). Police can fine you up to 2,000 baht, and checks were stepped up nationwide from 1 June 2025."
    ],
    deposits: [
      "Never hand over your passport as a deposit or guarantee: the UK and Australian governments both warn against it.",
      "Businesses on Rove show the deposit for each vehicle before you book, so you know what you'll pay at handover."
    ],
    insurance: [
      "Every registered vehicle must carry compulsory motor insurance (Por Ror Bor). It pays towards injury and death only, not damage to the vehicle or to property, so ask the business what other cover the vehicle has.",
      "Check your travel insurance covers driving or riding in Thailand: many policies expect you to hold the right licence for the vehicle."
    ],
    safety: [
      "Thailand drives on the left.",
      "Thailand has one of the highest road death rates in the world, and motorcyclists are most at risk. Take extra care during holidays such as Songkran, when drinking and traffic both increase.",
      "Don't drink and drive."
    ],
    sources: [SRC.thGov, SRC.tat, SRC.ukTh, SRC.auTh, SRC.helmet, SRC.cmi]
  },
  indonesia: {
    slug: "indonesia",
    name: "Indonesia",
    placeCountry: "Indonesia",
    licence: [
      "A foreign driving licence on its own isn't enough in Indonesia: you need an International Driving Permit (or an Indonesian licence). Make sure it covers the type of vehicle you'll drive."
    ],
    motorbike: [
      "For a scooter or motorbike your licence and permit must include motorcycles. In May 2025 a three-day police operation in Badung (Canggu, Kuta, Seminyak, Uluwatu) cited 81 riders, 30 of them tourists.",
      "Bali's provincial government has proposed limiting motorbike rental for short-stay tourists. Check the current rules with the business before you book."
    ],
    helmet: ["Wear a helmet in good condition whenever you ride a motorbike or moped."],
    deposits: [
      "Businesses on Rove show the deposit for each vehicle before you book. Agree how and when it's returned before you take the keys."
    ],
    insurance: [
      "Check your travel insurance covers riding or driving in Indonesia with the licence you hold. If you ride without the right licence, a claim can be refused."
    ],
    safety: [
      "Indonesia drives on the left.",
      "Traffic in Bali can be heavy and unpredictable. If driving yourself doesn't suit you, the UK government suggests hiring a car with a driver.",
      "If you're in an accident, wait at the scene for the police and report it at a police station."
    ],
    sources: [SRC.ukId, SRC.auId, SRC.idLeft, SRC.baliChecks, SRC.baliBan]
  }
};

export const DESTINATIONS: Destination[] = [
  {
    country: "thailand",
    slug: "koh-samui",
    name: "Koh Samui",
    region: "Surat Thani",
    placeName: "Koh Samui",
    center: { lat: 9.512, lng: 100.0136 },
    radiusKm: 15,
    intro: "An island in the Gulf of Thailand with beaches all the way round and one main road to reach them. A car or scooter is the easiest way to get between Chaweng, Lamai, Bophut and Maenam.",
    gettingAround: [
      "The ring road, Highway 4169, runs about 50 km around the island and links every main beach.",
      "Many local businesses deliver to your hotel or villa. Look for the delivery badge on a vehicle."
    ],
    monthly: "Samui has a large community of long-stay visitors and remote workers, and many local businesses rent by the month.",
    sources: [SRC.samuiRing]
  },
  {
    country: "thailand",
    slug: "koh-phangan",
    name: "Koh Phangan",
    region: "Surat Thani",
    placeName: "Koh Phangan",
    center: { lat: 9.738, lng: 100.028 },
    radiusKm: 12,
    intro: "A smaller, hillier island north of Koh Samui. Most visitors arrive by ferry, and a scooter or small car is how people get between Thong Sala, Haad Rin and the quieter north coast.",
    gettingAround: [
      "Most visitors arrive by ferry from Koh Samui or the mainland, so rent on the island rather than bringing a vehicle across.",
      "Some roads are steep and narrow, especially towards the beaches on the east and north coasts. Ride slowly and only on a vehicle you're confident with."
    ],
    monthly: "Long stays are common on Phangan, and a monthly rental usually costs far less per day than renting day by day.",
    sources: []
  },
  {
    country: "thailand",
    slug: "phuket",
    name: "Phuket",
    region: "Phuket",
    placeName: "Phuket Town",
    center: { lat: 7.95, lng: 98.34 },
    radiusKm: 30,
    intro: "Thailand's largest island, joined to the mainland by bridge. With beaches spread along the west coast and the airport in the north, having your own transport saves a lot of taxi fares.",
    gettingAround: [
      "Phuket International Airport is in the north of the island; Patong, Kata and Karon are on the west coast, and Phuket Town in the east.",
      "The hill roads between the west-coast beaches are steep and winding. Take them slowly, especially on a scooter and in the rain."
    ],
    monthly: "If you're staying a month or more, compare the monthly price with the daily one: on a long stay it's usually much lower per day.",
    sources: []
  },
  {
    country: "thailand",
    slug: "chiang-mai",
    name: "Chiang Mai",
    region: "Chiang Mai",
    placeName: "Old City",
    center: { lat: 18.7883, lng: 98.9853 },
    radiusKm: 30,
    intro: "Northern Thailand's main city, and the starting point for the mountain roads to Pai and Mae Hong Son. Rent for the city, the temples on Doi Suthep, or a road trip north.",
    gettingAround: [
      "Highway 1095 runs about 245 km from Chiang Mai through Pai to Mae Hong Son, with steep slopes and a great many tight bends. Only take it on a vehicle and licence you're comfortable with.",
      "Chiang Mai International Airport (CNX) is on the south-west edge of the city, a short drive from the old city."
    ],
    monthly: "Chiang Mai is popular for long stays, and renting by the month usually brings the daily cost right down.",
    sources: [SRC.hw1095]
  },
  {
    country: "thailand",
    slug: "bangkok",
    name: "Bangkok",
    region: "Bangkok",
    placeName: "Bangkok",
    center: { lat: 13.7563, lng: 100.5018 },
    radiusKm: 35,
    intro: "Thailand's capital. Inside the city the Skytrain and metro are usually quicker than driving; a rental car comes into its own for trips out to the coast, Ayutthaya or Khao Yai.",
    gettingAround: [
      "The BTS Skytrain and MRT metro cover much of central Bangkok, and traffic can be very heavy at rush hour, so many visitors only rent for days out of the city.",
      "Both airports, Suvarnabhumi and Don Mueang, are a long way from the centre; delivery to your hotel can save the trip."
    ],
    monthly: "If you live in Bangkok for a few months, a monthly rental gives you a car for weekends away without buying one.",
    sources: []
  },
  {
    country: "thailand",
    slug: "pattaya",
    name: "Pattaya",
    region: "Chonburi",
    placeName: "Pattaya City",
    center: { lat: 12.9276, lng: 100.8771 },
    radiusKm: 25,
    intro: "A beach city on the Gulf of Thailand, about 150 km by road from Bangkok, with Jomtien and Naklua either side. Your own wheels make it easy to reach quieter beaches further south.",
    gettingAround: [
      "Central Pattaya has several one-way streets. Follow the signs and watch for scooters passing on both sides.",
      "Carry your licence and IDP every time you drive or ride: police can ask for them, and the helmet fine is up to 2,000 baht."
    ],
    monthly: "Many people stay in Pattaya for the season; a monthly rental is usually the cheapest way to have a car or scooter for it.",
    sources: [{ label: "Pattaya Mail: two-way traffic for Second Road debated", url: "https://www.pattayamail.com/news/2-way-traffic-second-road-table-pattaya-mulls-traffic-fixes-148779" }, SRC.helmet]
  },
  {
    country: "thailand",
    slug: "krabi",
    name: "Krabi",
    region: "Krabi",
    placeName: "Ao Nang",
    center: { lat: 8.06, lng: 98.88 },
    radiusKm: 30,
    intro: "Limestone cliffs, Ao Nang's beaches and the boats to the islands. A rental covers the mainland: Krabi Town, the beaches, hot springs and viewpoints inland.",
    gettingAround: [
      "Ao Nang is the main beach area and Krabi Town the provincial centre; the airport is east of Krabi Town.",
      "Islands such as Koh Phi Phi are reached by boat, so you won't need a vehicle on the day you visit them."
    ],
    monthly: "For a long stay in Ao Nang or Krabi Town, compare the monthly price: it's usually far lower per day than renting day by day.",
    sources: []
  },
  {
    country: "indonesia",
    slug: "bali",
    name: "Bali",
    region: "Bali",
    placeName: "Denpasar",
    center: { lat: -8.55, lng: 115.17 },
    radiusKm: 45,
    intro: "Indonesia's best-known island, from Canggu and Uluwatu in the south to Ubud in the hills. Traffic is heavy in the south, so plan routes and times with care.",
    gettingAround: [
      "The airport, Ngurah Rai (DPS), is in the south near Kuta. Roads around Canggu, Seminyak and Kuta are often congested.",
      "On Nyepi, Bali's day of silence, travel on the island stops for the day. Check the date before you plan a drive."
    ],
    monthly: "Many long-stay visitors in Bali rent by the month; ask the business about monthly prices and what's included.",
    sources: [SRC.auId]
  }
];

export function countryRules(slug: string): CountryRules | null {
  return COUNTRIES[slug] || null;
}

export function findDestination(country: string, slug: string): Destination | null {
  return DESTINATIONS.find((destination) => destination.country === country && destination.slug === slug) || null;
}

export function destinationsIn(country: string): Destination[] {
  return DESTINATIONS.filter((destination) => destination.country === country);
}

/** The destination's public path ("/thailand/koh-samui"). */
export function destinationPath(destination: Pick<Destination, "country" | "slug">) {
  return `/${destination.country}/${destination.slug}`;
}
