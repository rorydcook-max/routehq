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
