import type { CountryRules, Destination, Source } from "@/lib/rove/destinations";

/**
 * rove.rent's destinations outside Thailand and Indonesia (task "roverent2", 7 Nov 2026: rove.rent is for renters
 * worldwide, never Thai-centric because the first business happens to be in Thailand). Merged into COUNTRIES and
 * DESTINATIONS by lib/rove/destinations.ts; every address is also listed in lib/rove/guide-slugs.ts.
 *
 * The rules are written for visitors from anywhere, not one nationality, and each comes from a named source (shown
 * on the page). Where a source speaks for one nationality (GOV.UK for UK licences), the text says so. Anything we
 * couldn't confirm was left out or worded as advice. Researched 7 Nov 2026: re-check before editing.
 */

const S = {
  idpTable: { label: "GOV.UK: which international driving permit each country uses", url: "https://www.gov.uk/driving-abroad/international-driving-permit" },
  renting: { label: "GOV.UK: hiring a car, what to watch out for (excess, CDW, deposits)", url: "https://www.gov.uk/government/publications/renting-a-car-advice-for-consumers/hiring-a-car-what-to-watch-out-for" },
  euRental: { label: "Your Europe (European Union): hiring a car abroad", url: "https://europa.eu/youreurope/citizens/travel/driving-abroad/car-rental-abroad/index_en.htm" },
  sides: { label: "Wikipedia: left- and right-hand traffic", url: "https://en.wikipedia.org/wiki/Left-_and_right-hand_traffic" },
  racPt: { label: "RAC: driving in Portugal", url: "https://www.rac.co.uk/drive/travel/country/portugal/" },
  racEs: { label: "RAC: driving in Spain", url: "https://www.rac.co.uk/drive/travel/country/spain/" },
  racGr: { label: "RAC: driving in Greece", url: "https://www.rac.co.uk/drive/travel/country/greece/" },
  racIt: { label: "RAC: driving in Italy", url: "https://www.rac.co.uk/drive/travel/country/italy/" },
  racHr: { label: "RAC: driving in Croatia", url: "https://www.rac.co.uk/drive/travel/country/croatia/" },
  racMt: { label: "RAC: driving in Malta", url: "https://www.rac.co.uk/drive/travel/country/malta/" },
  ukPt: { label: "GOV.UK foreign travel advice: Portugal", url: "https://www.gov.uk/foreign-travel-advice/portugal" },
  ukEs: { label: "GOV.UK foreign travel advice: Spain", url: "https://www.gov.uk/foreign-travel-advice/spain" },
  ukGr: { label: "GOV.UK foreign travel advice: Greece", url: "https://www.gov.uk/foreign-travel-advice/greece" },
  ukUs: { label: "GOV.UK foreign travel advice: USA", url: "https://www.gov.uk/foreign-travel-advice/usa" },
  ukZa: { label: "GOV.UK foreign travel advice: South Africa", url: "https://www.gov.uk/foreign-travel-advice/south-africa" },
  ukMa: { label: "GOV.UK foreign travel advice: Morocco", url: "https://www.gov.uk/foreign-travel-advice/morocco" },
  iihs: { label: "IIHS: motorcycle helmet laws by US state", url: "https://www.iihs.org/topics/motorcycles/motorcycle-helmet-laws-table" },
  mxIns: { label: "Sanborn's: Mexican auto liability insurance is required by law", url: "https://sanborns.com/mandatory_mexican_insurance" },
  crLicense: { label: "The Tico Times: driver's licenses in Costa Rica", url: "https://ticotimes.net/2021/12/09/how-to-drivers-licenses-in-costa-rica" },
  jp: { label: "Real Japan Guide: driving in Japan with an international driving permit", url: "https://real-japan-guide.com/driving-in-japan-international-driving-permit/" },
  nz: { label: "Tourism New Zealand: international driving licenses and permits", url: "https://www.newzealand.com/us/feature/international-driving-licences-and-permits/" },
  uae: { label: "Gulf News: driving in the UAE as a tourist (licenses, rentals, insurance)", url: "https://gulfnews.com/ask-gulf-news/ask-gulf-news-driving-in-the-uae-as-a-tourist-licence-rules-car-rentals-and-insurance-1.500388132" }
} satisfies Record<string, Source>;

export const WORLD_SOURCES = S;

