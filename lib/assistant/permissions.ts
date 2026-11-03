import type { ActionKind } from "@/lib/assistant-actions";

/**
 * Who may use which of the assistant's tools (Rory, 3 Nov 2026: one assistant everywhere, with full capabilities).
 * The model is only ever given the tools in this list for the person's role, and each tool and each Confirm checks
 * the role again on the server, so a prompt can't talk it into anything.
 *
 * The rules are the ones the app already had:
 * - website visitors: help articles and pricing, and a person; never a business's records;
 * - the business's figures (money, who owes what, forecasts), imports and contracts: the owner (lib/ask.ts was
 *   owner-only; /api/import/analyze and Settings, Rental agreement are owner-only);
 * - vehicles and their paperwork: the owner and managers (the chat's fleet rule; FLEET_ROLES in lib/fleet-chat.ts is
 *   compared with the app role, where teammates are "teammate", so it has only ever let owners and managers in);
 * - bookings, costs and customer payments: every member, as on /bookings/new, /transactions/new and the booking page
 *   (rentals, transactions and rental_payments RLS let operators write them).
 */
export type AssistantRole = "owner" | "manager" | "teammate" | "visitor";

export type ToolName =
  | "reply"
  | "search_help"
  | "talk_to_person"
  | "business_records"
  | "add_vehicles"
  | "renew_paperwork"
  | "record_cost"
  | "record_payment"
  | "create_booking"
  | "import_sheet"
  | "contract_upload"
  | "damage_photos";

const EVERYONE: AssistantRole[] = ["owner", "manager", "teammate", "visitor"];
const MEMBERS: AssistantRole[] = ["owner", "manager", "teammate"];
const FLEET: AssistantRole[] = ["owner", "manager"];
const OWNER: AssistantRole[] = ["owner"];

const TOOL_ROLES: Record<ToolName, AssistantRole[]> = {
  reply: EVERYONE,
  search_help: EVERYONE,
  talk_to_person: EVERYONE,
  business_records: OWNER,
  add_vehicles: FLEET,
  renew_paperwork: FLEET,
  record_cost: MEMBERS,
  record_payment: MEMBERS,
  create_booking: MEMBERS,
  import_sheet: OWNER,
  contract_upload: OWNER,
  damage_photos: MEMBERS
};

/** Saving a card: the same rule as the tool that made it. The older records cards stay owner-only, as they were. */
const CONFIRM_ROLES: Record<ActionKind, AssistantRole[]> = {
  add_vehicle: OWNER,
  add_transaction: OWNER,
  create_booking_link: OWNER,
  renew_paperwork: OWNER,
  record_cost: MEMBERS,
  record_payment: MEMBERS,
  create_booking: MEMBERS
};

export function assistantRole(role: string | null | undefined): AssistantRole {
  return role === "owner" ? "owner" : role === "manager" ? "manager" : role === "visitor" || !role ? "visitor" : "teammate";
}

export function mayUseTool(tool: ToolName, role: AssistantRole) {
  return (TOOL_ROLES[tool] || []).includes(role);
}

export function toolsForRole(role: AssistantRole): ToolName[] {
  return (Object.keys(TOOL_ROLES) as ToolName[]).filter((tool) => mayUseTool(tool, role));
}

export function mayConfirm(kind: string, role: AssistantRole) {
  return (CONFIRM_ROLES[kind as ActionKind] || []).includes(role);
}

/** Vehicles and paperwork in the chat (the fleet cards). */
export function mayUseFleet(role: AssistantRole) {
  return FLEET.includes(role);
}
