import { NextResponse } from "next/server";
import { createSupabaseServerClient, getRequestUser } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";

export async function GET() {
  const supabase = (await createSupabaseServerClient()) as any;
  // Read from the signed sign-in token (as every page does), not a trip to the sign-in service on each call.
  const user = await getRequestUser();

  if (!user) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await getActiveMembership(supabase, user.id);

  if (membershipError || !membership?.organization_id) {
    return NextResponse.json({ authenticated: true, organization: null });
  }

  const { data: organization, error } = await supabase
    .from("organizations")
    .select("id, subscription_status, subscription_tier, trial_ends_at, next_payment_due, stripe_subscription_id")
    .eq("id", membership.organization_id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const trialEndsAt = organization?.trial_ends_at ? new Date(organization.trial_ends_at).getTime() : null;
  const daysRemaining = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / (24 * 60 * 60 * 1000))) : null;
  // Whether a Stripe subscription runs (a trial with a card on file needs no "Subscribe" reminder); the id stays server-side.
  const { stripe_subscription_id: subscriptionId, ...shown } = (organization || {}) as Record<string, unknown>;

  return NextResponse.json({ authenticated: true, organization: organization ? { ...shown, subscribed: Boolean(subscriptionId) } : null, daysRemaining });
}
