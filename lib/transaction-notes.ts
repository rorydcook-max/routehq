/**
 * Notes on a money record are either typed by the owner or written by the app
 * in English ("Security deposit - received by promptpay"). The app's own lines
 * repeat what the row already says (its kind, date and amount), so only what a
 * person typed is shown.
 */
const WRITTEN_BY_THE_APP = /received by|receipt checked|recorded on the return form|received at handover|^deposit deduction|^security deposit|rental payment - |^first rental payment|^extension - |^customer-reported payment/i;

export function typedNote(notes: unknown): string | null {
  const text = String(notes || "").trim();
  return text && !WRITTEN_BY_THE_APP.test(text) ? text : null;
}
