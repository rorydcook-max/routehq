import type { Extra } from "@/lib/price-rules";
import type { SiteArea, SitePolicy } from "@/lib/sites/types";
import { sitePrice } from "@/lib/sites/format";

type Say = (key: string, values?: Record<string, string | number>) => string;

const PAYMENT_KEYS: Record<string, string> = {
  cash: "pay_cash",
  promptpay: "pay_promptpay",
  bank_transfer: "pay_bank",
  wise: "pay_wise",
  revolut: "pay_revolut",
  card: "pay_card"
};

/**
 * The policies a website shows, worked out from what the business already set in RoveHQ (deposits, insurance excess,
 * the ready-made extras, service areas, payment methods, the booking hold) plus anything the owner wrote on the site.
 * Nothing is assumed: a policy with nothing real behind it is left out.
 */
export function buildPolicies(
  input: {
    currency: string;
    deposits: number[];
    insuranceExcess: number;
    extras: Extra[];
    areas: SiteArea[];
    paymentMethods: string[];
    holdHours: number;
    notes: { cancellation: string; requirements: string };
  },
  t: Say
): SitePolicy[] {
  const money = (value: number) => sitePrice(value, input.currency);
  const policies: SitePolicy[] = [];

  // Pickup and delivery, from each branch's service area (Settings › Locations).
  const areaLines = input.areas.map((area) =>
    area.radiusKm && area.radiusKm > 0 ? t("pol_deliveryWithin", { km: area.radiusKm, place: area.name }) : t("pol_pickupAt", { place: area.name })
  );
  const deliveryExtras = input.extras.filter((extra) => /deliver|collect|airport|ส่ง|รับ/i.test(extra.name));
  for (const extra of deliveryExtras) areaLines.push(extra.price > 0 ? `${extra.name}: ${t(extra.per === "day" ? "pol_perDay" : "pol_once", { amount: money(extra.price) })}` : `${extra.name}: ${t("pol_free")}`);
  if (areaLines.length) policies.push({ id: "delivery", title: t("pol_delivery"), lines: areaLines });

  // The deposit: each vehicle's own, or the usual one.
  const deposits = input.deposits.filter((value) => value > 0);
  if (input.deposits.length) {
    const low = deposits.length ? Math.min(...deposits) : 0;
    const high = deposits.length ? Math.max(...deposits) : 0;
    const line = !deposits.length ? t("pol_noDeposit") : low === high ? t("pol_depositOne", { amount: money(low) }) : t("pol_depositRange", { low: money(low), high: money(high) });
    policies.push({ id: "deposit", title: t("pol_deposit"), lines: [line, t("pol_depositBack")] });
  }

  // Insurance excess, and a damage waiver if one is offered.
  const insurance: string[] = [];
  if (input.insuranceExcess > 0) insurance.push(t("pol_excess", { amount: money(input.insuranceExcess) }));
  const waiver = input.extras.find((extra) => extra.preset === "damage_waiver");
  if (waiver) {
    const price = waiver.price > 0 ? t(waiver.per === "day" ? "pol_perDay" : "pol_once", { amount: money(waiver.price) }) : t("pol_free");
    insurance.push(waiver.excess ? t("pol_waiverTo", { price, amount: money(waiver.excess) }) : t("pol_waiver", { price }));
  }
  if (insurance.length) policies.push({ id: "insurance", title: t("pol_insurance"), lines: insurance });

  // What to bring: the booking form always asks for ID and a driving license (lib/public-booking.ts).
  const requirements = [t("pol_documents")];
  const young = input.extras.find((extra) => extra.preset === "young_driver");
  if (young?.minAge) requirements.push(young.price > 0 ? t("pol_youngFee", { age: young.minAge, price: t(young.per === "day" ? "pol_perDay" : "pol_once", { amount: money(young.price) }) }) : t("pol_youngOk", { age: young.minAge }));
  if (input.notes.requirements) requirements.push(...input.notes.requirements.split("\n").filter(Boolean));
  policies.push({ id: "requirements", title: t("pol_requirements"), lines: requirements });

  // Paying: nothing is taken to book; the hold, then the methods the business accepts.
  const methods = input.paymentMethods.map((method) => (PAYMENT_KEYS[method] ? t(PAYMENT_KEYS[method]) : null)).filter(Boolean) as string[];
  policies.push({ id: "payment", title: t("pol_payment"), lines: [t("pol_noPaymentToBook", { hours: input.holdHours }), ...(methods.length ? [t("pol_methods", { methods: methods.join(", ") })] : [])] });

  // Cancellation: only the owner's own words (RoveHQ has no automatic rules: the owner decides each case).
  if (input.notes.cancellation) policies.push({ id: "cancellation", title: t("pol_cancellation"), lines: input.notes.cancellation.split("\n").filter(Boolean) });

  return policies;
}
