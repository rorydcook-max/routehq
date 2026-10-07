// What a rental can include. A booking stores these English names; screens show them in the reader's language
// through the inc_0, inc_1... translation keys, which follow this order. Add new ones at the end only.
export const includedOptions = [
  "Full insurance",
  "Compulsory insurance (Por Ror Bor)",
  "Breakdown cover",
  "Delivery and collection",
  "Car seat",
  "GPS tracker",
  "Unlimited mileage",
  "Free fuel",
  "Helmet",
  "Second helmet",
  "Phone holder",
  "Rain poncho"
];

export function includedItemKey(item: string) {
  const index = includedOptions.indexOf(item);
  return index >= 0 ? `inc_${index}` : null;
}
