/**
 * Role definitions that are safe to import from client components.
 * Server-side checks (requireOwner, getCurrentMembership) live in lib/auth/roles.ts.
 */

export type AppRole = "owner" | "teammate";

export const APP_ROLES: { value: AppRole; label: string; description: string }[] = [
  { value: "owner", label: "Owner", description: "Full control, including business settings, billing and the team." },
  { value: "teammate", label: "Teammate", description: "Bookings, fleet, customers, inspections and payments. No business settings." }
];

export function appRoleFromDb(role: string | null | undefined): AppRole {
  return role === "owner" ? "owner" : "teammate";
}

export function dbRoleFromApp(role: AppRole) {
  return role === "owner" ? "owner" : "operator";
}

export const OWNER_ONLY_MESSAGE = "Only an owner can change business settings. Ask the account owner to make this change.";
