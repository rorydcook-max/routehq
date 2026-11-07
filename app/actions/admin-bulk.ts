"use server";

import { revalidatePath } from "next/cache";
import { ADMIN_STATUSES, ADMIN_STATUS_LABEL, ADMIN_TIER_LABEL, adminDate, listBusinesses, logAdminAction, requirePlatformAdmin } from "@/lib/admin";
import { cleanTag, segmentsOf, tagsFrom } from "@/lib/admin-segments";
import { endViewSession, type ViewSession } from "@/lib/admin-view";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Admin › Businesses bulk actions (Rory, 7 Nov 2026): add or remove a tag, change plan, extend trial, export CSV,
 * delete. Each business is changed and logged on its own, the same way as the buttons on its page, so the admin log
 * has one line per business.
 */

export type BulkInput =
  | { action: "tag_add" | "tag_remove"; ids: string[]; tag: string }
  | { action: "plan"; ids: string[]; tier: string; status: string }
  | { action: "trial"; ids: string[]; days: number }
  | { action: "delete"; ids: string[]; confirm: string; includePaid: boolean }
  | { action: "export"; ids: string[] };

export type BulkResult = { ok: boolean; message: string; csv?: string };

const TIERS = ["free", "starter", "pro", "business"] as const;
const MAX = 2000;

function plural(count: number, one: string, many = `${one}es`) {
  return `${count} ${count === 1 ? one : many}`;
}

