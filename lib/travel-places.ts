/**
 * Where a customer might take a rental vehicle from a location (Settings › Travel area, 7 Nov 2026): the location
 * country's land neighbors, and islands. No map geometry: one built-in list, easy to extend.
 *
 * - A location on an island (ISLANDS, found from its town, area or address) is asked about that island's `nearby`
 *   places: usually the mainland and the other islands of its group reached by vehicle ferry or bridge.
 * - A location anywhere else is asked about MAINLAND_FERRY: islands commonly reached by ferry with a vehicle.
 * - Every location is also asked about the country's land neighbors (LAND_NEIGHBORS, or REGION_NEIGHBORS where a
 *   country's land borders depend on where in it you are), plus EXTRA_PLACES.
 *
 * Place ids: "country:MY", "mainland:TH", "island:th-phangan", "group:gr-cyclades", "special:cy-north".
 * Names are English, written to read after "take the vehicle to ..." (so "the Netherlands", "mainland Thailand").
 * Only places we are confident about are listed: add to these tables, nothing else needs to change.
 * Plain data and functions, safe in server and client code.
 */

export type PlaceKind = "country" | "mainland" | "island" | "group" | "special";

export type IslandDef = {
  id: string;
  country: string;
  name: string;
  /** Lower-case words that put a location on this island (town, area, address). The longest match wins. */
  match: string[];
  /** Places asked about from this island. */
  nearby: string[];
};

/** English names, as they read after "to". Countries the app supports, plus every neighbor listed below. */
export const COUNTRY_NAMES: Record<string, string> = {
  AD: "Andorra", AF: "Afghanistan", AL: "Albania", AM: "Armenia", AT: "Austria", AZ: "Azerbaijan", BA: "Bosnia and Herzegovina",
  BD: "Bangladesh", BE: "Belgium", BG: "Bulgaria", BN: "Brunei", BT: "Bhutan", CH: "Switzerland", CN: "China", CY: "Cyprus",
  CZ: "Czechia", DE: "Germany", DK: "Denmark", ES: "Spain", FR: "France", GB: "the United Kingdom", GE: "Georgia", GI: "Gibraltar",
  GR: "Greece", HR: "Croatia", HU: "Hungary", ID: "Indonesia", IE: "Ireland", IN: "India", IQ: "Iraq", IR: "Iran", IT: "Italy",
  JP: "Japan", KG: "Kyrgyzstan", KH: "Cambodia", KP: "North Korea", KR: "South Korea", KZ: "Kazakhstan", LA: "Laos", LK: "Sri Lanka",
  LU: "Luxembourg", MA: "Morocco", MC: "Monaco", ME: "Montenegro", MK: "North Macedonia", MM: "Myanmar", MN: "Mongolia", MT: "Malta",
  MY: "Malaysia", NL: "the Netherlands", NP: "Nepal", PG: "Papua New Guinea", PH: "the Philippines", PK: "Pakistan", PL: "Poland",
  PT: "Portugal", RS: "Serbia", RU: "Russia", SG: "Singapore", SI: "Slovenia", SM: "San Marino", SY: "Syria", TH: "Thailand",
  TJ: "Tajikistan", TL: "Timor-Leste", TR: "Türkiye", TW: "Taiwan", VN: "Vietnam"
};

/** Country names as typed in setup (lib/onboarding-locations.ts) that lib/regional.ts does not know. */
export const COUNTRY_CODE_BY_NAME: Record<string, string> = {
  thailand: "TH", malaysia: "MY", indonesia: "ID", philippines: "PH", vietnam: "VN", "viet nam": "VN", cambodia: "KH", laos: "LA",
  singapore: "SG", china: "CN", japan: "JP", taiwan: "TW", "south korea": "KR", korea: "KR", brunei: "BN", india: "IN",
  bangladesh: "BD", "sri lanka": "LK", "united kingdom": "GB", uk: "GB", ireland: "IE", spain: "ES", portugal: "PT", italy: "IT",
  greece: "GR", croatia: "HR", cyprus: "CY", malta: "MT", france: "FR", germany: "DE", "türkiye": "TR", turkiye: "TR", turkey: "TR"
};