/** The same deposit and cover advice everywhere it applies, from the same two sources. */
const RENTAL_DEPOSITS = [
  "The deposit is usually a hold on a credit card in the driver's name rather than a charge, released after the vehicle comes back undamaged. Businesses on Rove show each vehicle's deposit before you book.",
  "Walk round the vehicle at handover and photograph or film any existing damage, so it's noted before you drive away."
];
const EU_INSURANCE = [
  "Every rental vehicle in the EU must have third-party liability insurance, normally included in the price.",
  "A collision damage waiver (CDW) is often included but still leaves an excess: the most you'd pay if the vehicle is damaged. It often excludes tires and glass. Extra cover that lowers the excess is optional, so compare it with independent excess insurance."
];

export const WORLD_COUNTRIES: Record<string, CountryRules> = {
  portugal: {
    slug: "portugal",
    name: "Portugal",
    group: "europe",
    placeCountry: "Portugal",
    licence: [
      "A license from an EU or EEA country is valid. UK photocard license holders can drive without an IDP for visits of up to 185 days.",
      "With a license from elsewhere, check whether you need an International Driving Permit: the UK government lists Portugal under the 1968 convention.",
      "You must be 18 to drive a car, and you must carry ID when driving."
    ],
    motorbike: ["Mopeds and motorcycles up to 125 cc can be ridden from age 16 with the right license category."],
    helmet: ["Helmets are compulsory for riders and passengers of mopeds and motorcycles."],
    deposits: RENTAL_DEPOSITS,
    insurance: EU_INSURANCE,
    safety: [
      "Portugal drives on the right.",
      "Some motorways take electronic tolls only. Ask the business whether the vehicle has a toll transponder (Via Verde) and how tolls are charged.",
      "The usual drink-drive limit is 0.05%, and lower for new drivers."
    ],
    sources: [S.idpTable, S.ukPt, S.racPt, S.euRental, S.renting, S.sides]
  },
  spain: {
    slug: "spain",
    name: "Spain",
    group: "europe",
    placeCountry: "Spain",
    licence: [
      "A license from an EU or EEA country is valid, and UK photocard licenses are accepted. With a license from elsewhere, check whether you need an International Driving Permit: the UK government lists Spain under the 1949 convention.",
      "You must be 18 to drive a car or a motorcycle over 125 cc; from 16 you can ride a motorcycle up to 125 cc. Carry your license and ID."
    ],
    motorbike: ["Make sure your license covers the size of scooter or motorcycle you rent."],
    helmet: ["Helmets are compulsory on mopeds, motorcycles, trikes and quads (unless the vehicle has seat belts)."],
    deposits: [...RENTAL_DEPOSITS, "By law, rental businesses in Spain register your passport details when you collect the vehicle."],
    insurance: EU_INSURANCE,
    safety: [
      "Spain drives on the right.",
      "Using a phone while driving is illegal, even when pulled over, and earpieces are banned. Children under 1.35 m need an approved child seat.",
      "The usual drink-drive limit is 0.05% (0.03% for drivers with under two years' experience), and police run roadside checks."
    ],
    sources: [S.idpTable, S.ukEs, S.racEs, S.euRental, S.renting, S.sides]
  },
  greece: {
    slug: "greece",
    name: "Greece",
    group: "europe",
    placeCountry: "Greece",
    licence: [
      "A license from an EU or EEA country is valid, and UK photocard licenses are accepted. With a license from elsewhere, check whether you need an International Driving Permit: the UK government lists Greece under the 1968 convention.",
      "Rental businesses often ask for more than the law: a year of driving experience, a higher minimum age, or an IDP. Provisional licenses aren't valid."
    ],
    motorbike: [
      "To rent a moped or scooter you need a license with at least category A1 (light motorcycle). A car license alone isn't enough, and the UK's category P (mopeds up to 50 cc) isn't valid in Greece.",
      "Quad bikes cause many serious accidents. Insurance sold with them is usually third-party only, and many travel policies exclude quads."
    ],
    helmet: ["Riders and passengers on mopeds and quads must wear helmets. Without one, police can fine you and take your license, and your insurance may not pay."],
    deposits: RENTAL_DEPOSITS,
    insurance: EU_INSURANCE,
    safety: [
      "Greece drives on the right.",
      "Traffic can be fast and chaotic, especially in cities, and drivers don't always stop at pedestrian crossings.",
      "The usual drink-drive limit is 0.05%, and lower for new drivers."
    ],
    sources: [S.idpTable, S.ukGr, S.racGr, S.euRental, S.renting, S.sides]
  },
  italy: {
    slug: "italy",
    name: "Italy",
    group: "europe",
    placeCountry: "Italy",
    licence: [
      "A license from an EU or EEA country is valid, and UK photocard licenses are accepted. With a license from elsewhere, check whether you need an International Driving Permit: the UK government lists Italy under the 1968 convention.",
      "You must be 18 to drive a car; motorcycles up to 125 cc from 16 and mopeds from 14."
    ],
    motorbike: ["Scooters are a popular way around the coast. Make sure your license covers the engine size you rent."],
    helmet: ["Helmets are compulsory for moped and motorcycle riders, and on trikes and quads without closed bodywork."],
    deposits: RENTAL_DEPOSITS,
    insurance: EU_INSURANCE,
    safety: [
      "Italy drives on the right.",
      "Many towns have limited traffic zones (ZTL) watched by cameras. Driving in without a permit brings a fine, often sent on later through the rental business.",
      "Carry your license and passport whenever you drive."
    ],
    sources: [S.idpTable, S.racIt, S.euRental, S.renting, S.sides]
  },
  croatia: {
    slug: "croatia",
    name: "Croatia",
    group: "europe",
    placeCountry: "Croatia",
    licence: [
      "A license from an EU or EEA country is valid, and UK photocard licenses are accepted. With a license from elsewhere, check whether you need an International Driving Permit: the UK government lists Croatia under the 1968 convention.",
      "You must be 18 to drive a car; motorcycles up to 125 cc from 16 and mopeds from 15."
    ],
    motorbike: ["Make sure your license covers the scooter or motorcycle you rent."],
    helmet: ["Helmets are compulsory for moped and motorcycle riders."],
    deposits: RENTAL_DEPOSITS,
    insurance: EU_INSURANCE,
    safety: [
      "Croatia drives on the right.",
      "Every car must carry a warning triangle, a first-aid kit and reflective vests. Check they're in the rental vehicle before you set off."
    ],
    sources: [S.idpTable, S.racHr, S.euRental, S.renting, S.sides]
  },
  malta: {
    slug: "malta",
    name: "Malta",
    group: "europe",
    placeCountry: "Malta",
    licence: [
      "A license from an EU or EEA country is valid, and UK photocard licenses are accepted. With a license from elsewhere, check whether you need an International Driving Permit: the UK government lists Malta under the 1949 convention.",
      "You must be 18 to drive. Rental businesses usually require you to be 21, and may charge more under 25."
    ],
    motorbike: ["Make sure your license covers the scooter or motorcycle you rent."],
    helmet: ["Wear a helmet whenever you ride a motorcycle or scooter."],
    deposits: RENTAL_DEPOSITS,
    insurance: EU_INSURANCE,
    safety: ["Malta drives on the left, one of only four countries in Europe that do."],
    sources: [S.idpTable, S.racMt, S.euRental, S.renting, S.sides]
  },
  "united-states": {
    slug: "united-states",
    name: "United States",
    group: "americas",
    placeCountry: "United States",
    licence: [
      "Visitors can generally drive on their home license, but rules vary by state, and you may need an International Driving Permit too (the UK government lists the 1949 version). Check the rules of each state you'll drive in.",
      "Rental businesses often ask for more than the law: a year of driving experience, a higher minimum age, or an IDP."
    ],
    motorbike: ["To ride a motorcycle or moped you need a license that covers it. Check with the business which license it accepts."],
    helmet: [
      "Helmet laws differ by state. In Hawaii riders 17 and younger must wear one; in Florida everyone under 21 must, and older riders may go without only with proof of medical insurance. Wearing one is always the safer choice."
    ],
    deposits: RENTAL_DEPOSITS,
    insurance: [
      "A collision or loss damage waiver (CDW/LDW) offered at the counter covers damage to the rental vehicle, usually with an excess. Check first whether your own policy, travel insurance or credit card already covers rentals, and what liability cover is included."
    ],
    safety: ["The United States drives on the right."],
    sources: [S.idpTable, S.ukUs, S.iihs, S.renting, S.sides]
  },
  mexico: {
    slug: "mexico",
    name: "Mexico",
    group: "americas",
    placeCountry: "Mexico",
    licence: ["Bring your valid home license, and check with the business whether it also wants an International Driving Permit."],
    motorbike: ["To ride a scooter or motorcycle you need a license that covers it."],
    helmet: ["Wear a helmet whenever you ride, and make sure any passenger has one too."],
    deposits: RENTAL_DEPOSITS,
    insurance: [
      "Liability insurance from a Mexican insurer is required by law. US and Canadian car insurance isn't valid in Mexico, so check the rental price includes the required liability cover.",
      "Damage cover for the vehicle itself is usually separate; ask what the excess is."
    ],
    safety: ["Mexico drives on the right."],
    sources: [S.mxIns, S.renting, S.sides]
  },
  "costa-rica": {
    slug: "costa-rica",
    name: "Costa Rica",
    group: "americas",
    placeCountry: "Costa Rica",
    licence: [
      "Tourists can drive on a valid license from their home country for as long as their tourist stay lasts (normally up to 90 days from arrival). Carry your passport, or a copy of the photo page and entry stamp, in case you're stopped."
    ],
    motorbike: ["To ride a scooter or motorcycle you need a license that covers it."],
    helmet: ["Wear a helmet whenever you ride, and make sure any passenger has one too."],
    deposits: RENTAL_DEPOSITS,
    insurance: ["Ask exactly which cover is included in the price and which is extra, and what the excess is before you sign."],
    safety: ["Costa Rica drives on the right."],
    sources: [S.crLicense, S.renting, S.sides]
  },
  japan: {
    slug: "japan",
    name: "Japan",
    group: "asia-pacific",
    placeCountry: "Japan",
    licence: [
      "Japan accepts only the original paper International Driving Permit issued under the 1949 Geneva Convention; permits under other conventions, phone images and PDFs aren't accepted.",
      "Licenses from Switzerland, Germany, France, Belgium, Monaco and Taiwan are used instead with an authorized Japanese translation and your passport.",
      "You can drive for up to one year after arriving, and never beyond the expiry of your permit or license."
    ],
    motorbike: ["Your permit must show the right vehicle category for a scooter or motorcycle; a blank or wrong category can stop you renting one."],
    helmet: ["Wear a helmet whenever you ride a scooter or motorcycle."],
    deposits: RENTAL_DEPOSITS,
    insurance: ["Ask what the rental price includes and what you'd pay if the vehicle is damaged."],
    safety: ["Japan drives on the left."],
    sources: [S.jp, S.idpTable, S.renting, S.sides]
  },
  "new-zealand": {
    slug: "new-zealand",
    name: "New Zealand",
    group: "asia-pacific",
    placeCountry: "New Zealand",
    licence: [
      "Visitors can drive on a current overseas license for a limited time (Tourism New Zealand gives up to 18 months). If your license isn't in English, carry an accurate English translation from an approved source.",
      "Carry your license or permit at all times when driving."
    ],
    motorbike: ["To ride a motorcycle you need a license that covers it."],
    helmet: ["Wear a helmet whenever you ride a motorcycle or scooter."],
    deposits: RENTAL_DEPOSITS,
    insurance: ["Ask what the rental price includes and what the excess is if the vehicle is damaged."],
    safety: ["New Zealand drives on the left."],
    sources: [S.nz, S.idpTable, S.renting, S.sides]
  },
  "south-africa": {
    slug: "south-africa",
    name: "South Africa",
    group: "africa-middle-east",
    placeCountry: "South Africa",
    licence: [
      "UK photocard license holders can drive for up to 12 months. With other licenses, check whether you need an International Driving Permit: the UK government lists South Africa under the 1968 convention and notes your insurer may ask for an IDP after an accident.",
      "Rental businesses may ask for a year of driving experience."
    ],
    motorbike: ["To ride a motorcycle you need a license that covers it."],
    helmet: ["Wear a helmet whenever you ride a motorcycle or scooter."],
    deposits: RENTAL_DEPOSITS,
    insurance: ["Ask what the rental price includes and what the excess is if the vehicle is damaged."],
    safety: [
      "South Africa drives on the left.",
      "Carjacking and robbery happen, particularly after dark and at traffic lights and junctions. Keep doors locked and valuables out of sight, and avoid unfamiliar areas at night."
    ],
    sources: [S.ukZa, S.idpTable, S.renting, S.sides]
  },
  "united-arab-emirates": {
    slug: "united-arab-emirates",
    name: "United Arab Emirates",
    group: "africa-middle-east",
    placeCountry: "United Arab Emirates",
    licence: [
      "Visitors from more than 30 countries (including the UK, US, Canada, Germany, France, Japan and South Korea) can drive on their home license while on a tourist or visit visa; the UAE Ministry of Interior keeps the full list.",
      "Otherwise you need an International Driving Permit with your original license. The minimum age to rent is 21, and some businesses ask for 25 for high-performance cars."
    ],
    motorbike: ["To ride a motorcycle you need a license that covers it."],
    helmet: ["Wear a helmet whenever you ride a motorcycle or scooter."],
    deposits: [
      "The deposit is usually blocked on a credit card in the driver's name and covers fines, Salik road tolls or damage. It should be released within 30 days of returning the vehicle if there are none.",
      "Walk round the vehicle at handover and photograph any existing damage."
    ],
    insurance: ["Every rental car includes third-party insurance by law. Collision damage cover and zero-excess cover are usually extra."],
    safety: ["The UAE drives on the right."],
    sources: [S.uae, S.idpTable, S.sides]
  },
  morocco: {
    slug: "morocco",
    name: "Morocco",
    group: "africa-middle-east",
    placeCountry: "Morocco",
    licence: [
      "UK drivers need both their license and the 1968 International Driving Permit; Morocco no longer accepts the 1949 version. With another license, check which permit you need before you travel.",
      "Rental businesses may ask for a year of driving experience and a higher minimum age."
    ],
    motorbike: ["To ride a motorcycle or scooter you need a license that covers it."],
    helmet: ["Wear a helmet whenever you ride a motorcycle or scooter."],
    deposits: RENTAL_DEPOSITS,
    insurance: ["Ask what the rental price includes and what the excess is if the vehicle is damaged."],
    safety: [
      "Morocco drives on the right.",
      "Poor lighting makes night driving dangerous, and mountain roads can be hazardous in bad weather.",
      "After an accident, both drivers complete and sign an accident form (constat amiable)."
    ],
    sources: [S.ukMa, S.idpTable, S.renting, S.sides]
  }
};