/** The text the admin must type to delete: "Delete 21 businesses" (or "Delete 1 business"). */
export async function deletePhrase(count: number) {
  return `Delete ${plural(count, "business")}`;
}

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export async function adminBulkBusinesses(input: BulkInput): Promise<BulkResult> {
  const admin = await requirePlatformAdmin();
  const ids = Array.from(new Set((input.ids || []).map(String).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, MAX);
  if (!ids.length) return { ok: false, message: "Choose at least one business." };
  const db = createSupabaseAdminClient() as any;

  if (input.action === "export") {
    const chosen = new Set(ids);
    const rows = (await listBusinesses()).filter((business) => chosen.has(business.id));
    const head = ["id", "name", "owner_email", "country", "plan", "status", "interval", "trial_ends", "next_payment", "vehicles", "team", "last_sign_in", "joined", "closed", "tags", "segments"];
    const lines = rows.map((b) =>
      [
        b.id,
        b.name,
        b.owners.map((owner) => owner.email).filter(Boolean).join("; "),
        b.country,
        ADMIN_TIER_LABEL[b.tier] || b.tier,
        ADMIN_STATUS_LABEL[b.status] || b.status,
        b.interval,
        b.trialEndsAt?.slice(0, 10),
        b.nextPaymentDue?.slice(0, 10),
        b.vehicles,
        b.members,
        b.lastActive?.slice(0, 10),
        b.createdAt?.slice(0, 10),
        b.deletedAt?.slice(0, 10),
        b.tags.join("; "),
        segmentsOf(b).join("; ")
      ]
        .map(csvCell)
        .join(",")
    );
    return { ok: true, message: `Exported ${plural(rows.length, "business")}.`, csv: [head.join(","), ...lines].join("\r\n") };
  }

  const { data: orgs, error: readError } = await db.from("organizations").select("*").in("id", ids);
  if (readError) return { ok: false, message: "Couldn't read those businesses. Please try again." };
  const list = (orgs || []) as any[];
  let changed = 0;
  let skipped = 0;
  const failed: string[] = [];

  if (input.action === "tag_add" || input.action === "tag_remove") {
    const tag = cleanTag(input.tag);
    if (!tag) return { ok: false, message: "Type a tag first." };
    for (const org of list) {
      const now = tagsFrom(org.admin_tags);
      const next = input.action === "tag_add" ? Array.from(new Set([...now, tag])).sort() : now.filter((item) => item !== tag);
      if (next.length === now.length) {
        skipped += 1;
        continue;
      }
      const { error } = await db.from("organizations").update({ admin_tags: next }).eq("id", org.id);
      if (error) {
        // The column comes with migration 0124; until it has run, say so plainly.
        if (/admin_tags/.test(error.message || "") || error.code === "42703" || error.code === "PGRST204") {
          return { ok: false, message: "Tags need the database update in supabase/migrations/0124_admin_business_tags.sql. Run it in Supabase, then try again." };
        }
        failed.push(org.name);
        continue;
      }
      changed += 1;
      await logAdminAction(admin, { action: input.action === "tag_add" ? "tag_added" : "tag_removed", organizationId: org.id, details: { tag, bulk: true } });
    }
    revalidatePath("/platform/businesses");
    const verb = input.action === "tag_add" ? `Tagged ${plural(changed, "business")} "${tag}"` : `Removed "${tag}" from ${plural(changed, "business")}`;
    return { ok: !failed.length, message: `${verb}.${skipped ? ` ${skipped} already ${input.action === "tag_add" ? "had it" : "didn't have it"}.` : ""}${failed.length ? ` Couldn't change: ${failed.join(", ")}.` : ""}` };
  }

  if (input.action === "plan") {
    const tier = input.tier;
    const status = input.status;
    if (!TIERS.includes(tier as never)) return { ok: false, message: "Choose a plan." };
    if (status && !ADMIN_STATUSES.includes(status as never)) return { ok: false, message: "Choose a status." };
    for (const org of list) {
      const toStatus = status || org.subscription_status || "trial";
      const update: Record<string, unknown> = { subscription_tier: tier, subscription_status: toStatus };
      // Turning a business to paying starts its first period now if it has none yet (as on its own page).
      if (toStatus === "active" && !org.next_payment_due) {
        const next = new Date();
        next.setMonth(next.getMonth() + (org.billing_interval === "yearly" ? 12 : 1));
        update.next_payment_due = next.toISOString();
        update.subscription_started_at = org.subscription_started_at || new Date().toISOString();
      }
      const { error } = await db.from("organizations").update(update).eq("id", org.id);
      if (error) {
        failed.push(org.name);
        continue;
      }
      changed += 1;
      await logAdminAction(admin, {
        action: "plan_changed",
        organizationId: org.id,
        details: { from: { tier: org.subscription_tier, interval: org.billing_interval, status: org.subscription_status }, to: { tier, interval: org.billing_interval, status: toStatus }, bulk: true }
      });
    }
    revalidatePath("/platform", "layout");
    return { ok: !failed.length, message: `Moved ${plural(changed, "business")} to ${ADMIN_TIER_LABEL[tier]}${status ? ` (${ADMIN_STATUS_LABEL[status]})` : ""}.${failed.length ? ` Couldn't change: ${failed.join(", ")}.` : ""}` };
  }

  if (input.action === "trial") {
    const days = Math.round(Number(input.days) || 0);
    if (days < 1 || days > 365) return { ok: false, message: "Choose between 1 and 365 days." };
    for (const org of list) {
      // From the later of now and the current end, as on the business's page; a trial that had run out comes back.
      const from = Math.max(Date.now(), org.trial_ends_at ? Date.parse(org.trial_ends_at) : 0);
      const ends = new Date(from + days * 86_400_000).toISOString();
      const update: Record<string, unknown> = { trial_ends_at: ends };
      if (["expired", "trial"].includes(org.subscription_status || "trial")) update.subscription_status = "trial";
      const { error } = await db.from("organizations").update(update).eq("id", org.id);
      if (error) {
        failed.push(org.name);
        continue;
      }
      changed += 1;
      await logAdminAction(admin, { action: "trial_extended", organizationId: org.id, details: { from: org.trial_ends_at, to: ends, bulk: true } });
    }
    revalidatePath("/platform", "layout");
    return { ok: !failed.length, message: `Extended the trial of ${plural(changed, "business")} by ${days} days.${failed.length ? ` Couldn't change: ${failed.join(", ")}.` : ""}` };
  }

  if (input.action === "delete") {
    const open = list.filter((org) => !org.deleted_at);
    if (String(input.confirm || "").trim().toLowerCase() !== (await deletePhrase(ids.length)).toLowerCase()) {
      return { ok: false, message: `Type "${await deletePhrase(ids.length)}" to confirm.` };
    }
    const paidNames: string[] = [];
    for (const org of open) {
      // The same as "Delete business" on its page: closed now (deleted_at), restorable, deleted for good after 30 days
      // from its page. A business that has paid for time it hasn't used is left alone unless that was ticked too.
      const paidUp = org.subscription_status === "active" && org.next_payment_due && Date.parse(org.next_payment_due) > Date.now();
      if (paidUp && !input.includePaid) {
        paidNames.push(`${org.name} (paid until ${adminDate(org.next_payment_due)})`);
        continue;
      }
      const { error } = await db.from("organizations").update({ deleted_at: new Date().toISOString() }).eq("id", org.id).is("deleted_at", null);
      if (error) {
        failed.push(org.name);
        continue;
      }
      const { data: sessions } = await db.from("admin_view_sessions").select("*").eq("organization_id", org.id).is("ended_at", null);
      for (const session of (sessions || []) as ViewSession[]) await endViewSession(session, "stopped", admin.email);
      changed += 1;
      await logAdminAction(admin, { action: "business_deleted", organizationId: org.id, details: { name: org.name, paid_until: paidUp ? org.next_payment_due : null, bulk: true } });
      if (org.slug) revalidatePath(`/rent/${org.slug}`);
    }
    revalidatePath("/platform", "layout");
    const already = list.length - open.length;
    return {
      ok: !failed.length && !paidNames.length,
      message:
        `Closed ${plural(changed, "business")}. They can be restored from their pages for 30 days, then deleted for good.` +
        (already ? ` ${already} ${already === 1 ? "was" : "were"} already closed.` : "") +
        (paidNames.length ? ` Not closed, still paid up: ${paidNames.join(", ")}.` : "") +
        (failed.length ? ` Couldn't close: ${failed.join(", ")}.` : "")
    };
  }

  return { ok: false, message: "Unknown action." };
}
