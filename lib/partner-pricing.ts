/** The partner network's shapes, with no server code behind them, so the browser can use them. */

/** A partner's vehicle that is free for the dates searched. */
export type PartnerVehicle = {
  vehicleId: string;
  organizationId: string;
  business: string;
  town: string;
  region: string;
  photoUrl: string | null;
  name: string;
  year: number | null;
  kind: string;
  /** From the vehicle's specifications, when recorded. */
  seats: number | null;
  engineCc: number | null;
  gearbox: "auto" | "manual" | null;
  /** Searched by place: km from the vehicle's branch, and whether the branch delivers there (else pickup). Null for "anywhere". */
  distanceKm: number | null;
  delivers: boolean | null;
  /** All prices below are in the vehicle operator's currency. */
  currency: string;
  pricingModel: "daily" | "weekly" | "monthly";
  rate: number;
  /** Days in the stay; null for a monthly rental with no end date. */
  days: number | null;
  /** The price for the dates (for no end date: one month). */
  total: number;
  /** The same, per day: what the budget slider compares. */
  perDay: number;
  /** perDay and total in the searching business's currency (same as above when the currencies match; null when no rate). */
  perDayMine: number | null;
  totalMine: number | null;
  /** The operator's booking page for this vehicle and these dates, tagged with the referring business. */
  bookingUrl: string;
};

/** One rental payment on a referred booking, and the commission it earned. */
export type CommissionRow = {
  id: string;
  paymentAmount: number;
  feeAmount: number;
  createdAt: string;
  settledAt: string | null;
};

/** A referred booking, seen from one side: "sent" (we referred, they owe us) or "received" (we owe them). */
export type ReferralRow = {
  id: string;
  direction: "sent" | "received";
  partner: string;
  customerName: string;
  vehicle: string;
  startDate: string | null;
  endDate: string | null;
  rentalId: string | null;
  rentalStatus: string | null;
  status: string;
  channel: string;
  feePct: number;
  currency: string;
  /** All commission so far, how much of it is settled, and what is still open. */
  feeTotal: number;
  feeSettled: number;
  feeOpen: number;
  commissions: CommissionRow[];
  createdAt: string;
};