const MONTHLY = "If you're staying three weeks or more, ask local businesses for a monthly price: it usually works out much cheaper per day than renting day by day.";

export const WORLD_DESTINATIONS: Destination[] = [
  // Europe
  {
    country: "portugal", slug: "algarve", name: "Algarve", region: "Faro", placeName: "Algarve", featured: true,
    center: { lat: 37.1, lng: -8.25 }, radiusKm: 70,
    intro: "Portugal's southern coast: cliffs and coves in the west, long sandy beaches in the east. Villages and beaches are spread out, so your own wheels make the most of it.",
    gettingAround: ["Faro Airport is the main gateway to the region.", "Some Portuguese motorways take electronic tolls only, so ask the business how tolls are paid before you set off."],
    monthly: MONTHLY, sources: [S.racPt]
  },
  {
    country: "portugal", slug: "madeira", name: "Madeira", region: "Madeira", placeName: "Madeira", featured: true,
    center: { lat: 32.75, lng: -16.95 }, radiusKm: 35,
    intro: "A mountainous Atlantic island with levada walks, sea cliffs and Funchal on the south coast. A car gets you to the trailheads and viewpoints buses rarely reach.",
    gettingAround: ["Roads are steep and winding, with many tunnels. A car with enough power for the hills makes driving easier."],
    monthly: MONTHLY, sources: []
  },
  {
    country: "spain", slug: "mallorca", name: "Mallorca", region: "Balearic Islands", placeName: "Mallorca", featured: true,
    center: { lat: 39.6, lng: 2.95 }, radiusKm: 60,
    intro: "The largest Balearic island, from Palma's old town to the Serra de Tramuntana mountains and the calas of the east coast.",
    gettingAround: ["Palma's airport is a short drive from the city.", "Mountain roads in the Tramuntana are narrow and winding and shared with many cyclists; take them slowly."],
    monthly: MONTHLY, sources: []
  },
  {
    country: "spain", slug: "tenerife", name: "Tenerife", region: "Canary Islands", placeName: "Tenerife", featured: true,
    center: { lat: 28.29, lng: -16.63 }, radiusKm: 45,
    intro: "The largest of the Canary Islands, with beaches in the south and Mount Teide at its center. A car is the easiest way up to the national park.",
    gettingAround: ["The island has two airports, Tenerife South and Tenerife North.", "Roads up to Teide National Park climb steeply; allow time and keep fuel topped up."],
    monthly: MONTHLY, sources: []
  },
  {
    country: "greece", slug: "crete", name: "Crete", region: "Crete", placeName: "Crete", featured: true,
    center: { lat: 35.24, lng: 24.9 }, radiusKm: 140,
    intro: "Greece's largest island, with gorges, mountain villages and beaches on three seas. Distances are long, so a car is the practical way to explore.",
    gettingAround: ["The main highway runs along the north coast, linking Chania, Rethymno, Heraklion and Agios Nikolaos.", "Roads to the south coast cross the mountains and are slow and winding."],
    monthly: MONTHLY, sources: []
  },
  {
    country: "greece", slug: "santorini", name: "Santorini", region: "Cyclades", placeName: "Santorini", featured: true,
    center: { lat: 36.4, lng: 25.46 }, radiusKm: 12,
    intro: "The volcanic Cycladic island of white villages and caldera views. Scooters, quads and small cars are the usual way between beaches and villages.",
    gettingAround: ["Roads are narrow and busy in summer, and parking in Fira and Oia is limited, so a small vehicle is easiest.", "To ride a scooter or quad here you need a license with at least category A1 (see the rules below)."],
    monthly: MONTHLY, sources: [S.ukGr]
  },
  {
    country: "italy", slug: "sardinia", name: "Sardinia", region: "Sardinia", placeName: "Sardinia", featured: true,
    center: { lat: 40.1, lng: 9.0 }, radiusKm: 150,
    intro: "A large Mediterranean island with some of Europe's clearest water. Beaches are spread around a long coastline, so a car is the practical way around.",
    gettingAround: ["The main airports are Cagliari in the south, and Olbia and Alghero in the north.", "Watch for limited traffic zones (ZTL) in town centers."],
    monthly: MONTHLY, sources: [S.racIt]
  },
  {
    country: "italy", slug: "amalfi-coast", name: "Amalfi Coast and Sorrento", region: "Campania", placeName: "Amalfi", featured: true,
    center: { lat: 40.63, lng: 14.48 }, radiusKm: 25,
    intro: "Cliffside towns from Sorrento to Positano, Amalfi and Ravello. Many visitors rent a scooter: it's easier to park than a car.",
    gettingAround: ["The coast road is narrow, cliff-hugging and busy in summer, and parking is scarce and expensive.", "Town centers often have limited traffic zones (ZTL) with camera fines."],
    monthly: MONTHLY, sources: [S.racIt]
  },
  {
    country: "croatia", slug: "split", name: "Split and Dalmatia", region: "Dalmatia", placeName: "Split", featured: true,
    center: { lat: 43.508, lng: 16.44 }, radiusKm: 40,
    intro: "Split's Roman old town, the Dalmatian coast and ferries to the islands. A car or scooter opens up the coast road and the beaches beyond the city.",
    gettingAround: ["Ferries run from Split to islands such as Brač and Hvar. Ask the business whether you may take the vehicle on a ferry."],
    monthly: MONTHLY, sources: []
  },
  {
    country: "malta", slug: "malta-and-gozo", name: "Malta and Gozo", region: "Malta", placeName: "Valletta", featured: true,
    center: { lat: 35.92, lng: 14.43 }, radiusKm: 30,
    intro: "A small archipelago with Valletta, Mdina and Gozo's quieter coast. Distances are short, but traffic can be heavy around the main towns.",
    gettingAround: ["Malta drives on the left.", "Gozo is reached by car ferry from the north of Malta; check the business allows the vehicle on it."],
    monthly: MONTHLY, sources: [S.racMt]
  },
  // Americas
  {
    country: "united-states", slug: "maui", name: "Maui", region: "Hawaii", placeName: "Maui", featured: true,
    center: { lat: 20.8, lng: -156.33 }, radiusKm: 45,
    intro: "Hawaii's second-largest island, from the Road to Hana to Haleakalā. A car is close to essential: public transport is limited.",
    gettingAround: ["The Road to Hana is narrow and winding, with many one-lane bridges. Start early and give way at the bridges.", "Hawaii's helmet law only covers riders 17 and younger, but wearing one is always safer."],
    monthly: MONTHLY, sources: [S.iihs]
  },
  {
    country: "united-states", slug: "miami-florida-keys", name: "Miami and the Florida Keys", region: "Florida", placeName: "Miami", featured: true,
    center: { lat: 25.1, lng: -80.9 }, radiusKm: 170,
    intro: "Miami's beaches and neighborhoods, then the Overseas Highway island-hopping south to Key West.",
    gettingAround: ["The Overseas Highway (US-1) links the mainland to Key West across a chain of bridges.", "In Florida, motorcycle riders under 21 must wear a helmet."],
    monthly: MONTHLY, sources: [S.iihs]
  },
  {
    country: "mexico", slug: "cancun-riviera-maya", name: "Cancún and the Riviera Maya", region: "Quintana Roo", placeName: "Cancún", featured: true,
    center: { lat: 20.7, lng: -87.1 }, radiusKm: 90,
    intro: "Caribbean beaches, cenotes and Maya ruins from Cancún through Playa del Carmen to Tulum.",
    gettingAround: ["Highway 307 runs down the coast from Cancún through Playa del Carmen to Tulum.", "Check the rental price includes the Mexican liability insurance the law requires."],
    monthly: MONTHLY, sources: [S.mxIns]
  },
  {
    country: "costa-rica", slug: "guanacaste", name: "Guanacaste", region: "Guanacaste", placeName: "Liberia", featured: true,
    center: { lat: 10.45, lng: -85.6 }, radiusKm: 70,
    intro: "Costa Rica's Pacific northwest: surf beaches, dry forest and volcanoes, with an international airport at Liberia.",
    gettingAround: ["Some roads to beaches and national parks are unpaved; ask the business whether you need a 4x4, especially in the rainy season."],
    monthly: MONTHLY, sources: []
  },
  // Asia-Pacific
  {
    country: "japan", slug: "okinawa", name: "Okinawa", region: "Okinawa", placeName: "Naha", featured: true,
    center: { lat: 26.33, lng: 127.8 }, radiusKm: 60,
    intro: "Japan's subtropical islands, with beaches, reefs and the castles of the old Ryukyu kingdom. A car is the easiest way beyond Naha.",
    gettingAround: ["Naha Airport is in the south of the main island; the Okinawa Expressway runs north from Naha.", "Japan drives on the left and accepts only the 1949 Geneva IDP (or an official translation for a few countries)."],
    monthly: MONTHLY, sources: [S.jp]
  },
  {
    country: "new-zealand", slug: "queenstown", name: "Queenstown", region: "Otago", placeName: "Queenstown", featured: true,
    center: { lat: -45.03, lng: 168.66 }, radiusKm: 50,
    intro: "New Zealand's adventure capital on Lake Wakatipu, and the base for Milford Sound, Wanaka and the ski fields.",
    gettingAround: ["Queenstown Airport is close to town.", "Mountain and ski-field roads can need snow chains in winter; ask the business before you go."],
    monthly: MONTHLY, sources: []
  },
  // Africa and the Middle East
  {
    country: "south-africa", slug: "cape-town", name: "Cape Town", region: "Western Cape", placeName: "Cape Town", featured: true,
    center: { lat: -33.92, lng: 18.42 }, radiusKm: 50,
    intro: "Table Mountain, the Cape Peninsula and the winelands an hour inland. A car is the easiest way to see them.",
    gettingAround: ["Chapman's Peak Drive is a toll road along the coast.", "Keep doors locked and valuables out of sight, especially at traffic lights after dark."],
    monthly: MONTHLY, sources: [S.ukZa]
  },
  {
    country: "united-arab-emirates", slug: "dubai", name: "Dubai", region: "Dubai", placeName: "Dubai", featured: true,
    center: { lat: 25.2, lng: 55.27 }, radiusKm: 40,
    intro: "Beaches, malls and the desert on the city's edge, with fast highways linking it all.",
    gettingAround: ["Salik road tolls are charged automatically; the rental business usually passes them on from your deposit."],
    monthly: MONTHLY, sources: [S.uae]
  },
  {
    country: "morocco", slug: "marrakech", name: "Marrakech", region: "Marrakech-Safi", placeName: "Marrakech", featured: true,
    center: { lat: 31.63, lng: -8.0 }, radiusKm: 40,
    intro: "The red city, and the gateway to the Atlas Mountains, the desert road south and the coast at Essaouira.",
    gettingAround: ["The medina's narrow lanes aren't for cars; most visitors rent for trips out of the city.", "Avoid driving at night where you can: lighting is often poor."],
    monthly: MONTHLY, sources: [S.ukMa]
  }
];
