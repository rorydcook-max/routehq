/**
 * Role definitions that are safe to import from client components.
 * Server-side checks (requireOwner, getCurrentMembership) live in lib/auth/roles.ts.
 *
 *   owner    - everything, including business settings, billing and the team
 *   manager  - a teammate who can also make money decisions: refunds, waiving a
 *              charge, giving early days free, taking unpaid rent off
 *   teammate - day-to-day work; money decisions wait on To do for the owner or a manager
 */

export type AppRole = "owner" | "manager" | "teammate";

export const APP_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Full control, including business settings, billing and the team." },
  { value: "manager", label: "Manager", description: "Day-to-day work, and can decide refunds and waive charges. No business settings." },
  { value: "teammate", label: "Teammate", description: "Bookings, fleet, customers, inspections and payments. Refunds and waived charges go to the owner or a manager." }
];

export function appRoleFromDb(role: string | null | undefined): AppRole {
  return role === "owner" ? "owner" : role === "manager" ? "manager" : "teammate";
}

export function dbRoleFromApp(role: AppRole) {
  return role === "owner" ? "owner" : role === "manager" ? "manager" : "operator";
}

export function appRoleFromForm(value: unknown): AppRole {
  return value === "owner" ? "owner" : value === "manager" ? "manager" : "teammate";
}

/** Refunds, waived charges, free early days, unpaid rent taken off: the owner's and managers' call. */
export function canDecideMoney(role: AppRole | null | undefined) {
  return role === "owner" || role === "manager";
}

export const OWNER_ONLY_MESSAGE = "Only an owner can change business settings. Ask the account owner to make this change.";
