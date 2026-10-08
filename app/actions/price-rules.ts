"use server";

import { revalidatePath } from "next/cache";
import { said } from "@/lib/i18n/server-text";
import { getCurrentMembership, OWNER_ONLY_MESSAGE } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { extrasFrom, seasonsFrom, type Extra, type Season } from "@/lib/price-rules";

type Result = { ok: true } | { ok: false; error: string };

/** Saves one list in organizations.settings (owner only), run through the same reader the app uses. */
async function saveSetting(key: "seasons" | "extras", value: unknown[]): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };
  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("settings, slug").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: await said("Business not found.") };
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  const clean = key === "seasons" ? seasonsFrom({ seasons: value }) : extrasFrom({ extras: value });
  const { error } = await admin.from("organizations").update({ settings: { ...settings, [key]: clean } }).eq("id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/settings");
  revalidatePath("/bookings/new");
  if (organization.slug) revalidatePath(`/rent/${organization.slug}`);
  return { ok: true };
}

export async function saveSeasons(seasons: Season[]) {
  return saveSetting("seasons", seasons);
}

export async function saveExtras(extras: Extra[]) {
  return saveSetting("extras", extras);
}
