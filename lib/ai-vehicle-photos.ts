/**
 * AI vehicle photos (task build-img, 8 Nov 2026): what we ask the image model for.
 *
 * Generated sets share one look across the platform, matching the photos on rovehq.io (public/site/vehicles: bright
 * soft daylight, a plain light setting, the whole vehicle in frame): a light warm-grey studio, soft even light, eye-level
 * camera, the vehicle centred filling about three quarters of the width, landscape 3:2. The number plate carries the
 * operator's plate text in the business country's plate style.
 *
 * Enhancing keeps the photo real: light, straightening, framing and background tidying only. The vehicle itself
 * (colour, damage, wheels, plate, condition) must not change, and the prompt says so.
 *
 * Every image is saved as a 1800x1200 WebP (PHOTO_ASPECT), so generated and enhanced photos line up.
 */

export const PHOTO_ASPECT = { width: 1800, height: 1200 };

export type VehicleDetails = {
  make: string;
  model: string;
  year: number | null;
  color: string;
  trim?: string | null;
  body?: string | null;
  plate?: string | null;
  /** "car", "motorbike", "scooter"… (lib/vehicle-groups.ts) */
  kind: string;
  /** The business's country, ISO code ("DE", "TH", "US"). */
  country: string | null;
};

export type Angle = "front" | "side" | "rear" | "interior" | "detail";

const TWO_WHEELS = /motorbike|motorcycle|scooter|moped|bicycle|bike|ebike|e-bike/i;
export const isTwoWheeled = (kind: string) => TWO_WHEELS.test(kind);

/** The set made for a vehicle: four views, the last one inside (cars) or the cockpit (two-wheelers). */
export function anglesFor(kind: string): Angle[] {
  return isTwoWheeled(kind) ? ["front", "side", "rear", "detail"] : ["front", "side", "rear", "interior"];
}

/** Fields a generated set needs that the vehicle doesn't have yet. Trim and body type help but aren't needed. */
export function missingForGenerate(details: Partial<VehicleDetails>): Array<"make" | "model" | "year" | "color"> {
  const missing: Array<"make" | "model" | "year" | "color"> = [];
  if (!String(details.make || "").trim()) missing.push("make");
  if (!String(details.model || "").trim()) missing.push("model");
  if (!details.year) missing.push("year");
  if (!String(details.color || "").trim()) missing.push("color");
  return missing;
}

const RIGHT_HAND_DRIVE = new Set(["TH", "GB", "UK", "IE", "JP", "AU", "NZ", "IN", "ID", "MY", "SG", "ZA", "HK", "MO", "CY", "MT", "LK", "BD", "PK", "NP", "KE", "TZ", "UG", "ZM", "ZW", "MU", "BS", "BB", "JM", "TT", "FJ", "BN", "MV"]);
const EU_BAND: Record<string, string> = {
  AT: "A", BE: "B", BG: "BG", HR: "HR", CY: "CY", CZ: "CZ", DK: "DK", EE: "EST", FI: "FIN", FR: "F", DE: "D", GR: "GR", HU: "H", IE: "IRL", IT: "I",
  LV: "LV", LT: "LT", LU: "L", MT: "M", NL: "NL", PL: "PL", PT: "P", RO: "RO", SK: "SK", SI: "SLO", ES: "E", SE: "S"
};

function countryName(code: string) {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code;
  } catch {
    return code;
  }
}

/** How a registration plate looks in the business's country: shape, colours, typeface and layout. */
export function plateStyle(country: string | null, twoWheels: boolean): string {
  const code = String(country || "").toUpperCase();
  const shape = twoWheels ? "the small motorcycle-size version of" : "";
  if (code === "DE")
    return `${shape} the German format: a white reflective rectangular plate (520 x 110 mm on cars) with a thin black border, a blue vertical band at the left with the circle of twelve yellow EU stars above a white "D", black FE-Schrift characters, and between the district letters and the rest the round blue-and-white state registration seal above the round coloured inspection sticker`;
  if (EU_BAND[code])
    return `${shape} the European Union format used in ${countryName(code)}: a white reflective rectangular plate with a thin black border, a blue vertical band at the left with the circle of twelve yellow EU stars above the white country code "${EU_BAND[code]}", and black characters in ${countryName(code)}'s official plate typeface and spacing`;
  if (code === "GB" || code === "UK")
    return `${shape} the UK format: white reflective plate at the front and yellow reflective plate at the rear, black Charles Wright characters with the two-letter, two-digit, three-letter spacing, no border`;
  if (code === "TH")
    return `${shape} the Thai private-vehicle format: a white rectangular plate with a thin black border; the top line has the Thai consonant characters and the digits in black, and the bottom line shows the province name in smaller black Thai script`;
  if (code === "US")
    return `${shape} a standard US license plate (12 x 6 inches on cars): white reflective background with dark blue embossed characters, a state name in small capitals across the top and a small registration sticker in one corner`;
  if (code === "CA") return `${shape} a Canadian provincial license plate: white background with dark blue characters, the province name across the top`;
  if (code === "AU") return `${shape} an Australian state number plate: white background with black or dark blue characters and the state name in small letters along the bottom edge`;
  if (code === "NZ") return `${shape} a New Zealand number plate: white background with black characters and a thin black border`;
  if (code === "JP") return `${shape} a Japanese private-vehicle plate: white plate with green characters, the place name and class number on the top line, a hiragana character and the four-digit number below`;
  if (code === "CH") return `${shape} the Swiss format: white plate with black characters, the canton code, and the Swiss shield at the left and the canton shield at the right`;
  if (code === "NO") return `${shape} the Norwegian format: white plate with black characters and the blue band with the Norwegian flag and "N" at the left`;
  if (code === "AE") return `${shape} a United Arab Emirates plate: white plate with black characters and the emirate name and code letter at the left`;
  if (code === "ID") return `${shape} an Indonesian private plate: white plate with black characters, region letters, number, suffix letters and the month/year of validity in small digits beneath`;
  if (code === "MY") return `${shape} a Malaysian plate: black plate with white characters`;
  if (code === "PH") return `${shape} a Philippine plate: white plate with dark blue/black characters and "PHILIPPINES" across the top`;
  if (code === "VN") return `${shape} a Vietnamese private plate: white plate with black characters`;
  if (code === "MX") return `${shape} a Mexican state license plate: white plate with dark characters and the state name across the top`;
  if (code === "ZA") return `${shape} a South African provincial plate with the province's colours and black characters`;
  if (code) return `${shape} the standard registration plate design used in ${countryName(code)} (its shape, colours, typeface and layout)`;
  return `${shape} a plain neutral registration plate`;
}

