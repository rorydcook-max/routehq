/**
 * Which column of To do a job sits in, by when it is due. Shared by the page (the band's counts)
 * and the list (the board), so the numbers on the band always match the columns under it.
 */
export type Bucket = "overdue" | "next3" | "next7" | "next30" | "later";

/** The four columns of the board, in order. "Later" (no date, or more than 30 days off) is a quiet line under it. */
export const BOARD_BUCKETS: Bucket[] = ["overdue", "next3", "next7", "next30"];

const ALL_BUCKETS: Bucket[] = [...BOARD_BUCKETS, "later"];

export function addDaysIso(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * Overdue: before today. Next 3 days: today to 3 days on. Next 7 days: 4 to 7 days on. Next 30 days: 8 to 30.
 * A receipt the customer has sent is waiting on us now, so one that isn't late sits with "Next 3 days".
 */
export function bucketOf(item: { dueDate?: string | null; receipt?: unknown }, today: string): Bucket {
  const due = item.dueDate || null;
  if (due && due < today) return "overdue";
  if (item.receipt) return "next3";
  if (!due) return "later";
  if (due <= addDaysIso(today, 3)) return "next3";
  if (due <= addDaysIso(today, 7)) return "next7";
  if (due <= addDaysIso(today, 30)) return "next30";
  return "later";
}

/** The ?show= filter, or null for everything. */
export function parseShow(value: string | string[] | undefined | null): Bucket | null {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw && (ALL_BUCKETS as string[]).includes(raw) ? (raw as Bucket) : null;
}

/** The words for a column's title. Reuses the older group names where they still say the same thing. */
export const BUCKET_LABEL_KEY: Record<Bucket, string> = {
  overdue: "group_overdue",
  next3: "group_next3",
  next7: "group_week",
  next30: "group_next30",
  later: "group_later"
};
