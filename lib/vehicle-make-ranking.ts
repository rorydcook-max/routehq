// Orders the make picker by what rental fleets in the business's country actually run, so a Lisbon shop sees
// Renault and Peugeot first and a Bangkok shop sees Toyota and Honda first. Makes a list does not name follow
// alphabetically; with no country the whole list is alphabetical (no market is assumed).
//
// One list per region covers cars, vans, scooters and motorbikes together: the picker only shows makes that have
// models in the chosen category, so a car-only make never appears in the scooter list.

const REGION_MAKES: Record<string, string[]> = {
  westEurope: [
    "volkswagen", "renault", "peugeot", "toyota", "dacia", "citroen", "fiat", "skoda", "opel", "ford", "seat", "hyundai",
    "kia", "mercedes-benz", "bmw", "audi", "nissan", "tesla", "mini", "volvo", "cupra", "mg", "suzuki", "mazda", "jeep",
    "honda", "yamaha", "piaggio", "vespa", "kymco", "sym", "niu", "silence", "ktm", "triumph", "ducati", "aprilia",
    "royal-enfield", "kawasaki", "harley-davidson", "land-rover", "mitsubishi", "byd", "lexus"
  ],
  uk: [
    "ford", "vauxhall", "volkswagen", "kia", "toyota", "nissan", "hyundai", "bmw", "audi", "mercedes-benz", "mini",
    "peugeot", "skoda", "mg", "land-rover", "tesla", "volvo", "renault", "citroen", "seat", "dacia", "fiat", "honda",
    "mazda", "suzuki", "yamaha", "piaggio", "vespa", "triumph", "ktm", "royal-enfield", "ducati", "kawasaki",
    "harley-davidson", "kymco", "sym", "niu", "lexus", "jeep", "byd"
  ],
  eastEurope: [
    "skoda", "dacia", "toyota", "volkswagen", "renault", "hyundai", "kia", "opel", "ford", "peugeot", "suzuki", "citroen",
    "fiat", "seat", "bmw", "mercedes-benz", "audi", "nissan", "mazda", "tesla", "honda", "yamaha", "piaggio", "kymco",
    "sym", "ktm", "kawasaki", "triumph"
  ],
  nordics: [
    "volvo", "tesla", "volkswagen", "toyota", "skoda", "kia", "hyundai", "bmw", "audi", "mercedes-benz", "ford", "peugeot",
    "renault", "nissan", "polestar", "mg", "byd", "honda", "yamaha", "piaggio", "vespa", "triumph", "ktm"
  ],
  turkey: [
    "renault", "fiat", "toyota", "hyundai", "volkswagen", "peugeot", "dacia", "citroen", "ford", "honda", "opel", "skoda",
    "kia", "bmw", "mercedes-benz", "chery", "yamaha", "kymco", "sym", "piaggio", "vespa"
  ],
  northAmerica: [
    "toyota", "ford", "chevrolet", "honda", "nissan", "hyundai", "kia", "jeep", "tesla", "subaru", "ram", "gmc", "dodge",
    "chrysler", "mazda", "volkswagen", "bmw", "mercedes-benz", "audi", "lexus", "mitsubishi", "harley-davidson", "yamaha",
    "kawasaki", "suzuki", "ktm", "ducati", "triumph", "vespa", "royal-enfield"
  ],
  latinAmerica: [
    "nissan", "chevrolet", "volkswagen", "toyota", "kia", "hyundai", "renault", "fiat", "suzuki", "mazda", "ford", "jeep",
    "peugeot", "mitsubishi", "honda", "mg", "byd", "chery", "yamaha", "kawasaki", "bmw", "ktm", "royal-enfield"
  ],
  middleEast: [
    "toyota", "nissan", "hyundai", "kia", "mitsubishi", "lexus", "chevrolet", "ford", "mg", "suzuki", "gwm", "changan",
    "chery", "geely", "jeep", "land-rover", "mercedes-benz", "bmw", "audi", "gmc", "dodge", "volkswagen", "tesla", "honda",
    "mazda", "renault", "peugeot", "yamaha", "harley-davidson", "kawasaki", "ducati", "triumph"
  ],
  oceania: [
    "toyota", "mazda", "ford", "hyundai", "kia", "mitsubishi", "tesla", "mg", "subaru", "nissan", "volkswagen", "isuzu",
    "byd", "gwm", "suzuki", "honda", "bmw", "mercedes-benz", "audi", "lexus", "yamaha", "kawasaki", "harley-davidson",
    "ktm", "triumph", "ducati", "royal-enfield", "vespa"
  ],
  japan: [
    "toyota", "honda", "suzuki", "nissan", "daihatsu", "mazda", "subaru", "mitsubishi", "lexus", "bmw", "mercedes-benz",
    "volkswagen", "yamaha", "kawasaki"
  ],
  korea: ["hyundai", "kia", "kgm", "toyota", "bmw", "mercedes-benz", "tesla", "honda", "yamaha"],
  // Thailand keeps the order it always had.
  thailand: [
    "toyota", "honda", "isuzu", "mitsubishi", "ford", "mazda", "suzuki", "mg", "nissan", "hyundai", "yamaha", "gpx",
    "byd", "gwm"
  ],
  southeastAsia: [
    "toyota", "honda", "mitsubishi", "suzuki", "daihatsu", "hyundai", "nissan", "isuzu", "ford", "mazda", "kia", "mg",
    "byd", "chery", "yamaha", "kawasaki"
  ],
  southAsia: ["suzuki", "hyundai", "toyota", "honda", "kia", "mahindra", "royal-enfield", "yamaha", "ktm"]
};

