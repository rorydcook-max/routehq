"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { logAdminAction, requirePlatformAdmin } from "@/lib/admin";
import { ACTIVE_ORGANIZATION_COOKIE } from "@/lib/auth/active-organization";
import { getCurrentMembership } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { eraseCustomer, PrivacyFunctionMissing, purgeBusiness } from "@/lib/privacy/erase";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Privacy rights in the product (GDPR / UK GDPR / Thai PDPA, 3 Nov 2026): deleting a business (owner), deleting one
 * customer's personal data (owner or manager), the ID-photo retention setting (owner), and RoveHQ staff removing a
 * renter from RoveHQ's own renter list. Exports are routes (account/export, customers/[id]/export).
 */

export type PrivacyActionState = { ok: boolean; error?: string; saved?: boolean };

const OPEN_STATUSES = ["draft", "booked", "active", "due_soon", "overdue", "extended"];
const sameText = (typed: unknown, expected: string) => String(typed || "").trim().toLowerCase() === expected.trim().toLowerCase() && String(typed || "").trim() !== "";

/** Delete this business: everything goes, at once, after the owner types its name. */
export async function deleteBusiness(_state: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "owner") return { ok: false, error: await said("Only the owner can do this.") };
  const admin = createSupabaseAdminClient() as any;
  const { data: org } = await admin.from("organizations").select("id, name, slug").eq("id", membership.organizationId).maybeSingle();
  if (!org) return { ok: false, error: await said("This business could not be found.") };
  if (!sameText(formData.get("confirmName"), String(org.name || ""))) return { ok: false, error: await said("Type the business name exactly to confirm.") };
  // RoveHQ support viewing the business on its behalf never deletes it.
  const { data: viewing } = await admin.from("admin_view_sessions").select("id").eq("organization_id", org.id).eq("admin_user_id", membership.userId).is("ended_at", null).limit(1);
  if (viewing?.length) return { ok: false, error: await said("RoveHQ support can't delete a business. Ask the owner to do it.") };

  try {
    const files = await purgeBusiness(admin, org.id);
    console.log(`[privacy] business ${org.id} deleted by its owner ${membership.userId}; ${files} files removed`);
  } catch (error) {
    if (error instanceof PrivacyFunctionMissing) return { ok: false, error: await said("Deleting a business isn't available yet. Please contact support and we'll do it for you.") };
    console.error("[privacy] business delete failed", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("This business could not be deleted. Please try again or contact support.") };
  }
  const cookieStore = await cookies();
  cookieStore.delete(ACTIVE_ORGANIZATION_COOKIE);
  cookieStore.delete("rhq_gate");
  revalidatePath("/", "layout");
  if (org.slug) revalidatePath(`/rent/${org.slug}`);
  redirect("/onboarding");
}

/** Delete a customer's personal data at their request; bookings and payments stay as "Deleted customer". */
export async function deleteCustomerData(_state: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "owner" && membership.role !== "manager") return { ok: false, error: await said("Only an owner or manager can do this.") };
  const customerId = String(formData.get("customerId") || "");
  const admin = createSupabaseAdminClient() as any;
  const { data: customer } = await admin.from("customers").select("id, organization_id").eq("id", customerId).eq("organization_id", membership.organizationId).maybeSingle();
  if (!customer) return { ok: false, error: await said("This customer could not be found.") };
  const { data: open } = await admin.from("rentals").select("id").eq("customer_id", customerId).is("deleted_at", null).in("status", OPEN_STATUSES).limit(1);
  if (open?.length) return { ok: false, error: await said("Finish or cancel their open bookings first.") };

  try {
    await eraseCustomer(admin, customerId);
  } catch (error) {
    if (error instanceof PrivacyFunctionMissing) return { ok: false, error: await said("Deleting a customer isn't available yet. Please contact support.") };
    console.error("[privacy] customer delete failed", error instanceof Error ? error.message : error);
    return { ok: false, error: await said("This customer could not be deleted. Please try again.") };
  }
  await admin.from("activity_events").insert({
    organization_id: membership.organizationId,
    actor_id: membership.userId,
    entity_type: "customer",
    entity_id: customerId,
    customer_id: customerId,
    event_type: "customer_data_deleted",
    title: "Customer's personal data deleted at their request"
  }).then(({ error }: { error: { message: string } | null }) => {
    if (error) console.error("[privacy] activity not recorded", error.message);
  });
  revalidatePath("/customers");
  redirect("/customers" as Route);
}

/** Automatic deletion of renters' ID photos: on or off, and after how many months. */
export async function updateIdPhotoRetention(_state: PrivacyActionState, formData: FormData): Promise<PrivacyActionState> {
  const membership = await getCurrentMembership();
  if (!membership) redirect("/login");
  if (membership.role !== "owner") return { ok: false, error: await said("Only the owner can do this.") };
  const months = Math.round(Number(formData.get("months") || 24));
  if (!Number.isFinite(months) || months < 1 || months > 120) return { ok: false, error: await said("Choose between 1 and 120 months.") };
  const enabled = formData.get("enabled") === "on";
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: org } = await supabase.from("organizations").select("settings").eq("id", membership.organizationId).maybeSingle();
  const settings = org?.settings && typeof org.settings === "object" ? org.settings : {};
  const privacy = settings.privacy && typeof settings.privacy === "object" ? settings.privacy : {};
  const { data: updated, error } = await supabase
    .from("organizations")
    .update({ settings: { ...settings, privacy: { ...privacy, idPhotoMonths: months, idPhotoAutoDelete: enabled } } })
    .eq("id", membership.organizationId)
    .select("id");
  if (error || !updated?.length) return { ok: false, error: await said("We couldn't save that. Please try again.") };
  revalidatePath("/account");
  return { ok: true, saved: true };
}

/** RoveHQ staff: take a renter off RoveHQ's renter list for good (their copy and rental history). */
export async function adminRemoveRenter(formData: FormData) {
  const staff = await requirePlatformAdmin();
  const renterId = String(formData.get("renterId") || "");
  if (!/^[0-9a-f-]{36}$/i.test(renterId)) return;
  const admin = createSupabaseAdminClient() as any;
  // Without its business links the daily refresh never copies this renter again; only a new "yes" on a booking would.
  await admin.from("renter_rentals").delete().eq("renter_id", renterId);
  await admin.from("renter_sources").delete().eq("renter_id", renterId);
  const { error } = await admin.from("renters").delete().eq("id", renterId);
  if (error) console.error("[renters] remove failed", error.message);
  await logAdminAction(staff, { action: "renter_removed", details: { renter_id: renterId } });
  revalidatePath("/platform/renters");
}
