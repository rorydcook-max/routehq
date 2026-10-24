/** What a shared customer report can say (see lib/customer-history.ts). Kept apart so screens can use it in the browser. */
export const REPORT_KINDS = ["unpaid_rent", "damage_unpaid", "not_returned", "false_documents", "abusive", "other_serious"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/**
 * One report another business filed, as a business that has the same person in front of it sees it: what happened in
 * the reporter's words, who reported it and their track record, whether it was settled, and the customer's side.
 */
export type HistoryReport = {
  id: string;
  kind: ReportKind;
  amount: number | null;
  occurredOn: string;
  summary: string | null;
  business: string;
  businessSince: string;
  businessRentals: number;
  businessReports: number;
  settledAt: string | null;
  settledNote: string | null;
  customerResponse: string | null;
  disputed: boolean;
};