const COUNTRY_REGION: Record<string, string> = {
  PT: "westEurope", ES: "westEurope", FR: "westEurope", IT: "westEurope", DE: "westEurope", NL: "westEurope",
  BE: "westEurope", LU: "westEurope", AT: "westEurope", CH: "westEurope", IE: "westEurope", GR: "westEurope",
  CY: "westEurope", MT: "westEurope", MC: "westEurope", AD: "westEurope", LI: "westEurope", SM: "westEurope",
  GB: "uk", UK: "uk", IM: "uk", JE: "uk", GG: "uk", GI: "uk",
  PL: "eastEurope", CZ: "eastEurope", SK: "eastEurope", HU: "eastEurope", RO: "eastEurope", BG: "eastEurope",
  HR: "eastEurope", SI: "eastEurope", RS: "eastEurope", BA: "eastEurope", ME: "eastEurope", MK: "eastEurope",
  AL: "eastEurope", EE: "eastEurope", LV: "eastEurope", LT: "eastEurope", UA: "eastEurope", MD: "eastEurope", GE: "eastEurope",
  SE: "nordics", NO: "nordics", DK: "nordics", FI: "nordics", IS: "nordics",
  TR: "turkey",
  US: "northAmerica", CA: "northAmerica", PR: "northAmerica",
  MX: "latinAmerica", BR: "latinAmerica", AR: "latinAmerica", CL: "latinAmerica", CO: "latinAmerica", PE: "latinAmerica",
  CR: "latinAmerica", PA: "latinAmerica", DO: "latinAmerica", EC: "latinAmerica", UY: "latinAmerica", GT: "latinAmerica",
  AE: "middleEast", SA: "middleEast", QA: "middleEast", KW: "middleEast", OM: "middleEast", BH: "middleEast",
  JO: "middleEast", IL: "middleEast", EG: "middleEast", MA: "middleEast", LB: "middleEast",
  AU: "oceania", NZ: "oceania", FJ: "oceania",
  JP: "japan", KR: "korea",
  TH: "thailand",
  ID: "southeastAsia", MY: "southeastAsia", PH: "southeastAsia", VN: "southeastAsia", SG: "southeastAsia",
  KH: "southeastAsia", LA: "southeastAsia", MM: "southeastAsia",
  IN: "southAsia", LK: "southAsia", NP: "southAsia"
};

// Where one country's market differs from its region: these lead, then the region list follows.
const COUNTRY_MAKES: Record<string, string[]> = {
  FR: ["renault", "peugeot", "citroen", "dacia", "toyota"],
  PT: ["renault", "peugeot", "mercedes-benz", "bmw", "citroen"],
  ES: ["toyota", "seat", "renault", "dacia", "kia"],
  IT: ["fiat", "volkswagen", "toyota", "dacia", "renault", "piaggio", "honda"],
  DE: ["volkswagen", "mercedes-benz", "bmw", "audi", "opel", "skoda"],
  CZ: ["skoda"],
  RO: ["dacia"],
  SE: ["volvo"],
  BR: ["fiat", "volkswagen", "chevrolet", "toyota", "hyundai", "honda"],
  AU: ["toyota", "ford", "mazda"],
  NZ: ["toyota", "ford", "mitsubishi"]
};

