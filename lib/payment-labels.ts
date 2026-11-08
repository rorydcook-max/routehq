/** What a scheduled payment is called when shown to a customer or in a split. */
export function customerPaymentLabel(metadata: any) {
  const type = String(metadata?.type || "");
  if (type === "deposit" || metadata?.is_deposit === true) return "Deposit";
  if (type === "deposit_top_up") return "Deposit top-up";
  if (type === "extension") return "Extension";
  if (type === "charge") return String(metadata?.description || "Charge");
  if (type === "extras") return String(metadata?.description || "Extras");
  // The charge for coming back late is saved as rent due on the return day; it is named for what it is.
  if (metadata?.late_return) return "Late return";
  return metadata?.period_label ? `Rent · ${metadata.period_label}` : "Rent";
}
