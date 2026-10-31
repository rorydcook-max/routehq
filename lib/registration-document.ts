/**
 * The vehicle registration document has a different name in each country (Rory, 31 Oct 2026): the blue book in
 * Thailand, the BPKB or STNK in Indonesia, the OR/CR in the Philippines... The add-vehicle form names the
 * business's own one (wording in locales/<lang>/common.json, vehicleForm.regDoc_<country>), and the photo reader
 * is told which one to expect.
 */

export const REG_DOC_COUNTRIES = ["TH", "ID", "VN", "MY", "PH", "LA", "KH"] as const;

/** The translation key for the document's name in a country; "regDoc_default" elsewhere. */
export function regDocKey(country: string | null | undefined) {
  const code = String(country || "").toUpperCase();
  return (REG_DOC_COUNTRIES as readonly string[]).includes(code) ? `regDoc_${code}` : "regDoc_default";
}

/** For the photo reader: what the document is, in English. */
export function regDocForReader(country: string | null | undefined) {
  switch (String(country || "").toUpperCase()) {
    case "TH":
      return "a Thai vehicle registration book (the blue book, เล่มทะเบียนรถ)";
    case "ID":
      return "an Indonesian BPKB (vehicle ownership book) or STNK (vehicle registration certificate)";
    case "VN":
      return "a Vietnamese vehicle registration certificate (giấy đăng ký xe, cà vẹt)";
    case "MY":
      return "a Malaysian vehicle ownership certificate (VOC, geran)";
    case "PH":
      return "a Philippine LTO OR/CR (Official Receipt and Certificate of Registration)";
    case "LA":
      return "a Lao vehicle registration book";
    case "KH":
      return "a Cambodian vehicle registration card";
    default:
      return "a vehicle registration document";
  }
}
