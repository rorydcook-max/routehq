"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { canDecideMoney } from "@/lib/auth/role-types";
import { said } from "@/lib/i18n/server-text";
import { getDefaultOrganization } from "@/lib/organization";
import { findPartnerVehicles, partnerNetworkSettings, settleReferral, type PartnerVehicle } from "@/lib/partner-network";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function member(): Promise<{ error: string } | { membership: NonNullable<Awaited<ReturnType<typeof getCurrentMembership>>>; organization: Awaited<ReturnType<typeof getDefaultOrganization>> }> {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said("Please sign in first.") };
  const organization = await getDefaultOrganization();
  if (organization.id !== membership.organizationId) return { error: await said("Switch to the business you want to work in and try again.") };
  return { membership, organization };
}

/** "Share my fleet with the partner network": on shares the fleet and lets the business search; off hides it. Owner only. */
export async function savePartnerNetwork(input: { enabled: boolean; reach?: string; blocked?: string[] }): Promise<Result<{}>> {
  const who = await member();
  if ("error" in who) return { ok: false, error: who.error };
  if (who.membership.role !== "owner") return { ok: false, error: await said("Only the business owner can change this.") };
  const supabase = (await createSupabaseServerClient()) as any;
  // Read fresh, so a settings change made elsewhere in the meantime is kept.
  const { data: fresh } = await supabase.from("organizations").select("settings").eq("id", who.organization.id).maybeSingle();
  const current = (fresh?.settings && typeof fresh.settings === "object" ? fresh.settings : who.organization.settings && typeof who.organization.settings === "object" ? who.organization.settings : {}) as Record<string, unknown>;
  const existing = partnerNetworkSettings(current);
  const reach = input.reach && ["town", "region", "country"].includes(input.reach) ? input.reach : existing.reach;
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...current, partner_network: { enabled: input.enabled === true, reach, blocked: Array.isArray(input.blocked) ? input.blocked.map(String) : existing.blocked } } })
    .eq("id", who.organization.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  revalidatePath("/partners");
  return { ok: true };
}

/** Listing on the public directory. */
export async function saveDirectoryListing(input: { enabled: boolean }): Promise<Result<{}>> {
  const who = await member();
  if ("error" in who) return { ok: false, error: who.error };
  if (who.membership.role !== "owner") return { ok: false, error: await said("Only the business owner can change this.") };
  const supabase = (await createSupabaseServerClient()) as any;
  const current = (who.organization.settings && typeof who.organization.settings === "object" ? who.organization.settings : {}) as Record<string, unknown>;
  const { error } = await supabase
    .from("organizations")
    .update({ settings: { ...current, directory: { ...((current.directory as Record<string, unknown>) || {}), enabled: input.enabled === true } } })
    .eq("id", who.organization.id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

/** Partners' vehicles free for the dates, in the place and kind asked for. Only for businesses that share their fleet. */
export async function searchPartnerVehicles(input: {
  startDate: string;
  endDate: string | null;
  kind: string | null;
  town?: string | null;
  region?: string | null;
}): Promise<Result<{ vehicles: PartnerVehicle[]; currency: string }>> {
  const who = await member();
  if ("error" in who) return { ok: false, error: who.error };
  if (!partnerNetworkSettings(who.organization.settings).enabled) return { ok: false, error: await said("Share your fleet with the partner network first, then you can search.") };
  const startDate = String(input.startDate || "").slice(0, 10);
  const endDate = input.endDate ? String(input.endDate).slice(0, 10) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { ok: false, error: await said("Choose a start date first.") };
  if (endDate && (!/^\d{4}-\d{2}-\d{2}$/.test(endDate) || endDate <= startDate)) return { ok: false, error: await said("The end date must be after the start date.") };
  const clean = (value: unknown) => String(value || "").trim().slice(0, 80) || null;
  const result = await findPartnerVehicles(createSupabaseAdminClient() as any, {
    organizationId: who.organization.id,
    startDate,
    endDate,
    kind: clean(input.kind),
    town: clean(input.town),
    region: clean(input.region)
  });
  return { ok: true, ...result };
}

/** The open commission on a referred booking was paid between the two businesses. */
export async function markReferralSettled(input: { referralId: string; method?: string }): Promise<Result<{}>> {
  const who = await member();
  if ("error" in who) return { ok: false, error: who.error };
  if (!canDecideMoney(who.membership.role)) return { ok: false, error: await said("Ask the owner or a manager to mark this settled.") };
  try {
    await settleReferral(createSupabaseAdminClient() as any, {
      referralId: String(input.referralId),
      organizationId: who.organization.id,
      userId: who.membership.userId,
      method: String(input.method || "bank_transfer")
    });
    await recordActivityEvent((await createSupabaseServerClient()) as any, {
      organization_id: who.organization.id,
      actor_id: who.membership.userId,
      entity_type: "organization",
      entity_id: who.organization.id,
      event_type: "referral_settled",
      title: "Partner commission settled",
      detail: "A partner commission was marked settled."
    }).catch(() => null);
    revalidatePath("/partners");
    revalidatePath("/transactions");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : await said("Couldn't mark it settled. Please try again.") };
  }
}