/** Scooters and motorbikes: the two-wheeler brands lead (a car brand that also makes scooters follows its rank here). */
const REGION_BIKES: Record<string, string[]> = {
  westEurope: ["honda", "yamaha", "piaggio", "vespa", "kymco", "sym", "peugeot", "suzuki", "bmw", "kawasaki", "ktm", "triumph", "ducati", "aprilia", "royal-enfield", "harley-davidson", "niu", "silence"],
  uk: ["honda", "yamaha", "triumph", "bmw", "kawasaki", "suzuki", "ktm", "royal-enfield", "ducati", "harley-davidson", "piaggio", "vespa", "kymco", "sym", "niu"],
  eastEurope: ["honda", "yamaha", "kymco", "sym", "piaggio", "suzuki", "kawasaki", "bmw", "ktm", "triumph"],
  nordics: ["honda", "yamaha", "bmw", "kawasaki", "suzuki", "ktm", "triumph", "piaggio", "vespa", "niu"],
  turkey: ["honda", "yamaha", "kymco", "sym", "piaggio", "vespa", "cfmoto", "suzuki", "bmw"],
  northAmerica: ["harley-davidson", "honda", "yamaha", "kawasaki", "suzuki", "bmw", "ktm", "ducati", "triumph", "royal-enfield", "vespa", "piaggio", "kymco"],
  latinAmerica: ["honda", "yamaha", "suzuki", "kawasaki", "bmw", "ktm", "royal-enfield", "kymco"],
  middleEast: ["honda", "yamaha", "harley-davidson", "kawasaki", "suzuki", "bmw", "ducati", "triumph", "ktm", "sym", "kymco"],
  oceania: ["honda", "yamaha", "kawasaki", "suzuki", "harley-davidson", "bmw", "ktm", "triumph", "ducati", "royal-enfield", "vespa", "piaggio"],
  japan: ["honda", "yamaha", "suzuki", "kawasaki"],
  korea: ["honda", "yamaha", "suzuki", "kawasaki"],
  thailand: ["honda", "yamaha", "gpx", "suzuki", "kawasaki", "vespa"],
  southeastAsia: ["honda", "yamaha", "suzuki", "kawasaki", "vespa"],
  southAsia: ["royal-enfield", "honda", "yamaha", "suzuki", "ktm"]
};

const COUNTRY_BIKES: Record<string, string[]> = {
  IT: ["piaggio", "vespa", "honda", "yamaha", "aprilia", "ducati"],
  ES: ["honda", "yamaha", "kymco", "sym", "piaggio", "silence"],
  PT: ["honda", "yamaha", "kymco", "sym", "piaggio", "vespa"],
  FR: ["yamaha", "honda", "piaggio", "peugeot", "kymco"],
  GR: ["honda", "yamaha", "sym", "kymco", "piaggio"]
};

const TWO_WHEELERS = new Set(["scooter", "motorcycle", "motorbike", "ebike"]);

function alphabetical(left: string, right: string) {
  return left.localeCompare(right, "en", { sensitivity: "base" });
}

export function preferredMakeSlugs(country?: string | null, category?: string | null): string[] {
  const code = String(country || "").trim().toUpperCase();
  if (!code) return [];
  const region = COUNTRY_REGION[code];
  const bikes = TWO_WHEELERS.has(String(category || "").toLowerCase())
    ? [...(COUNTRY_BIKES[code] || []), ...(region ? REGION_BIKES[region] || [] : [])]
    : [];
  const ordered = [...bikes, ...(COUNTRY_MAKES[code] || []), ...(region ? REGION_MAKES[region] : [])];
  return Array.from(new Set(ordered));
}

/** `category`: the vehicle type picked (car, van, scooter, motorcycle...), so two-wheeler brands lead for bikes. */
export function rankMakesForCountry<T extends { slug: string; name: string }>(makes: T[], country?: string | null, category?: string | null): T[] {
  const preferred = preferredMakeSlugs(country, category);
  const rank = new Map(preferred.map((slug, index) => [slug, index]));
  return [...makes].sort((left, right) => {
    const leftRank = rank.get(left.slug) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.slug) ?? Number.MAX_SAFE_INTEGER;
    return leftRank !== rightRank ? leftRank - rightRank : alphabetical(left.name, right.name);
  });
}

