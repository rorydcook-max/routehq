"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { canUseOwnDomain, canUseSubdomain, cleanDomain, cleanSubdomain, subdomainProblem } from "@/lib/booking-address";
import { getCustomPlan } from "@/lib/custom-plan";
import { said } from "@/lib/i18n/server-text";
import { alertTeam } from "@/lib/support";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { addProjectDomain, projectDomainReady, removeProjectDomain, vercelDomainsConfigured } from "@/lib/vercel-domains";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

async function ownerOrg() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said("Please sign in first.") } as const;
  if (membership.role !== "owner") return { error: await said("Only the business owner can change this.") } as const;
  const admin = createSupabaseAdminClient() as any;
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug, subscription_tier, subscription_status, booking_subdomain, custom_domain, custom_domain_status")
    .eq("id", membership.organizationId)
    .maybeSingle();
  if (!org) return { error: await said("Business not found.") } as const;
  // An admin-set custom plan may switch the own domain on or off for this business.
  const { custom_limits } = await getCustomPlan(org.id);
  return { membership, org: { ...org, custom_limits }, admin } as const;
}

function refresh(slug: string) {
  revalidatePath("/settings");
  revalidatePath(`/rent/${slug}`);
}

/** theirshop.lokalfleet.com. Empty clears it. */
export async function saveBookingSubdomain(input: { value: string }): Promise<Result<{ value: string | null }>> {
  const who = await ownerOrg();
  if ("error" in who) return { ok: false, error: who.error as string };
  const { org, admin } = who;
  const value = cleanSubdomain(input.value);
  if (!value) {
    await admin.from("organizations").update({ booking_subdomain: null }).eq("id", org.id);
    refresh(org.slug);
    return { ok: true, value: null };
  }
  if (!canUseSubdomain(org)) return { ok: false, error: await said("Your own booking address comes with the Pro plan and above.") };
  const problem = subdomainProblem(value);
  if (problem === "short") return { ok: false, error: await said("Use at least 3 letters or numbers.") };
  if (problem === "chars") return { ok: false, error: await said("Use only letters, numbers and dashes.") };
  if (problem === "reserved") return { ok: false, error: await said("That address is kept for Lokalfleet. Try another.") };
  const { data: taken } = await admin.from("organizations").select("id").ilike("booking_subdomain", value).is("deleted_at", null).neq("id", org.id).limit(1);
  if (taken?.length) return { ok: false, error: await said("Another business already has that address. Try another.") };
  const { error } = await admin.from("organizations").update({ booking_subdomain: value }).eq("id", org.id);
  if (error) return { ok: false, error: error.code === "23505" ? await said("Another business already has that address. Try another.") : error.message };
  refresh(org.slug);
  return { ok: true, value };
}

/** Their own domain (Business plan). Saved at once; it goes live when the DNS record is in place. Empty removes it. */
export async function saveOwnDomain(input: { value: string }): Promise<Result<{ value: string | null; status: string | null }>> {
  const who = await ownerOrg();
  if ("error" in who) return { ok: false, error: who.error as string };
  const { org, admin } = who;
  const previous = org.custom_domain as string | null;
  if (!String(input.value || "").trim()) {
    await admin.from("organizations").update({ custom_domain: null, custom_domain_status: null }).eq("id", org.id);
    if (previous) await removeProjectDomain(previous);
    refresh(org.slug);
    return { ok: true, value: null, status: null };
  }
  if (!canUseOwnDomain(org)) return { ok: false, error: await said("Your own domain comes with the Business plan.") };
  const domain = cleanDomain(input.value);
  if (!domain) return { ok: false, error: await said("That doesn't look like a web address. Write it like book.yourshop.com.") };
  const { data: taken } = await admin.from("organizations").select("id").ilike("custom_domain", domain).is("deleted_at", null).neq("id", org.id).limit(1);
  if (taken?.length) return { ok: false, error: await said("That address is already used by another business.") };

  let status = "waiting_dns";
  if (vercelDomainsConfigured()) {
    const added = await addProjectDomain(domain);
    if (!added.ok) return { ok: false, error: added.error || (await said("Could not add the address. Please try again.")) };
  } else {
    status = "waiting_team";
  }
  const { error } = await admin.from("organizations").update({ custom_domain: domain, custom_domain_status: status }).eq("id", org.id);
  if (error) return { ok: false, error: error.message };
  if (previous && previous !== domain) await removeProjectDomain(previous);

  if (status === "waiting_team") {
    // Until Lokalfleet can add domains itself, the team connects it by hand: open a Help conversation so it isn't missed.
    const { data: thread } = await admin
      .from("support_threads")
      .insert({ organization_id: org.id, created_by: who.membership.userId, topic: "domain", subject: `Connect ${domain}`, status: "open", unread_by_team: true })
      .select("id")
      .single();
    if (thread) {
      await admin.from("support_messages").insert({ thread_id: thread.id, organization_id: org.id, author_id: who.membership.userId, from_team: false, body: `Please connect ${domain} to our booking page.`, attachments: [] });
      await alertTeam(`${org.name}: connect own domain ${domain}`, thread.id);
    }
  }
  refresh(org.slug);
  return { ok: true, value: domain, status };
}

/** "Check again": live once the DNS record points at Lokalfleet. */
export async function checkOwnDomain(): Promise<Result<{ status: string | null }>> {
  const who = await ownerOrg();
  if ("error" in who) return { ok: false, error: who.error as string };
  const { org, admin } = who;
  if (!org.custom_domain) return { ok: true, status: null };
  if (!vercelDomainsConfigured()) return { ok: true, status: org.custom_domain_status };
  const ready = await projectDomainReady(org.custom_domain);
  const status = ready ? "live" : "waiting_dns";
  if (status !== org.custom_domain_status) await admin.from("organizations").update({ custom_domain_status: status }).eq("id", org.id);
  refresh(org.slug);
  return { ok: true, status };
}
