import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { retrieveSubscription, syncSubscription } from "@/lib/billing/sync";
import { getStripe } from "@/lib/billing/stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe "Your account" events for RoveHQ's own plans (Stripe Billing, phase 1). Signature checked with
 * STRIPE_WEBHOOK_SECRET; each event handled once (stripe_events); the subscription is always read fresh from
 * the API. Connect events for operator payments get their own endpoint later.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED = new Set([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed"
]);

function subscriptionIdOf(event: Stripe.Event): string | null {
  const object = event.data.object as any;
  if (event.type.startsWith("customer.subscription.")) return object.id || null;
  if (event.type === "checkout.session.completed") return object.mode === "subscription" ? (typeof object.subscription === "string" ? object.subscription : object.subscription?.id) || null : null;
  if (event.type.startsWith("invoice.")) {
    const fromParent = object.parent?.subscription_details?.subscription;
    const ref = fromParent || object.subscription;
    return (typeof ref === "string" ? ref : ref?.id) || null;
  }
  return null;
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "Not configured" }, { status: 400 });
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }
  if (!HANDLED.has(event.type)) return NextResponse.json({ received: true });

  const admin = createSupabaseAdminClient() as any;
  // Claim the event; a repeat delivery finds it already there and stops.
  const { error: claimError } = await admin.from("stripe_events").insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    return NextResponse.json({ error: "Could not record event" }, { status: 500 });
  }

  try {
    const subscriptionId = subscriptionIdOf(event);
    if (subscriptionId) {
      const subscription = await retrieveSubscription(subscriptionId);
      // checkout.session.completed: make sure the customer id is on the business even before metadata matches.
      if (event.type === "checkout.session.completed") {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.client_reference_id || session.metadata?.organization_id;
        const customerId = typeof session.customer === "string" ? session.customer : session.customer?.id;
        if (organizationId && customerId) await admin.from("organizations").update({ stripe_customer_id: customerId }).eq("id", organizationId).is("stripe_customer_id", null);
      }
      await syncSubscription(admin, subscription);
    }
    await admin.from("stripe_events").update({ processed_at: new Date().toISOString() }).eq("id", event.id);
    return NextResponse.json({ received: true });
  } catch (error) {
    // Let Stripe retry: forget the claim so the retry is processed.
    await admin.from("stripe_events").delete().eq("id", event.id);
    console.error("stripe webhook", event.type, error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