// ── Models ────────────────────────────────────────────────────────────────────
// The model list for a make follows the same idea: the models rental fleets in that part of the world run come
// first (a Miami shop sees Camry and Corolla, not Alphard; a Lisbon shop sees Clio and Yaris), the rest follow
// alphabetically. Names match vehicle_models.name.

const MODEL_MARKET: Record<string, "us" | "europe" | "asia"> = {
  northAmerica: "us",
  westEurope: "europe",
  uk: "europe",
  eastEurope: "europe",
  nordics: "europe",
  turkey: "europe",
  japan: "asia",
  korea: "asia",
  thailand: "asia",
  southeastAsia: "asia",
  southAsia: "asia"
};

const MARKET_MODELS: Record<"us" | "europe" | "asia", Record<string, string[]>> = {
  us: {
    toyota: ["Camry", "Corolla", "RAV4", "Highlander", "Prius", "Tacoma", "Corolla Cross", "Tundra", "Sienna", "4Runner", "Yaris"],
    ford: ["Escape", "Explorer", "F-150", "Mustang", "Edge", "Bronco Sport", "Expedition", "Maverick", "Bronco", "Ranger", "Mustang Mach-E"],
    chevrolet: ["Malibu", "Equinox", "Trax", "Tahoe", "Suburban", "Silverado", "Traverse", "Trailblazer", "Camaro", "Colorado", "Spark"],
    honda: ["Civic", "Accord", "CR-V", "HR-V", "Pilot", "Passport", "Fit"],
    nissan: ["Altima", "Sentra", "Rogue", "Versa", "Kicks", "Pathfinder", "Frontier", "Leaf"],
    hyundai: ["Elantra", "Sonata", "Tucson", "Santa Fe", "Kona", "Venue", "Palisade", "Accent", "Ioniq 5", "Ioniq 6"],
    kia: ["Forte", "K5", "Sportage", "Sorento", "Soul", "Seltos", "Telluride", "Niro", "Rio", "EV6", "EV9"],
    jeep: ["Grand Cherokee", "Wrangler", "Compass", "Cherokee", "Renegade", "Gladiator"],
    tesla: ["Model 3", "Model Y", "Model S", "Model X"],
    volkswagen: ["Jetta", "Tiguan", "Atlas", "Taos", "Passat", "Golf", "ID.4"],
    mazda: ["Mazda 3", "CX-5", "CX-30", "CX-50", "CX-90", "Mazda 6", "MX-5"],
    subaru: ["Outback", "Forester", "Crosstrek", "Impreza", "Legacy", "Ascent"],
    bmw: ["3 Series", "X3", "X5", "5 Series", "X1", "i4"],
    "mercedes-benz": ["C-Class", "GLC", "E-Class", "GLE", "A-Class", "CLA", "GLA"]
  },
  europe: {
    toyota: ["Yaris", "Corolla", "Yaris Cross", "Aygo X", "C-HR", "RAV4", "Prius", "Camry", "Land Cruiser", "Hilux"],
    volkswagen: ["Polo", "Golf", "T-Roc", "T-Cross", "Tiguan", "Passat", "Up!", "Taigo", "ID.3", "ID.4", "Touran"],
    renault: ["Clio", "Captur", "Mégane", "Twingo", "Arkana", "Austral", "Scenic", "Zoe"],
    peugeot: ["208", "2008", "308", "3008", "5008", "Rifter"],
    fiat: ["500", "Panda", "Tipo", "500X", "600", "500e"],
    dacia: ["Sandero", "Sandero Stepway", "Duster", "Logan", "Jogger", "Spring"],
    citroen: ["C3", "C3 Aircross", "C4", "C1", "C5 Aircross"],
    skoda: ["Fabia", "Octavia", "Kamiq", "Scala", "Karoq", "Kodiaq", "Superb", "Enyaq"],
    opel: ["Corsa", "Astra", "Mokka", "Crossland", "Grandland"],
    ford: ["Fiesta", "Focus", "Puma", "Kuga", "Mustang Mach-E", "Ranger", "Mustang"],
    hyundai: ["i10", "i20", "i30", "Kona", "Tucson", "Bayon", "Ioniq 5", "Santa Fe"],
    kia: ["Picanto", "Rio", "Ceed", "Stonic", "Sportage", "Niro", "EV6", "Sorento"],
    nissan: ["Micra", "Juke", "Qashqai", "X-Trail", "Leaf", "Ariya"],
    "mercedes-benz": ["A-Class", "C-Class", "CLA", "GLA", "E-Class", "GLC", "B-Class"],
    bmw: ["1 Series", "3 Series", "X1", "2 Series", "X3", "5 Series", "i4"],
    audi: ["A1", "A3", "Q2", "Q3", "A4", "Q5", "A6"],
    tesla: ["Model Y", "Model 3", "Model S", "Model X"],
    suzuki: ["Swift", "Ignis", "Vitara", "S-Cross", "Jimny"],
    mazda: ["Mazda 2", "CX-30", "Mazda 3", "CX-5", "MX-5", "CX-60"]
  },
  asia: {
    toyota: ["Vios", "Yaris", "Yaris Ativ", "Corolla Altis", "Corolla Cross", "Fortuner", "Hilux Revo", "Innova", "Avanza", "Veloz", "Camry", "Alphard", "Aqua", "Prius", "Sienta", "Noah", "Voxy"],
    honda: ["City", "City Hatchback", "Civic", "Jazz", "HR-V", "CR-V", "Brio", "BR-V", "Fit", "Freed", "N-Box", "Accord"],
    mitsubishi: ["Xpander", "Mirage", "Attrage", "Triton", "Pajero Sport", "Outlander"],
    nissan: ["Almera", "Kicks", "Note", "Serena", "Navara", "Terra", "X-Trail", "Sylphy"],
    suzuki: ["Swift", "Ertiga", "Celerio", "Ciaz", "XL7", "Wagon R", "Spacia", "Hustler", "Jimny"],
    mazda: ["Mazda 2", "Mazda 3", "CX-3", "CX-30", "CX-5", "BT-50"],
    hyundai: ["Creta", "Accent", "Avante", "Elantra", "Venue", "Tucson", "Santa Fe", "Casper", "Grandeur"],
    kia: ["Morning", "K3", "Seltos", "Sonet", "Carnival", "Sportage", "Sorento", "Ray", "Picanto"],
    isuzu: ["D-Max", "MU-X"],
    ford: ["Ranger", "Everest", "Territory", "EcoSport"],
    chevrolet: ["Spark", "Trailblazer", "Colorado", "Captiva"]
  }
};