/** Countries you can drive into (by road, bridge, causeway or the Channel Tunnel). Closed borders are left out (South Korea). */
export const LAND_NEIGHBORS: Record<string, string[]> = {
  TH: ["KH", "LA", "MY", "MM"],
  MY: ["SG", "TH"],
  ID: [],
  PH: [],
  VN: ["CN", "KH", "LA"],
  KH: ["LA", "TH", "VN"],
  LA: ["CN", "KH", "MM", "TH", "VN"],
  SG: ["MY"],
  BN: ["MY"],
  CN: ["AF", "BT", "IN", "KZ", "KP", "KG", "LA", "MN", "MM", "NP", "PK", "RU", "TJ", "VN"],
  JP: [],
  TW: [],
  KR: [],
  IN: ["BD", "BT", "CN", "MM", "NP", "PK"],
  BD: ["IN", "MM"],
  LK: [],
  // Ireland across the Northern Ireland border (or by ferry); France through the Channel Tunnel or by ferry.
  GB: ["FR", "IE"],
  IE: ["GB", "FR"],
  ES: ["AD", "FR", "GI", "PT"],
  PT: ["ES"],
  IT: ["AT", "CH", "FR", "SI", "SM"],
  GR: ["AL", "BG", "MK", "TR"],
  HR: ["BA", "HU", "ME", "RS", "SI"],
  CY: [],
  MT: [],
  FR: ["AD", "BE", "CH", "DE", "ES", "GB", "IT", "LU", "MC"],
  DE: ["AT", "BE", "CH", "CZ", "DK", "FR", "LU", "NL", "PL"],
  TR: ["AM", "AZ", "BG", "GE", "GR", "IQ", "IR", "SY"]
};

/** Where a country's land borders depend on the region (lower-case region words). */
export const REGION_NEIGHBORS: Record<string, Array<{ match: string[]; neighbors: string[]; /** Replaces MAINLAND_FERRY there. */ ferry?: string[] }>> = {
  // Malaysian Borneo borders Brunei and Indonesia (and the peninsula's ferry islands are far away); the peninsula
  // borders Thailand and Singapore.
  MY: [{ match: ["sabah", "sarawak", "kota kinabalu", "kuching", "miri", "sandakan", "tawau", "semporna", "sibu"], neighbors: ["BN", "ID"], ferry: [] }],
  // Indonesia's only land borders are on Borneo, Timor and New Guinea.
  ID: [
    { match: ["kalimantan", "borneo"], neighbors: ["MY"] },
    { match: ["east nusa tenggara", "nusa tenggara timur", "kupang", "timor"], neighbors: ["TL"] },
    { match: ["papua", "jayapura"], neighbors: ["PG"] }
  ]
};

/** The name for "the rest of the country" when a location is on one of its islands. */
export const MAINLAND_NAMES: Record<string, string> = {
  TH: "mainland Thailand", MY: "mainland Malaysia", VN: "mainland Vietnam", KH: "mainland Cambodia", CN: "mainland China",
  JP: "mainland Japan", KR: "mainland South Korea", TW: "the main island of Taiwan", GB: "Great Britain", ES: "mainland Spain",
  IT: "mainland Italy", GR: "mainland Greece", HR: "mainland Croatia", FR: "mainland France", TR: "mainland Türkiye"
};

/** Places that are not a country, an island in ISLANDS or a mainland. */
export const OTHER_PLACE_NAMES: Record<string, string> = {
  "group:es-balearics": "the Balearic Islands",
  "group:es-canaries": "the Canary Islands",
  "group:gr-cyclades": "the Cyclades",
  "group:gr-dodecanese": "the Dodecanese",
  "group:gr-ionian": "the Ionian Islands",
  "group:gb-channel-islands": "the Channel Islands",
  "group:gb-isle-of-man": "the Isle of Man",
  "group:gb-scottish-islands": "the Scottish islands",
  "special:cy-north": "Northern Cyprus"
};

/** Asked about everywhere in the country. */
export const EXTRA_PLACES: Record<string, string[]> = {
  // Crossing the Green Line into the north is a common rental question in Cyprus.
  CY: ["special:cy-north"]
};

const isl = (country: string, id: string, name: string, match: string[], nearby: string[]): IslandDef => ({ id, country, name, match, nearby });

