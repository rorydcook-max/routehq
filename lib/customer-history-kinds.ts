/** What a shared customer report can say (see lib/customer-history.ts). Kept apart so screens can use it in the browser. */
export const REPORT_KINDS = ["unpaid_rent", "damage_unpaid", "not_returned", "false_documents", "abusive", "other_serious"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

export type HistorySignal = { kind: ReportKind; amount: number | null; latest: string; reporters: number; reports: number };
