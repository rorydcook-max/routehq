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
