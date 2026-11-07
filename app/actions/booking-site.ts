"use server";

import { revalidatePath } from "next/cache";
import { said } from "@/lib/i18n/server-text";
import { getCurrentMembership } from "@/lib/auth/roles";
import { OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { bookingSiteFrom, bookingSiteToStored } from "@/lib/booking-site";

type Result = { ok: true } | { ok: false; error: string };

const HERO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const HERO_MAX_BYTES = 5 * 1024 * 1024;

/** The first bytes of a real JPG, PNG or WebP (the browser's type alone can be anything). */
function looksLikeImage(bytes: Buffer, extension: string) {
  if (extension === "jpg") return bytes[0] === 0xff && bytes[1] === 0xd8;
  if (extension === "png") return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (extension === "webp") return bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
  return false;
}

async function ownerOrganization() {
  const membership = await getCurrentMembership();
  if (!membership) return { error: await said("Please sign in again.") } as const;
  if (membership.role !== "owner") return { error: await said(OWNER_ONLY_MESSAGE) } as const;
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("id, slug, settings").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { error: await said("Business not found.") } as const;
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  return { admin, organization, settings } as const;
}

async function store(admin: any, organization: { id: string; slug: string }, settings: Record<string, unknown>, bookingSite: unknown): Promise<Result> {
  // Read back through the same tidy-up the page uses, so only allowed values are ever stored.
  const clean = bookingSiteToStored(bookingSiteFrom({ booking_site: bookingSite }));
  const { error } = await admin.from("organizations").update({ settings: { ...settings, booking_site: clean } }).eq("id", organization.id);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/settings");
  revalidatePath(`/rent/${organization.slug}`);
  return { ok: true };
}

/**
 * Saves the booking page's template and sections (owner only). `input` is the stored shape (snake_case); the
 * hero photo is kept as it is (it changes only through saveBookingHero).
 */
export async function saveBookingSite(input: Record<string, unknown>): Promise<Result> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const { admin, organization, settings } = found;
  const current = settings.booking_site && typeof settings.booking_site === "object" ? settings.booking_site : {};
  return store(admin, organization, settings, { ...input, hero_path: current.hero_path ?? null });
}

/** Uploads (or removes, with remove=true) the booking page's big photo (owner only). */
export async function saveBookingHero(formData: FormData): Promise<Result> {
  const found = await ownerOrganization();
  if ("error" in found) return { ok: false, error: found.error as string };
  const { admin, organization, settings } = found;
  const current = settings.booking_site && typeof settings.booking_site === "object" ? settings.booking_site : {};
  const oldPath = typeof current.hero_path === "string" && current.hero_path.startsWith(`${organization.id}/`) ? current.hero_path : null;
  let heroPath: string | null = null;

  if (String(formData.get("remove") || "") !== "true") {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: await said("Choose a photo first.") };
    const extension = HERO_TYPES[file.type];
    if (!extension || file.size > HERO_MAX_BYTES) return { ok: false, error: await said("Use a JPG, PNG or WebP photo up to 5 MB.") };
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!looksLikeImage(bytes, extension)) return { ok: false, error: await said("Use a JPG, PNG or WebP photo up to 5 MB.") };
    heroPath = `${organization.id}/branding/booking-page/${crypto.randomUUID()}.${extension}`;
    const { error } = await admin.storage.from("branding").upload(heroPath, bytes, { contentType: file.type, upsert: true });
    if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  }

  const result = await store(admin, organization, settings, { ...current, hero_path: heroPath });
  if (result.ok && oldPath && oldPath !== heroPath) await admin.storage.from("branding").remove([oldPath]).catch(() => null);
  return result;
}
