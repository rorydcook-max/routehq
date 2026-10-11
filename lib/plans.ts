/**
 * RouteHQ's plans (Rory, 11 Oct 2026). Charged by fleet size; everything that
 * runs a rental is in every plan. Limits are nudges, never blocks: an operator
 * is never stopped from adding a vehicle or a booking.
 */

export type PlanId = "free" | "starter" | "growth" | "pro" | "business";

export type Plan = {
  id: PlanId;
  /** THB a month; Business is per vehicle. */
  monthly: number;
  perVehicle: boolean;
  /** Vehicle limit; null = no limit. */
  vehicles: number | null;
  /** Team logins; null = unlimited. */
  team: number | null;
  /** Passport and licence reads a month; null = unlimited. */
  documentReads: number | null;
  /** Rental Vehicle Comparison Calculator lookups a month; null = unlimited. */
  comparisonLookups: number | null;
  accountingExport: boolean;
  ownersStatements: boolean;
  severalLocations: boolean;
  /** Logo in the app itself, "Powered by RouteHQ" removable, booking address theirshop.routehq.app. */
  whiteLabel: boolean;
  /** Booking page on the business's own domain (book.theirshop.com). */
  customDomain: boolean;
  /** Listed on routehq.app/rent without paying the add-on. */
  directoryIncluded: boolean;
  /** Import and setup done by RouteHQ, on the yearly plan. */
  setupService: boolean;
  prioritySupport: boolean;
};

/** Yearly costs 11 months. */
export const YEARLY_MONTHS = 11;
/** Listing on the directory for plans that don't include it, THB a month. */
export const DIRECTORY_ADDON_MONTHLY = 300;
/** Partner network finder's fee: share of the first rental payment, one time. */
export const FINDERS_FEE_PCT = 10;
export const TRIAL_DAYS = 30;
export const OVER_LIMIT_GRACE_DAYS = 14;

export const PLANS: Plan[] = [
  { id: "free", monthly: 0, perVehicle: false, vehicles: 2, team: 1, documentReads: 10, comparisonLookups: 2, accountingExport: false, ownersStatements: false, severalLocations: false, whiteLabel: false, customDomain: false, directoryIncluded: false, setupService: false, prioritySupport: false },
  { id: "starter", monthly: 490, perVehicle: false, vehicles: 5, team: 2, documentReads: 50, comparisonLookups: 10, accountingExport: true, ownersStatements: false, severalLocations: false, whiteLabel: false, customDomain: false, directoryIncluded: false, setupService: false, prioritySupport: false },
  { id: "growth", monthly: 990, perVehicle: false, vehicles: 15, team: 5, documentReads: 200, comparisonLookups: 30, accountingExport: true, ownersStatements: true, severalLocations: true, whiteLabel: true, customDomain: false, directoryIncluded: false, setupService: true, prioritySupport: false },
  { id: "pro", monthly: 1990, perVehicle: false, vehicles: 40, team: null, documentReads: null, comparisonLookups: null, accountingExport: true, ownersStatements: true, severalLocations: true, whiteLabel: true, customDomain: false, directoryIncluded: true, setupService: true, prioritySupport: true },
  { id: "business", monthly: 40, perVehicle: true, vehicles: null, team: null, documentReads: null, comparisonLookups: null, accountingExport: true, ownersStatements: true, severalLocations: true, whiteLabel: true, customDomain: true, directoryIncluded: true, setupService: true, prioritySupport: true }
];

export function planById(id: string | null | undefined): Plan {
  return PLANS.find((plan) => plan.id === String(id || "").toLowerCase()) || PLANS[2];
}

export function yearlyPrice(plan: Plan) {
  return plan.monthly * YEARLY_MONTHS;
}

/** The cheapest plan that fits a fleet of this size. */
export function planForFleet(vehicles: number): Plan {
  return PLANS.find((plan) => plan.vehicles === null || vehicles <= plan.vehicles) || PLANS[PLANS.length - 1];
}

/**
 * During the trial everything is on, so limits only bite on a paid plan. The
 * "over" count is what the plans page and the fleet nudge show.
 */
export function vehiclesOverLimit(plan: Plan, vehicles: number, subscriptionStatus: string | null | undefined) {
  if (String(subscriptionStatus || "trial") === "trial" || plan.vehicles === null) return 0;
  return Math.max(0, vehicles - plan.vehicles);
}
