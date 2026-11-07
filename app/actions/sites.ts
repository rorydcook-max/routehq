"use server";

import { revalidatePath } from "next/cache";
import { said } from "@/lib/i18n/server-text";
import { getCurrentMembership } from "@/lib/auth/roles";
import { OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { resolveBrandingAssetUrl } from "@/lib/branding-assets";
import { isBrandColour } from "@/lib/brand";
import { recordInbound } from "@/lib/inbox/store";
import { EMAIL_PATTERN, requestIpHash } from "@/lib/site/request-hash";
import { siteConfigFrom, type SiteConfig } from "@/lib/sites/config";
import { loadSiteRow } from "@/lib/sites/data";
import { kindFromCategory } from "@/lib/vehicle-groups";

/**
 * The website builder's saves (Rory, 7 Nov 2026; booking_sites, migration 0133). The editor saves the draft as the
 * owner works; Publish copies the draft to what renters see; Revert puts the published copy back into the draft.
 * Owner only. Also the public contact form, which lands in the business's Inbox.
 */

type Result = { ok: true } | { ok: false; error: string };

async function ownerOrganization() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said("Please sign in again.") } as const;
  if (membership.role !== "owner") return { error: await said(OWNER_ONLY_MESSAGE) } as const;
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("id, slug, settings").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { error: await said("Business not found.") } as const;
  return { admin, organization, membership } as const;
}

function refresh(slug: string) {
  revalidatePath("/booking-page");
  revalidatePath(`/rent/${slug}`);
}

/** Saves the draft (the editor calls this a moment after each change). */
export async function saveSiteDraft(input: unknown): Promise<Result> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const { admin, organization, membership } = found;
  const draft = siteConfigFrom(input);
  const { error } = await admin
    .from("booking_sites")
    .upsert({ organization_id: organization.id, draft, draft_updated_at: new Date().toISOString(), updated_by: membership.userId }, { onConflict: "organization_id" });
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  return { ok: true };
}

/** Makes the draft live. */
export async function publishSite(input: unknown): Promise<Result & { publishedAt?: string }> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const { admin, organization, membership } = found;
  const config = siteConfigFrom(input);
  const now = new Date().toISOString();
  const { error } = await admin
    .from("booking_sites")
    .upsert({ organization_id: organization.id, draft: config, published: config, published_at: now, draft_updated_at: now, updated_by: membership.userId }, { onConflict: "organization_id" });
  if (error) return { ok: false, error: await said("Couldn't publish. Please try again.") };
  refresh(organization.slug);
  return { ok: true, publishedAt: now };
}

/** Throws the draft away: the draft becomes what is published again. */
export async function revertSiteDraft(): Promise<({ ok: true; config: SiteConfig; uploads: Record<string, string> }) | { ok: false; error: string }> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const { admin, organization, membership } = found;
  const { data: vehicles } = await admin.from("vehicles").select("vehicle_categories(code, name)").eq("organization_id", organization.id).is("deleted_at", null).limit(200);
  const kinds = ((vehicles || []) as any[]).map((vehicle) => kindFromCategory(vehicle.vehicle_categories));
  const row = await loadSiteRow(organization.id, organization.settings, kinds);
  const { error } = await admin
    .from("booking_sites")
    .upsert({ organization_id: organization.id, draft: row.published, draft_updated_at: new Date().toISOString(), updated_by: membership.userId }, { onConflict: "organization_id" });
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  const uploads = await signedUploads(admin, row.published);
  return { ok: true, config: row.published, uploads };
}

async function signedUploads(admin: any, config: SiteConfig) {
  const paths = [config.images.hero, config.images.about].flatMap((ref) => (ref?.kind === "upload" ? [ref.path] : []));
  const out: Record<string, string> = {};
  for (const path of paths) {
    const url = await resolveBrandingAssetUrl(admin, { bucket: "branding", path }, { expiresIn: 60 * 60 }).catch(() => null);
    if (url) out[path] = url;
  }
  return out;
}

const IMAGE_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const IMAGE_MAX_BYTES = 8 * 1024 * 1024;

function looksLikeImage(bytes: Buffer, extension: string) {
  if (extension === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (extension === "png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === "webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

/**
 * Uploads a photo for the site (branding bucket). Returns its path for the draft and a URL to show it straight away.
 * Old uploads are kept: the published site may still use one until the next Publish.
 */
export async function uploadSiteImage(formData: FormData): Promise<({ ok: true; path: string; url: string }) | { ok: false; error: string }> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const { admin, organization } = found;
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: await said("Choose a photo first.") };
  const extension = IMAGE_TYPES[file.type];
  if (!extension || file.size > IMAGE_MAX_BYTES) return { ok: false, error: await said("Use a JPG, PNG or WebP photo up to 8 MB.") };
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!looksLikeImage(bytes, extension)) return { ok: false, error: await said("Use a JPG, PNG or WebP photo up to 8 MB.") };
  const path = `${organization.id}/branding/site/${crypto.randomUUID()}.${extension}`;
  const { error } = await admin.storage.from("branding").upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  const url = await resolveBrandingAssetUrl(admin, { bucket: "branding", path }, { expiresIn: 60 * 60 }).catch(() => null);
  if (!url) return { ok: false, error: await said("Couldn't save. Please try again.") };
  return { ok: true, path, url };
}