const CANARIES = ["tenerife", "grancanaria", "lanzarote", "fuerteventura", "lapalma", "gomera", "hierro"];
const BALEARICS = ["mallorca", "ibiza", "menorca", "formentera"];
const others = (prefix: string, ids: string[], self: string) => ids.filter((id) => id !== self).map((id) => `island:${prefix}-${id}`);

export const ISLANDS: IslandDef[] = [
  // Thailand. Samui, Phangan and Tao: car ferries between Samui and Phangan and to the mainland (Donsak); Phuket has a bridge.
  isl("TH", "th-samui", "Koh Samui", ["samui", "chaweng", "lamai", "bophut", "bo phut", "maenam", "mae nam", "nathon", "choeng mon", "plai laem", "bang rak", "big buddha", "lipa noi", "taling ngam", "hua thanon"], ["mainland:TH", "island:th-phangan", "island:th-tao"]),
  isl("TH", "th-phangan", "Koh Phangan", ["phangan", "pha ngan", "thong sala", "thongsala", "haad rin", "hat rin", "srithanu", "sri thanu", "chaloklum", "chalok lam", "haad yao", "baan tai", "ban tai"], ["mainland:TH", "island:th-samui", "island:th-tao"]),
  isl("TH", "th-tao", "Koh Tao", ["koh tao", "ko tao", "sairee", "mae haad"], ["mainland:TH", "island:th-samui", "island:th-phangan"]),
  isl("TH", "th-phuket", "Phuket", ["phuket", "patong", "rawai", "chalong", "kata", "karon", "kamala", "thalang", "mai khao", "nai harn", "bang tao"], ["mainland:TH"]),
  isl("TH", "th-lanta", "Koh Lanta", ["koh lanta", "ko lanta", "lanta"], ["mainland:TH"]),
  isl("TH", "th-chang", "Koh Chang", ["koh chang", "ko chang"], ["mainland:TH"]),
  isl("TH", "th-kood", "Koh Kood", ["koh kood", "koh kut", "ko kut"], ["mainland:TH"]),
  isl("TH", "th-mak", "Koh Mak", ["koh mak", "ko mak"], ["mainland:TH"]),
  isl("TH", "th-samet", "Koh Samet", ["koh samet", "ko samet"], ["mainland:TH"]),
  isl("TH", "th-lipe", "Koh Lipe", ["koh lipe", "ko lipe"], ["mainland:TH"]),
  // Malaysia. Penang Island has two bridges; Langkawi and Pangkor have vehicle ferries.
  isl("MY", "my-penang", "Penang Island", ["george town", "georgetown", "batu ferringhi", "bayan lepas", "tanjung tokong", "penang island", "air itam", "balik pulau"], ["mainland:MY"]),
  isl("MY", "my-langkawi", "Langkawi", ["langkawi", "kuah", "pantai cenang", "cenang"], ["mainland:MY"]),
  isl("MY", "my-pangkor", "Pangkor Island", ["pangkor"], ["mainland:MY"]),
  // Indonesia. Vehicle ferries Java–Bali (Ketapang–Gilimanuk), Bali–Lombok (Padangbai–Lembar), Bali–Nusa Penida,
  // Lombok–Sumbawa, Java–Sumatra (Merak–Bakauheni), Batam–Bintan. No motor vehicles on the Gili islands.
  isl("ID", "id-bali", "Bali", ["bali", "canggu", "seminyak", "ubud", "denpasar", "kuta", "sanur", "nusa dua", "uluwatu", "jimbaran", "legian"], ["island:id-java", "island:id-lombok", "island:id-penida"]),
  isl("ID", "id-penida", "Nusa Penida", ["nusa penida", "penida"], ["island:id-bali"]),
  isl("ID", "id-lombok", "Lombok", ["lombok", "mataram", "senggigi", "kuta lombok", "praya"], ["island:id-bali", "island:id-sumbawa"]),
  isl("ID", "id-gili", "the Gili islands", ["gili"], ["island:id-lombok"]),
  isl("ID", "id-sumbawa", "Sumbawa", ["sumbawa"], ["island:id-lombok"]),
  isl("ID", "id-java", "Java", ["java", "jakarta", "soekarno-hatta", "bandung", "bogor", "bekasi", "depok", "cirebon", "semarang", "surakarta", "magelang", "surabaya", "malang", "banyuwangi", "sidoarjo", "yogyakarta", "sleman", "bantul"], ["island:id-bali", "island:id-sumatra"]),
  isl("ID", "id-sumatra", "Sumatra", ["sumatra", "medan", "lake toba", "kualanamu"], ["island:id-java"]),
  isl("ID", "id-batam", "Batam", ["batam"], ["island:id-bintan"]),
  isl("ID", "id-bintan", "Bintan", ["bintan", "tanjung pinang"], ["island:id-batam"]),
  // Philippines: RoRo vehicle ferries.
  isl("PH", "ph-luzon", "Luzon", ["luzon", "metro manila", "manila", "makati", "bgc", "taguig", "pasay", "quezon city", "paranaque", "parañaque", "alabang", "baguio", "benguet", "la trinidad", "la union"], ["island:ph-mindoro"]),
  isl("PH", "ph-mindoro", "Mindoro", ["mindoro", "puerto galera", "calapan"], ["island:ph-luzon", "island:ph-panay"]),
  isl("PH", "ph-cebu", "Cebu", ["cebu", "mactan", "lapu-lapu", "lapu lapu", "mandaue", "moalboal", "oslob"], ["island:ph-bohol", "island:ph-negros", "island:ph-leyte", "island:ph-bantayan"]),
  isl("PH", "ph-bantayan", "Bantayan Island", ["bantayan"], ["island:ph-cebu"]),
  isl("PH", "ph-bohol", "Bohol", ["bohol", "tagbilaran", "panglao", "anda"], ["island:ph-cebu"]),
  isl("PH", "ph-negros", "Negros", ["negros", "dumaguete", "dauin", "bacolod", "siquijor ferry"], ["island:ph-cebu", "island:ph-siquijor", "island:ph-panay"]),
  isl("PH", "ph-siquijor", "Siquijor", ["siquijor"], ["island:ph-negros"]),
  isl("PH", "ph-panay", "Panay", ["panay", "iloilo", "kalibo", "caticlan", "roxas city"], ["island:ph-negros", "island:ph-mindoro"]),
  isl("PH", "ph-boracay", "Boracay", ["boracay"], ["island:ph-panay"]),
  isl("PH", "ph-leyte", "Leyte", ["leyte", "tacloban", "ormoc"], ["island:ph-cebu"]),
  isl("PH", "ph-mindanao", "Mindanao", ["mindanao", "davao", "cagayan de oro", "general santos"], ["island:ph-samal"]),
  isl("PH", "ph-samal", "Samal Island", ["samal"], ["island:ph-mindanao"]),
  isl("PH", "ph-palawan", "Palawan", ["palawan", "puerto princesa", "el nido", "port barton", "san vicente"], []),
  // Vietnam: car ferries to Phu Quoc (Ha Tien, Rach Gia) and Cat Ba.
  isl("VN", "vn-phuquoc", "Phu Quoc", ["phu quoc", "duong dong", "an thoi"], ["mainland:VN"]),
  isl("VN", "vn-catba", "Cat Ba Island", ["cat ba"], ["mainland:VN"]),
  isl("KH", "kh-kohrong", "Koh Rong", ["koh rong"], ["mainland:KH"]),
  // East Asia: car ferries across the Qiongzhou Strait, Honshu–Hokkaido, Kagoshima–Okinawa, mainland–Jeju, Taiwan–Penghu.
  isl("CN", "cn-hainan", "Hainan", ["hainan", "sanya", "haikou", "wanning", "qionghai"], ["mainland:CN"]),
  isl("JP", "jp-hokkaido", "Hokkaido", ["hokkaido", "sapporo", "new chitose", "niseko", "furano", "hakodate"], ["mainland:JP"]),
  isl("JP", "jp-okinawa", "Okinawa Island", ["okinawa", "naha", "chatan"], ["mainland:JP"]),
  isl("JP", "jp-ishigaki", "Ishigaki", ["ishigaki"], []),
  isl("JP", "jp-miyako", "Miyako Island", ["miyakojima", "miyako"], []),
  isl("KR", "kr-jeju", "Jeju", ["jeju", "seogwipo", "aewol", "jungmun"], ["mainland:KR"]),
  isl("TW", "tw-penghu", "Penghu", ["penghu", "magong"], ["mainland:TW"]),
  // United Kingdom. Northern Ireland is on the island of Ireland: Great Britain is a ferry away.
  isl("GB", "gb-ni", "Northern Ireland", ["northern ireland", "belfast", "derry", "londonderry"], ["mainland:GB"]),
  isl("GB", "gb-wight", "the Isle of Wight", ["isle of wight", "cowes", "ryde"], ["mainland:GB"]),
  // Spain. Canary and Balearic car ferries run between the islands and to the mainland (Cádiz/Huelva; Barcelona, Valencia, Dénia).
  isl("ES", "es-tenerife", "Tenerife", ["tenerife", "los cristianos", "adeje", "puerto de la cruz"], [...others("es", CANARIES, "tenerife"), "mainland:ES"]),
  isl("ES", "es-grancanaria", "Gran Canaria", ["gran canaria", "las palmas", "maspalomas", "playa del ingles", "playa del inglés"], [...others("es", CANARIES, "grancanaria"), "mainland:ES"]),
  isl("ES", "es-lanzarote", "Lanzarote", ["lanzarote", "arrecife", "puerto del carmen"], [...others("es", CANARIES, "lanzarote"), "mainland:ES"]),
  isl("ES", "es-fuerteventura", "Fuerteventura", ["fuerteventura", "corralejo", "puerto del rosario"], [...others("es", CANARIES, "fuerteventura"), "mainland:ES"]),
  isl("ES", "es-lapalma", "La Palma", ["la palma", "santa cruz de la palma"], [...others("es", CANARIES, "lapalma"), "mainland:ES"]),
  isl("ES", "es-gomera", "La Gomera", ["gomera"], [...others("es", CANARIES, "gomera"), "mainland:ES"]),
  isl("ES", "es-hierro", "El Hierro", ["el hierro"], [...others("es", CANARIES, "hierro"), "mainland:ES"]),
  isl("ES", "es-mallorca", "Mallorca", ["mallorca", "majorca", "palma de mallorca", "alcudia", "alcúdia"], [...others("es", BALEARICS, "mallorca"), "mainland:ES"]),
  isl("ES", "es-ibiza", "Ibiza", ["ibiza", "eivissa", "sant antoni"], [...others("es", BALEARICS, "ibiza"), "mainland:ES"]),
  isl("ES", "es-menorca", "Menorca", ["menorca", "minorca", "mahon", "mahón", "ciutadella"], [...others("es", BALEARICS, "menorca"), "mainland:ES"]),
  isl("ES", "es-formentera", "Formentera", ["formentera"], [...others("es", BALEARICS, "formentera"), "mainland:ES"]),
  // Portugal: the Porto Santo ferry carries cars; the Azores are left without questions.
  isl("PT", "pt-madeira", "Madeira", ["madeira", "funchal"], ["island:pt-portosanto"]),
  isl("PT", "pt-portosanto", "Porto Santo", ["porto santo"], ["island:pt-madeira"]),
  isl("PT", "pt-azores", "the Azores", ["azores", "açores", "ponta delgada", "são miguel", "sao miguel"], []),
  // Italy: car ferries across the Strait of Messina, to Sardinia and Elba, Sicily–Malta (Pozzallo) and Sardinia–Corsica.
  isl("IT", "it-sicily", "Sicily", ["sicily", "sicilia", "catania", "palermo", "taormina", "siracusa", "syracuse", "messina"], ["mainland:IT", "country:MT"]),
  isl("IT", "it-sardinia", "Sardinia", ["sardinia", "sardegna", "cagliari", "olbia", "alghero"], ["mainland:IT", "island:fr-corsica"]),
  isl("IT", "it-elba", "Elba", ["elba", "portoferraio"], ["mainland:IT"]),
  // Greece.
  isl("GR", "gr-crete", "Crete", ["crete", "heraklion", "iraklio", "chania", "rethymno", "agios nikolaos"], ["mainland:GR", "group:gr-cyclades"]),
  isl("GR", "gr-rhodes", "Rhodes", ["rhodes", "rodos", "lindos"], ["mainland:GR", "group:gr-dodecanese", "country:TR"]),
  isl("GR", "gr-kos", "Kos", ["kos"], ["mainland:GR", "group:gr-dodecanese", "country:TR"]),
  isl("GR", "gr-santorini", "Santorini", ["santorini", "thira", "fira", "oia"], ["mainland:GR", "group:gr-cyclades", "island:gr-crete"]),
  isl("GR", "gr-mykonos", "Mykonos", ["mykonos"], ["mainland:GR", "group:gr-cyclades", "island:gr-crete"]),
  isl("GR", "gr-naxos", "Naxos", ["naxos"], ["mainland:GR", "group:gr-cyclades", "island:gr-crete"]),
  isl("GR", "gr-paros", "Paros", ["paros", "parikia"], ["mainland:GR", "group:gr-cyclades", "island:gr-crete"]),
  isl("GR", "gr-corfu", "Corfu", ["corfu", "kerkyra"], ["mainland:GR", "group:gr-ionian", "country:IT"]),
  isl("GR", "gr-zakynthos", "Zakynthos", ["zakynthos", "zante"], ["mainland:GR", "island:gr-kefalonia"]),
  isl("GR", "gr-kefalonia", "Kefalonia", ["kefalonia", "cephalonia", "argostoli"], ["mainland:GR", "island:gr-zakynthos", "island:gr-lefkada"]),
  isl("GR", "gr-lefkada", "Lefkada", ["lefkada", "lefkas"], ["mainland:GR", "island:gr-kefalonia"]),
  // Croatia: Jadrolinija car ferries from the mainland.
  isl("HR", "hr-hvar", "Hvar", ["hvar", "stari grad", "jelsa"], ["mainland:HR"]),
  isl("HR", "hr-brac", "Brač", ["brač", "brac", "supetar"], ["mainland:HR"]),
  isl("HR", "hr-korcula", "Korčula", ["korčula", "korcula"], ["mainland:HR"]),
  isl("HR", "hr-vis", "Vis", ["vis island", "otok vis"], ["mainland:HR"]),
  isl("HR", "hr-cres", "Cres", ["cres", "mali lošinj", "mali losinj"], ["mainland:HR"]),
  isl("HR", "hr-rab", "Rab", ["rab island", "otok rab"], ["mainland:HR"]),
  // Malta: the Gozo Channel car ferry, and Malta–Sicily (Virtu Ferries).
  isl("MT", "mt-malta", "Malta (the main island)", ["valletta", "sliema", "st julian's", "st julians", "mellieħa", "mellieha", "malta airport", "bugibba", "qawra", "st paul's bay"], ["island:mt-gozo", "country:IT"]),
  isl("MT", "mt-gozo", "Gozo", ["gozo", "għawdex"], ["island:mt-malta", "country:IT"]),
  // France: Corsica car ferries to mainland France, Sardinia (Bonifacio) and Italy (Livorno).
  isl("FR", "fr-corsica", "Corsica", ["corsica", "corse", "ajaccio", "bastia", "porto-vecchio", "porto vecchio", "calvi", "bonifacio"], ["mainland:FR", "island:it-sardinia", "mainland:IT"]),
  // Türkiye: car ferries to Bozcaada (Geyikli) and Gökçeada (Kabatepe).
  isl("TR", "tr-bozcaada", "Bozcaada", ["bozcaada"], ["mainland:TR"]),
  isl("TR", "tr-gokceada", "Gökçeada", ["gökçeada", "gokceada"], ["mainland:TR"])
];

