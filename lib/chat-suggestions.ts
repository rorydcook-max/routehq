/**
 * The starter chips the live chat shows before anything is typed, chosen by the page the person is on.
 * No server imports: the chat panel (a client component) reads this directly.
 *
 * Two kinds of chip:
 * - "ask": sends its prompt as a message to the assistant (one assistant does everything: help, figures and tasks).
 *   `ownerOnly` chips are about the business's figures, which only the owner sees.
 * - "action": a file flow (pick a receipt, vehicle photos, a contract, a spreadsheet, damage photos). Picking one
 *   opens the file picker and tells the server what the files are, so they go straight to the right tool. ("handoff"
 *   is only sent by openChat() from elsewhere in the app; the panel's header has its own Talk to a person button.)
 *
 * `label` is a key in the "chat" namespace of the locale files.
 */

export type ChatFileKind = "receipt" | "vehicle" | "contract" | "spreadsheet" | "damage" | "other";
export type ChatActionChip = ChatFileKind | "handoff";

export type ChatChip =
  | { kind: "ask"; label: string; ownerOnly?: boolean }
  | { kind: "action"; label: string; action: ChatActionChip; ownerOnly?: boolean; fleetOnly?: boolean };

const ask = (label: string, ownerOnly = false): ChatChip => ({ kind: "ask", label, ownerOnly });
const figures = (label: string) => ask(label, true);
const act = (label: string, action: ChatActionChip, ownerOnly = false): ChatChip => ({ kind: "action", label, action, ownerOnly, fleetOnly: action === "vehicle" });

// Starters for pages without their own list: how-to questions anyone can ask.
const HOW_TO: ChatChip[] = [ask("sTakeDeposit"), ask("sHandover"), ask("sOnlineBooking")];

/**
 * The chips for a path. `site` is true on the public website (visitors and signed-in people browsing it): there the
 * questions are about RoveHQ itself, never anyone's records. `fleet`: may add vehicles (owners and managers).
 */
export function chatSuggestions(pathname: string, options: { site: boolean; owner: boolean; fleet?: boolean }): ChatChip[] {
  const path = (pathname || "/").split("?")[0].replace(/\/+$/, "") || "/";
  const list = pick(path, options.site);
  // Teammates can't see the figures nor reach Settings; vehicles are added by the owner or a manager.
  return list.filter((chip) => (options.owner || !chip.ownerOnly) && (options.owner || options.fleet !== false || !(chip.kind === "action" && chip.fleetOnly))).slice(0, 6);
}

function pick(path: string, site: boolean): ChatChip[] {
  // No "Talk to a person" chip anywhere: the panel's header has that button already.
  if (site) return [ask("sCost"), ask("sImportSheet"), ask("sCustomersSign")];

  if (path === "/" || path === "/tasks") return [figures("sOwesMe"), figures("sDueWeek"), ask("sNewBooking"), ask("sRecordPayment"), act("sRecordReceipt", "receipt")];
  // "Add vehicles from photos" opens the file picker; the photos are read in the chat itself.
  if (path === "/fleet") return [act("sVehiclePhotos", "vehicle"), act("sRenewPolicy", "vehicle"), act("sImportSpreadsheet", "spreadsheet", true), ask("sAddVehicleHow")];
  if (path === "/fleet/new" || path === "/fleet/import") return [act("sVehiclePhotos", "vehicle"), act("sImportSpreadsheet", "spreadsheet", true), ask("sAddVehicleHow")];
  if (/^\/fleet\/[^/]+$/.test(path) && !/^\/fleet\/(new|import|assistant)$/.test(path)) return [figures("sTaxRunsOut"), ask("sRecordService"), ask("sNewBooking"), act("sRenewPolicy", "vehicle"), ask("sArchiveHow")];
  if (path.startsWith("/fleet")) return [act("sVehiclePhotos", "vehicle"), ask("sAddVehicleHow")];
  if (/^\/bookings\/[^/]+$/.test(path) && path !== "/bookings/new") return [ask("sRecordPayment"), ask("sExtendRental"), ask("sDepositBack"), act("sDamagePhotos", "damage")];
  if (path.startsWith("/bookings")) return [ask("sNewBooking"), ask("sBookingLink"), ask("sRecordPayment"), figures("sDueWeek")];
  if (path.startsWith("/transactions")) return [act("sRecordReceipt", "receipt"), ask("sRecordPayment"), ask("sRecordCost"), figures("sOwesMe")];
  if (path.startsWith("/settings/contracts")) return [act("sUploadContract", "contract", true), ask("sContractHow")];
  if (path.startsWith("/settings")) return [ask("sAddTeammate"), ask("sOnlineBooking"), ask("sContractHow"), ask("sBrandHow")];
  if (path.startsWith("/help")) return [...HOW_TO, ask("sAddVehicleHow")];
  if (path.startsWith("/customers")) return [ask("sNewBooking"), ask("sAddCustomerHow"), figures("sOwesMe")];
  if (path.startsWith("/inbox")) return [ask("sConnectWhatsApp"), ask("sConnectLine")];
  if (path.startsWith("/reports")) return [figures("sLeastMoney"), figures("sNextSixMonths")];
  return [figures("sOwesMe"), ask("sNewBooking"), ask("sRecordPayment"), ...HOW_TO.slice(0, 2)];
}

/** A file's kind from its name and type alone, when that settles it (spreadsheets, Word files). Otherwise null. */
export function fileKindFromName(name: string, type = ""): ChatFileKind | null {
  const lower = String(name || "").toLowerCase();
  if (/\.(csv|xls|xlsx|ods|numbers|tsv)$/.test(lower) || /spreadsheet|excel|csv/.test(type)) return "spreadsheet";
  // A Word file sent to the chat is nearly always the business's own rental agreement.
  if (/\.(doc|docx|odt|rtf)$/.test(lower) || /word/.test(type)) return "contract";
  return null;
}

/** The file types the chat's attach button offers: photos, PDF, Word and spreadsheets. */
export const CHAT_ACCEPT = "image/*,.pdf,.doc,.docx,.csv,.xls,.xlsx,.ods,.numbers";
export const CHAT_MAX_FILES = 10;
/** The event the rest of the app sends to open the chat: window.dispatchEvent(new CustomEvent(CHAT_OPEN_EVENT, { detail })). */
export const CHAT_OPEN_EVENT = "rove:chat-open";
export type ChatOpenDetail = { prompt?: string; action?: ChatActionChip };

/** Opens the live chat from anywhere in the browser (a button on the Help page, an empty state…). */
export function openChat(detail: ChatOpenDetail = {}) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ChatOpenDetail>(CHAT_OPEN_EVENT, { detail }));
}