/**
 * The brand colour from the Booking page tool (owner only). The same colour as Settings › Business › Your brand:
 * it also colours agreements, receipts and booking links, and the site's palettes start from it.
 */
export async function saveBrandColour(colour: string): Promise<Result> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const value = String(colour || "").trim().toLowerCase();
  if (!isBrandColour(value)) return { ok: false, error: await said("Couldn't save. Please try again.") };
  const { admin, organization } = found;
  const { error } = await admin.from("organizations").update({ contract_accent_colour: value }).eq("id", organization.id);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/", "layout");
  revalidatePath(`/rent/${organization.slug}`);
  return { ok: true };
}

// ── The public contact form ──────────────────────────────────────────────────

export type SiteMessageState = {
  n: number;
  status?: "sent";
  error?: "required" | "contact" | "tooMany" | "failed";
  values?: { name: string; contact: string; message: string };
};

const PER_HOUR_FROM_ONE = 5;
const PER_HOUR_TO_ONE = 40;

/**
 * A renter writes from a business's website: the message lands in that business's Inbox as a "Website" conversation
 * (one per sender, by their email or phone) and the owner gets the usual new-message alert. A filled-in honeypot
 * pretends to succeed and keeps nothing; five messages an hour from one address, or forty to one business, are
 * turned away. Only a salted hash of the address is kept.
 */
export async function sendSiteMessage(slug: string, previous: SiteMessageState, formData: FormData): Promise<SiteMessageState> {
  const n = (previous?.n || 0) + 1;
  const values = {
    name: String(formData.get("name") || "").replace(/\s+/g, " ").trim().slice(0, 120),
    contact: String(formData.get("contact") || "").trim().slice(0, 160),
    message: String(formData.get("message") || "").replace(/\r/g, "").trim().slice(0, 2000)
  };
  if (String(formData.get("website") || "").trim()) return { n, status: "sent" };
  if (!values.name || !values.contact || !values.message) return { n, error: "required", values };
  const email = EMAIL_PATTERN.test(values.contact) ? values.contact.toLowerCase() : null;
  const phoneDigits = values.contact.replace(/[^\d]/g, "");
  if (!email && (phoneDigits.length < 7 || phoneDigits.length > 16 || /[a-z]/i.test(values.contact))) return { n, error: "contact", values };

  try {
    const admin = createSupabaseAdminClient() as any;
    const { data: organization } = await admin.from("organizations").select("id").eq("slug", String(slug || "").slice(0, 80)).is("deleted_at", null).maybeSingle();
    if (!organization) return { n, error: "failed", values };

    const hash = await requestIpHash();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const [{ count: fromOne }, { count: toOne }] = await Promise.all([
      admin.from("booking_site_messages").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since),
      admin.from("booking_site_messages").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).gte("created_at", since)
    ]);
    if ((fromOne || 0) >= PER_HOUR_FROM_ONE || (toOne || 0) >= PER_HOUR_TO_ONE) return { n, error: "tooMany", values };

    // The business's one Website channel, made the first time someone writes.
    let { data: channel } = await admin.from("messaging_channels").select("id, organization_id, provider, status").eq("organization_id", organization.id).eq("provider", "website").maybeSingle();
    if (!channel) {
      const created = await admin
        .from("messaging_channels")
        .insert({ organization_id: organization.id, provider: "website", display_name: "Website", external_id: "website", status: "connected" })
        .select("id, organization_id, provider, status")
        .single();
      channel = created.data;
      if (!channel) {
        // Made at the same moment by another message.
        ({ data: channel } = await admin.from("messaging_channels").select("id, organization_id, provider, status").eq("organization_id", organization.id).eq("provider", "website").maybeSingle());
      }
    }
    if (!channel) return { n, error: "failed", values };

    const result = await recordInbound({
      channel: { id: channel.id, organization_id: organization.id, provider: "website" },
      externalUserId: email || `+${phoneDigits}`,
      displayName: values.name,
      body: `${values.message}\n\n${values.name} · ${email || values.contact}`
    });
    if (!result.ok) return { n, error: "failed", values };
    await admin.from("booking_site_messages").insert({ organization_id: organization.id, conversation_id: result.conversationId || null, ip_hash: hash });
    return { n, status: "sent" };
  } catch {
    return { n, error: "failed", values };
  }
}