/** Islands (and island groups) commonly reached by ferry with a vehicle, asked about from anywhere else in the country. */
export const MAINLAND_FERRY: Record<string, string[]> = {
  TH: ["island:th-samui", "island:th-phangan", "island:th-chang", "island:th-lanta"],
  MY: ["island:my-langkawi", "island:my-pangkor"],
  VN: ["island:vn-phuquoc", "island:vn-catba"],
  CN: ["island:cn-hainan"],
  JP: ["island:jp-hokkaido", "island:jp-okinawa"],
  KR: ["island:kr-jeju"],
  TW: ["island:tw-penghu"],
  GB: ["island:gb-ni", "island:gb-wight", "group:gb-channel-islands", "group:gb-isle-of-man", "group:gb-scottish-islands"],
  ES: ["group:es-balearics", "group:es-canaries", "country:MA"],
  IT: ["island:it-sicily", "island:it-sardinia", "island:it-elba"],
  GR: ["island:gr-crete", "group:gr-cyclades", "group:gr-dodecanese", "group:gr-ionian"],
  HR: ["island:hr-brac", "island:hr-cres", "island:hr-hvar", "island:hr-korcula", "island:hr-rab", "island:hr-vis"],
  // A location on Malta's main island whose town is not listed.
  MT: ["island:mt-gozo", "country:IT"],
  FR: ["island:fr-corsica"],
  TR: ["island:tr-bozcaada", "island:tr-gokceada", "special:cy-north"]
};

