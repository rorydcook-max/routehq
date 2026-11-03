import type { DraftPaperwork, DraftRental, DraftVehicle } from "@/app/actions/fleet-assistant";

/**
 * The fleet assistant inside the live chat (Rory, 3 Nov 2026: "Why can we not just have one assistant?"). A vehicle
 * photo, a policy photo or "add a 2022 Honda Click" sent in the chat goes to askFleetAssistant, and its lists come
 * back as cards in the conversation. The lists live in the meta of the chat's latest fleet reply (support_messages),
 * so a reload shows the cards as they were left. No server or client imports: both sides use this.
 */
export type ChatFleet = {
  draft: DraftVehicle[];
  rentals: DraftRental[];
  paperwork: DraftPaperwork[];
  /** Storage paths (support bucket) of every photo the fleet assistant has seen in this chat, in order: Photo 1 first. */
  photos: string[];
  /** What was done or dismissed, told to the model as its own earlier words, so it doesn't list them again. */
  notes?: string[];
  /** Vehicles already added (vehicleKey), kept off the list even when the model repeats them. */
  added?: string[];
  currency?: string;
  /** Each paperwork kind's name in this country ("Road tax (LKM)"), by key. */
  paperNames?: Record<string, string>;
};

/** Who may add vehicles and renew their paperwork: the same roles the vehicles table lets in (RLS). */
export const FLEET_ROLES = ["owner", "manager", "operator"];

export function vehicleKey(vehicle: DraftVehicle) {
  return [vehicle.make, vehicle.model, vehicle.year, vehicle.plate].map((part) => String(part ?? "").trim().toLowerCase()).join("|");
}

export function withoutAdded(list: DraftVehicle[], added: string[] = []) {
  const left = [...added];
  return list.filter((vehicle) => {
    const at = left.indexOf(vehicleKey(vehicle));
    if (at === -1) return true;
    left.splice(at, 1);
    return false;
  });
}

/** The model is told what the owner removed, so a wrong reading isn't put back on the list next turn. */
export function dismissNote(item: DraftPaperwork) {
  return `The owner removed the ${item.kind} entry for ${item.vehicleName || item.vehicleId} as wrong; do not list it again unless they ask.`;
}

/**
 * A message that is about the fleet in so many words: adding vehicles ("add a 2022 Honda Click, plate 1กก 1234"),
 * a Google Sheet of them, who's renting one now, or paperwork renewed. How-to questions are checked first by the caller.
 */
export function isFleetText(text: string) {
  const words = String(text || "");
  return (
    /https:\/\/docs\.google\.com\/spreadsheets\//.test(words) ||
    /\b(add|adding|new|bought|got)\b.{0,40}\b(car|cars|vehicle|vehicles|bike|bikes|motorbike|motorbikes|motorcycle|motorcycles|scooter|scooters|van|vans|truck|pickup|suv)\b/i.test(words) ||
    /\badd\b.{0,30}\b(19|20)\d{2}\b/i.test(words) ||
    /\b(add|new)\b.{0,30}\b(honda|toyota|yamaha|suzuki|kawasaki|vespa|nissan|mazda|mitsubishi|isuzu|ford|kia|hyundai|mg|byd|bmw|mercedes|ducati|triumph|royal enfield|gpx)\b/i.test(words) ||
    /\b(is|are) (rented|renting)\b|\brented (out )?to\b|\brenewed (the |my |its )?(insurance|tax|road tax|policy|inspection)\b/i.test(words) ||
    /เพิ่มรถ|รถใหม่|ต่อภาษี|ต่อประกัน|ต่อ พ\.ร\.บ|เช่าอยู่/.test(words)
  );
}
