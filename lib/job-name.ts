/**
 * A job the app raised, named in the reader's language (as on To do). Jobs are saved as English sentences;
 * a few names carry a figure taken from that sentence. Returns null when the kind isn't known, so the caller
 * shows the saved title instead.
 */
type Todo = { has: (key: never) => boolean; (key: never, values?: Record<string, string | number>): string };

export function jobNameFor(todo: Todo, action: string | null | undefined, title: string | null | undefined): string | null {
  if (!action) return null;
  const key = `job_${action}` as never;
  if (!todo.has(key)) return null;
  if (action === "owed_early") {
    // "Rent to decide - returned 94 days early (฿40,070 of ฿40,500 owed is for days after)"
    const amount = String(title || "").match(/\((.+?) of .+? owed/)?.[1];
    return amount ? todo(key, { amount }) : todo("job_owed_early_short" as never);
  }
  if (action === "refund") {
    // "Refund to decide - returned 4 days before the paid time ran out (pro rata ฿3,600)"
    const amount = String(title || "").match(/pro rata (\S+?)\)/)?.[1];
    if (amount && todo.has("job_refund_amount" as never)) return todo("job_refund_amount" as never, { amount });
  }
  // Other names that need a figure are only built where the figure is known (To do).
  if (action === "extension" || action === "handover_collect") return null;
  return todo(key);
}
