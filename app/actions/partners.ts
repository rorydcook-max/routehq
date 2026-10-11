"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { getDefaultOrganization } from "@/lib/organization";
import { findPartnerVehicles, markReferralFeePaid, partnerNetworkSettings, referCustomer, type PartnerVehicle } from "@/lib/partner-network";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

async function owner(): Promise<{ error: string } | { membership: NonNullable<Awaited<ReturnType<typeof getCurrentMembership>>>; organization: Awaited<ReturnType<typeof getDefaultOrganization>> }> {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said("Please sign in first.") };
  const organization = await getDefaultOrganization();
  if (organization.id !== membership.organizationId) return { error: await said("Switch to the business you want to work in and try again.") };
  return { membership, organization };
}

/** Settings: on or off, how far to look, and who to leave out. */
export async function savePartnerNetwork(input: { enabled: boolean; reach: string; blocked?: string[] }): Promise<Result<{}>> {
  const who = await owner();
  if ("error" in who) return { ok: false, error: who.error };
  if (who.membership.role !== "owner") return { ok: false, error: await said("Only the business owner can change this.") };
  const supabase = (await createSupabaseServerClient()) as any;
  const current = (who.organization.settings && typeof who.organization.settings === "object" ? who.organization.settings : {}) as Record<string, unknown>;
  const existing = partnerNetworkSettings(current);
  const reach = ["town", "region", "country"].includes(input.reach) ? input.reach : existing.reach;
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
  const who = await owner();
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

/** Partners' vehicles free for the dates. */
export async function searchPartnerVehicles(input: { startDate: string; endDate: string | null; kind: string | null }): Promise<Result<{ vehicles: PartnerVehicle[] }>> {
  const who = await owner();
  if ("error" in who) return { ok: false, error: who.error };
  const startDate = String(input.startDate || "").slice(0, 10);
  const endDate = input.endDate ? String(input.endDate).slice(0, 10) : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return { ok: false, error: await said("Choose a start date first.") };
  if (endDate && endDate < startDate) return { ok: false, error: await said("The end date is before the start date.") };
  const vehicles = await findPartnerVehicles(createSupabaseAdminClient() as any, { organizationId: who.organization.id, startDate, endDate, kind: input.kind });
  return { ok: true, vehicles };
}

/** Sends the customer to the partner: their booking link, and the referral that earns the fee. */
export async function sendReferral(input: { vehicleId: string; startDate: string; endDate: string | null; customerName: string; customerPhone: string; baseUrl: string }): Promise<Result<{ bookingUrl: string; partner: string }>> {
  const who = await owner();
  if ("error" in who) return { ok: false, error: who.error };
  const customerName = String(input.customerName || "").trim().slice(0, 120);
  const customerPhone = String(input.customerPhone || "").trim().slice(0, 40);
  if (!customerName) return { ok: false, error: await said("Add the customer's name first.") };
  try {
    const result = await referCustomer(createSupabaseAdminClient() as any, {
      fromOrganizationId: who.organization.id,
      userId: who.membership.userId,
      vehicleId: String(input.vehicleId),
      startDate: String(input.startDate).slice(0, 10),
      endDate: input.endDate ? String(input.endDate).slice(0, 10) : null,
      customerName,
      customerPhone,
      baseUrl: String(input.baseUrl || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
    });
    await recordActivityEvent((await createSupabaseServerClient()) as any, {
      organization_id: who.organization.id,
      actor_id: who.membership.userId,
      entity_type: "organization",
      entity_id: who.organization.id,
      event_type: "referral_sent",
      title: "Customer referred to a partner",
      detail: `${customerName} was sent to ${result.partner} for ${input.startDate}${input.endDate ? ` to ${input.endDate}` : ""}.`
    });
    revalidatePath("/partners");
    return { ok: true, bookingUrl: result.bookingUrl, partner: result.partner };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : await said("The referral could not be sent.") };
  }
}

/** The partner paid the finder's fee. */
export async function markFeePaid(input: { referralId: string; method: string }): Promise<Result<{}>> {
  const who = await owner();
  if ("error" in who) return { ok: false, error: who.error };
  try {
    await markReferralFeePaid(createSupabaseAdminClient() as any, { referralId: String(input.referralId), organizationId: who.organization.id, userId: who.membership.userId, method: String(input.method || "cash") });
    revalidatePath("/partners");
    revalidatePath("/transactions");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : await said("Could not mark the fee as paid.") };
  }
}
