/**
 * What the Plan tab shows about a paid plan, read live from Stripe: price and interval, the card, the billing
 * address and recent invoices. Anything Stripe can't answer just leaves its row out.
 */

import type Stripe from "stripe";
import { itemAmount, parseLookupKey, toMinor, fromMinor } from "@/lib/billing/catalog";
import { getStripe, stripeConfigured } from "@/lib/billing/stripe";

export type BillingDetails = {
  amount: number | null;
  currency: string | null;
  interval: "monthly" | "yearly" | null;
  card: { brand: string; last4: string | null; expires: string | null } | null;
  address: string[];
  taxId: string | null;
  invoices: Array<{ id: string; number: string | null; date: string; amount: number; currency: string; status: string; url: string | null; pdf: string | null }>;
};

type PostalAddress = { line1?: string | null; line2?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null };

/** Countries that write "City, ST 12345": the postal code after the city and state. */
const CITY_STATE_POSTAL = new Set(["US", "CA", "AU", "PR", "GU", "VI", "AS", "MP"]);
/** Countries that put the postal code on a line of its own after the town (UK style). */
const POSTAL_OWN_LINE = new Set(["GB", "IE", "IM", "JE", "GG"]);

/** A billing address in the order its country writes it: "Miami, FL 33132" in the US, "10115 Berlin" in Germany. */
export function addressLines(address: PostalAddress): string[] {
  const country = String(address.country || "").toUpperCase();
  const city = address.city || "";
  const state = address.state || "";
  const postal = address.postal_code || "";
  const streets = [address.line1 || "", address.line2 || ""];
  if (CITY_STATE_POSTAL.has(country)) {
    const place = [[city, state].filter(Boolean).join(", "), postal].filter(Boolean).join(" ");
    return [...streets, place, country];
  }
  if (POSTAL_OWN_LINE.has(country)) return [...streets, [city, state].filter(Boolean).join(", "), postal, country];
  return [...streets, [postal, city].filter(Boolean).join(" "), [state, country].filter(Boolean).join(", ")];
}

function paymentMethodText(method: Stripe.PaymentMethod | null | undefined): BillingDetails["card"] {
  if (!method) return null;
  if (method.type === "card" && method.card) {
    const brand = method.card.display_brand || method.card.brand || "card";
    return { brand: brand.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()), last4: method.card.last4 || null, expires: method.card.exp_month && method.card.exp_year ? `${String(method.card.exp_month).padStart(2, "0")}/${String(method.card.exp_year).slice(-2)}` : null };
  }
  const label = method.type === "link" ? "Link" : method.type.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  const last4 = (method as any)[method.type]?.last4 || null;
  return { brand: label, last4, expires: null };
}

export async function getBillingDetails(organization: { stripe_customer_id?: string | null; stripe_subscription_id?: string | null }): Promise<BillingDetails | null> {
  if (!stripeConfigured() || !organization.stripe_customer_id) return null;
  const stripe = getStripe();
  try {
    const [customer, subscription, invoices] = await Promise.all([
      stripe.customers.retrieve(organization.stripe_customer_id, { expand: ["invoice_settings.default_payment_method", "tax_ids"] }),
      organization.stripe_subscription_id
        ? stripe.subscriptions.retrieve(organization.stripe_subscription_id, { expand: ["items.data.price", "default_payment_method"] }).catch(() => null)
        : Promise.resolve(null),
      stripe.invoices.list({ customer: organization.stripe_customer_id, limit: 6 }).catch(() => null)
    ]);
    if (!customer || (customer as Stripe.DeletedCustomer).deleted) return null;
    const live = customer as Stripe.Customer;

    let amount: number | null = null;
    let interval: BillingDetails["interval"] = null;
    const currency = subscription?.currency ? subscription.currency.toUpperCase() : null;
    if (subscription && currency) {
      let minor = 0;
      for (const item of subscription.items.data) {
        const parsed = parseLookupKey(typeof item.price === "object" ? item.price.lookup_key : null);
        if (!parsed) continue;
        if (parsed.kind === "base") interval = parsed.interval;
        minor += toMinor(itemAmount(parsed.plan, parsed.kind, parsed.interval, currency), currency) * (item.quantity ?? 1);
      }
      amount = interval ? fromMinor(minor, currency) : null;
    }

    const method =
      (subscription?.default_payment_method && typeof subscription.default_payment_method === "object" ? subscription.default_payment_method : null) ||
      (live.invoice_settings?.default_payment_method && typeof live.invoice_settings.default_payment_method === "object" ? live.invoice_settings.default_payment_method : null);

    const address = live.address ? [live.name || "", ...addressLines(live.address)].filter((line) => line.trim()) : [];
    const taxId = live.tax_ids?.data?.[0]?.value || null;

    return {
      amount,
      currency,
      interval,
      card: paymentMethodText(method as Stripe.PaymentMethod | null),
      address,
      taxId,
      invoices: (invoices?.data || [])
        // Drafts and nothing-to-pay invoices (the start of a trial) are left out.
        .filter((invoice) => invoice.status !== "draft" && invoice.total !== 0)
        .map((invoice) => ({
          id: String(invoice.id),
          number: invoice.number || null,
          date: new Date(invoice.created * 1000).toISOString(),
          amount: fromMinor(invoice.total, invoice.currency),
          currency: invoice.currency.toUpperCase(),
          status: String(invoice.status || ""),
          url: invoice.hosted_invoice_url || null,
          pdf: invoice.invoice_pdf || null
        }))
    };
  } catch (error) {
    console.error("getBillingDetails", error instanceof Error ? error.message : error);
    return null;
  }
}