const ISLAND_BY_ID = new Map(ISLANDS.map((island) => [island.id, island]));

export function islandById(id: string | null | undefined) {
  return id ? ISLAND_BY_ID.get(id) || null : null;
}

/** The islands listed for a country, alphabetically. */
export function islandsOf(country: string) {
  return ISLANDS.filter((island) => island.country === country).sort((a, b) => plainName(a.name).localeCompare(plainName(b.name)));
}

const fold = (text: unknown) =>
  String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
const plainName = (name: string) => name.replace(/^the /i, "");
const wordMatch = (text: string, word: string) => new RegExp(`(^|[^a-z0-9])${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`).test(text);

/**
 * The island a location is on, from its texts in order of trust (town first, then name and address, then region):
 * the first text that names a listed island decides, the longest match winning ("kuta lombok" over "kuta").
 */
export function detectIsland(country: string, texts: Array<string | null | undefined>): string {
  const candidates = ISLANDS.filter((island) => island.country === country);
  for (const raw of texts) {
    const text = fold(raw);
    if (!text) continue;
    let best: { id: string; length: number } | null = null;
    for (const island of candidates) {
      for (const word of island.match) {
        const folded = fold(word);
        if (folded.length > (best?.length || 0) && wordMatch(text, folded)) best = { id: island.id, length: folded.length };
      }
    }
    if (best) return best.id;
  }
  return "";
}