/** Models of one make, the ones common in the business's part of the world first, then alphabetical. */
export function rankModelsForCountry<T extends { name: string }>(models: T[], makeSlug?: string | null, country?: string | null): T[] {
  const region = COUNTRY_REGION[String(country || "").trim().toUpperCase()];
  const market = region ? MODEL_MARKET[region] : undefined;
  const preferred = market ? MARKET_MODELS[market][String(makeSlug || "").toLowerCase()] || [] : [];
  const rank = new Map(preferred.map((name, index) => [name.toLowerCase(), index]));
  return [...models].sort((left, right) => {
    const leftRank = rank.get(left.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const rightRank = rank.get(right.name.toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    return leftRank !== rightRank ? leftRank - rightRank : alphabetical(left.name, right.name);
  });
}

// What people type for a make: "chevy" finds Chevrolet, "vw" Volkswagen, "merc" Mercedes-Benz.
const MAKE_ALIASES: Record<string, string> = {
  chevy: "chevrolet",
  vw: "volkswagen",
  vdub: "volkswagen",
  merc: "mercedes-benz",
  mercedes: "mercedes-benz",
  benz: "mercedes-benz",
  mb: "mercedes-benz",
  bimmer: "bmw",
  beemer: "bmw",
  landrover: "land-rover",
  rangerover: "land-rover",
  alfa: "alfa-romeo",
  harley: "harley-davidson",
  enfield: "royal-enfield"
};

/** Whether a make matches what was typed in the make search: its name, or a common nickname ("chevy", "vw", "merc"). */
export function makeMatchesSearch(make: { name: string; slug: string }, needle: string, normalize: (value: string) => string): boolean {
  if (!needle) return true;
  if (normalize(make.name).includes(needle)) return true;
  return Object.entries(MAKE_ALIASES).some(([alias, slug]) => slug === make.slug && (alias.startsWith(needle) || (needle.startsWith(alias) && needle.length <= alias.length + 2)));
}