const STYLE =
  "Professional automotive studio photograph for a rental listing. Setting: a seamless light warm-grey studio backdrop curving into a smooth matte floor of the same tone, nothing else in the scene. Lighting: soft, even, bright daylight-balanced light from a large overhead softbox with gentle fill from both sides, a soft natural contact shadow under the vehicle, no harsh reflections, no visible lights, people or equipment. Camera: eye level, about 1 m high, natural 50 mm lens perspective, sharp focus. Framing: the whole vehicle in frame, centred, filling about 75% of the image width with even margins, landscape 3:2. Photorealistic and true to this exact make, model, generation and trim: correct proportions, lights, grille, wheels and real badges. No added text, captions, watermarks, logos, people or props.";

const VIEWS: Record<Angle, string> = {
  front: "View: front three-quarter from the front left, showing the front and the left side.",
  side: "View: side profile, exactly perpendicular to the vehicle, front facing left.",
  rear: "View: rear three-quarter from the rear right, showing the back and the right side.",
  interior: "View: the interior from just outside the open driver's door, showing the steering wheel, dashboard, centre console and front seats, in this model's real cabin design and a colour that suits this trim; neat and clean, the same soft studio light.",
  detail: "View: close three-quarter view from behind and slightly above the seat, showing the handlebars, instrument cluster and seat, the rest of the vehicle softly in frame."
};

/** The prompt for one view of a generated set. */
export function generatePrompt(details: VehicleDetails, angle: Angle): string {
  const twoWheels = isTwoWheeled(details.kind);
  const name = [details.year, details.make, details.model, details.trim].filter(Boolean).join(" ");
  const what = [`Vehicle: ${name}`, details.body ? `body type ${details.body}` : twoWheels ? "a two-wheeler" : null, `exterior colour ${details.color}`].filter(Boolean).join(", ");
  const steering = !twoWheels && angle === "interior" ? (RIGHT_HAND_DRIVE.has(String(details.country || "").toUpperCase()) ? " Right-hand drive." : " Left-hand drive.") : "";
  const plateText = String(details.plate || "").trim();
  // The plate shows from the front and back of a car, and only from the back of a two-wheeler.
  const showsPlate = angle === "rear" || (angle === "front" && !twoWheels);
  const plate = !showsPlate
    ? ""
    : plateText
      ? ` The registration plate reads exactly "${plateText}" (these characters only, spelled exactly, nothing added), in ${plateStyle(details.country, twoWheels)}.`
      : ` The registration plate is ${plateStyle(details.country, twoWheels)}, with no readable characters on it.`;
  return `${STYLE}\n${what}.\n${VIEWS[angle]}${steering}${plate}`;
}

/** The prompt for enhancing an owner's own photo. */
export const ENHANCE_PROMPT = [
  "Edit this real photograph of a rental vehicle so it looks like a clean, professional listing photo, and keep it a real photograph of this real vehicle in this real place.",
  "Do: correct the exposure, contrast and white balance so it is bright, natural and evenly lit; straighten the horizon and vertical lines; crop and recentre so the whole vehicle sits in the middle at eye level, filling about 75% of the width, landscape 3:2; remove distracting clutter in the background (bins, cones, litter, people, parts of other vehicles) only where it can be done naturally, without inventing a new setting.",
  "Do NOT change the vehicle in any way. Keep exactly as they are: its colour and paint finish, every scratch, dent, scuff, chip, crack or other damage, the wheels, rims and tyres, the badges, the registration plate and every character on it, accessories, dirt and its overall condition and age. Do not add, remove, repair, restyle or replace any part, do not make it look newer or cleaner than it is, and do not change its shape or proportions.",
  "If an improvement can't be made without altering the vehicle, leave that part as it is. No added text, watermarks or logos."
].join("\n");

/** Crops and resizes any image to the platform's photo shape (PHOTO_ASPECT) as WebP. */
export async function toPlatformPhoto(bytes: Buffer): Promise<{ bytes: Buffer; mediaType: string; extension: string }> {
  try {
    const sharp = (await import("sharp")).default;
    const out = await sharp(bytes, { failOn: "none" }).rotate().resize({ width: PHOTO_ASPECT.width, height: PHOTO_ASPECT.height, fit: "cover", position: "centre" }).webp({ quality: 86 }).toBuffer();
    return { bytes: out, mediaType: "image/webp", extension: "webp" };
  } catch {
    return { bytes, mediaType: "image/png", extension: "png" };
  }
}