export function placeKind(id: string): PlaceKind {
  return (id.split(":")[0] as PlaceKind) || "special";
}

/** The English name of a place, as it reads after "take the vehicle to". */
export function placeName(id: string): string {
  const [kind, key] = id.split(":");
  if (kind === "country") return COUNTRY_NAMES[key] || key;
  if (kind === "mainland") return MAINLAND_NAMES[key] || `mainland ${COUNTRY_NAMES[key] || key}`;
  if (kind === "island") return islandById(key)?.name || key;
  return OTHER_PLACE_NAMES[id] || key || id;
}

/** The REGION_NEIGHBORS entry that applies to a location in this region, if any. */
function regionEntry(country: string, regionTexts: Array<string | null | undefined>) {
  const text = fold(regionTexts.filter(Boolean).join(" | "));
  return (REGION_NEIGHBORS[country] || []).find((entry) => entry.match.some((word) => wordMatch(text, fold(word)))) || null;
}

/** The country's land neighbors from a location in this region. */
export function landNeighbors(country: string, regionTexts: Array<string | null | undefined> = []): string[] {
  return regionEntry(country, regionTexts)?.neighbors || LAND_NEIGHBORS[country] || [];
}

/**
 * The places to ask about for a location: the mainland and islands first (from its island, or the ferry islands of
 * the country), then the land neighbors, then anything asked about everywhere in the country. No repeats.
 */
export function placesFor(country: string, island: string, regionTexts: Array<string | null | undefined> = []): string[] {
  const onIsland = islandById(island);
  const water = onIsland && onIsland.country === country ? onIsland.nearby : regionEntry(country, regionTexts)?.ferry || MAINLAND_FERRY[country] || [];
  const land = landNeighbors(country, regionTexts).map((code) => `country:${code}`);
  const all = [...water, ...land, ...(EXTRA_PLACES[country] || [])].filter((id) => id !== `island:${island}`);
  return Array.from(new Set(all));
}

/** A country code from a code or a setup name ("Japan", "JP", "Türkiye"); "" when unknown. */
export function countryCodeOf(value: unknown): string {
  const text = String(value || "").trim();
  if (/^[a-z]{2}$/i.test(text)) return text.toUpperCase() === "UK" ? "GB" : text.toUpperCase();
  return COUNTRY_CODE_BY_NAME[text.toLowerCase()] || "";
}
