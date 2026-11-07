/**
 * Creates or updates RoveHQ's plan Products, Prices and Customer Portal configuration in Stripe.
 * Safe to run again: Products have fixed IDs, Prices are matched by lookup_key (a changed THB amount makes a
 * new Price and moves the lookup_key to it; other currencies are updated in place).
 *
 *   npx tsx scripts/stripe-seed-plans.ts            (reads STRIPE_SECRET_KEY from the environment or .env.local)
 *
 * Refuses a live key unless --live is passed.
 */

import fs from "node:fs";
import path from "node:path";
import Stripe from "stripe";
import { BASE_CURRENCY, SAAS_TAX_CODE, catalogPrices, type PriceKind } from "../lib/billing/catalog";
import { PORTAL_TAG, STRIPE_API_VERSION } from "../lib/billing/stripe";

function loadEnvLocal() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
  }
}

loadEnvLocal();
const key = process.env.STRIPE_SECRET_KEY || "";
if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
if (key.startsWith("sk_live") || key.startsWith("rk_live")) {
  if (!process.argv.includes("--live")) throw new Error("Live key: pass --live to seed live mode");
}
const stripe = new Stripe(key, { apiVersion: STRIPE_API_VERSION as any });
const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

const PRODUCT_NAME: Record<string, string> = {
  starter_base: "RoveHQ Starter",
  pro_base: "RoveHQ Pro",
  business_base: "RoveHQ Business",
  business_extra_car: "RoveHQ Business extra car",
  business_extra_motorbike: "RoveHQ Business extra motorbike"
};

async function ensureProduct(plan: string, kind: PriceKind) {
  const id = `rovehq_${plan}${kind === "base" ? "" : `_${kind}`}`;
  const name = PRODUCT_NAME[`${plan}_${kind}`];
  try {
    const existing = await stripe.products.retrieve(id);
    if (existing.name !== name || existing.tax_code !== SAAS_TAX_CODE || !existing.active) {
      await stripe.products.update(id, { name, tax_code: SAAS_TAX_CODE, active: true });
    }
    return id;
  } catch (error: any) {
    if (error?.code !== "resource_missing") throw error;
    await stripe.products.create({ id, name, tax_code: SAAS_TAX_CODE, metadata: { plan, kind } });
    return id;
  }
}

/** Removes currencies Stripe doesn't support from the options and remembers them. */
const unsupported = new Set<string>();
function optionsFor(amounts: Record<string, number>) {
  const options: Record<string, { unit_amount: number; tax_behavior: "exclusive" }> = {};
  for (const [currency, amount] of Object.entries(amounts)) {
    if (currency === BASE_CURRENCY || unsupported.has(currency)) continue;
    options[currency.toLowerCase()] = { unit_amount: amount, tax_behavior: "exclusive" };
  }
  return options;
}

async function withCurrencyRetry<T>(run: () => Promise<T>): Promise<T> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await run();
    } catch (error: any) {
      const message = String(error?.message || "");
      const param = String(error?.param || "");
      const fromParam = /currency_options\[([a-z]{3})\]/.exec(param)?.[1];
      const fromMessage = /currency[^a-z]*`?([a-z]{3})`?/i.exec(message)?.[1];
      const bad = (fromParam || (/(not supported|invalid currency|unsupported)/i.test(message) ? fromMessage : null))?.toUpperCase();
      if (!bad || unsupported.has(bad)) throw error;
      unsupported.add(bad);
      console.log(`  skipping ${bad}: ${message.slice(0, 120)}`);
    }
  }
  throw new Error("Too many unsupported currencies");
}

async function main() {
  const summary: string[] = [];
  for (const item of catalogPrices()) {
    const productId = await ensureProduct(item.plan, item.kind);
    const baseAmount = item.amounts[BASE_CURRENCY];
    const found = await stripe.prices.list({ lookup_keys: [item.lookupKey], active: true, expand: ["data.currency_options"], limit: 1 });
    const existing = found.data[0];
    const interval = item.interval === "yearly" ? "year" : "month";
    if (existing && existing.unit_amount === baseAmount && existing.recurring?.interval === interval && existing.product === productId) {
      const current = existing.currency_options || {};
      const changed = Object.entries(optionsFor(item.amounts)).filter(([currency, option]) => current[currency]?.unit_amount !== option.unit_amount);
      if (changed.length) {
        await withCurrencyRetry(() => stripe.prices.update(existing.id, { currency_options: Object.fromEntries(Object.entries(optionsFor(item.amounts)).filter(([currency]) => changed.some(([c]) => c === currency))) as any }));
      }
      summary.push(`${item.lookupKey.padEnd(34)} ${existing.id} ${changed.length ? `(updated ${changed.length} currencies)` : "(unchanged)"}`);
      continue;
    }
    const created = await withCurrencyRetry(() =>
      stripe.prices.create({
        product: productId,
        currency: BASE_CURRENCY.toLowerCase(),
        unit_amount: baseAmount,
        tax_behavior: "exclusive",
        recurring: { interval },
        lookup_key: item.lookupKey,
        transfer_lookup_key: true,
        nickname: item.lookupKey,
        metadata: { plan: item.plan, kind: item.kind, interval: item.interval },
        currency_options: optionsFor(item.amounts) as any
      })
    );
    if (existing) await stripe.prices.update(existing.id, { active: false });
    summary.push(`${item.lookupKey.padEnd(34)} ${created.id} (created)`);
  }

  // Customer Portal: card, billing details and invoices. Plan changes and canceling stay in the app, which
  // asks which vehicles stay active when the new plan has room for fewer.
  const features = {
    customer_update: { enabled: true, allowed_updates: ["address", "name", "email", "tax_id"] as Array<"address" | "name" | "email" | "tax_id"> },
    invoice_history: { enabled: true },
    payment_method_update: { enabled: true },
    subscription_cancel: { enabled: false },
    subscription_update: { enabled: false }
  };
  const configurations = await stripe.billingPortal.configurations.list({ active: true, limit: 100 });
  const existingPortal = configurations.data.find((configuration) => configuration.metadata?.tag === PORTAL_TAG);
  const portal = existingPortal
    ? await stripe.billingPortal.configurations.update(existingPortal.id, { features, default_return_url: `${appUrl}/settings/billing` })
    : await stripe.billingPortal.configurations.create({
        name: "RoveHQ plan",
        features,
        default_return_url: `${appUrl}/settings/billing`,
        metadata: { tag: PORTAL_TAG }
      } as any);
  summary.push(`portal configuration                ${portal.id}`);

  console.log(summary.join("\n"));
  if (unsupported.size) console.log(`Currencies Stripe did not accept: ${[...unsupported].join(", ")}`);
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
