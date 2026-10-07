"use server";

import { said } from "@/lib/i18n/server-text";
import {
  bookingLinkUploadPrefix,
  createSignedUploads,
  inspectionUploadPrefix,
  type PreparedUploads,
  type UploadRequest
} from "@/lib/direct-uploads";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// These return { error } rather than throwing: production hides the message
// of an error thrown from a server action, and people need to see these.

async function failed(error: unknown): Promise<PreparedUploads> {
  return { uploads: [], error: await said(error instanceof Error ? error.message : "The upload could not be prepared.") };
}

/** Signed upload URLs for an inspection, for a signed-in member of the business. */
export async function prepareInspectionUploads(organizationId: string, files: UploadRequest[]): Promise<PreparedUploads> {
  try {
    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return { uploads: [], error: await said("You must be signed in.") };
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership) return { uploads: [], error: await said("You do not have access to this business.") };
    return { uploads: await createSignedUploads(inspectionUploadPrefix(organizationId), files) };
  } catch (error) {
    return failed(error);
  }
}

/** Signed upload URLs for a customer completing their booking link. */
export async function preparePublicBookingUploads(token: string, files: UploadRequest[]): Promise<PreparedUploads> {
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data: link } = await admin
      .from("booking_links")
      .select("id, organization_id, status, expires_at")
      .eq("token", String(token || ""))
      .is("deleted_at", null)
      .maybeSingle();
    if (!link || link.status === "cancelled") return { uploads: [], error: await said("This booking link could not be found.") };
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return { uploads: [], error: await said("This booking link has expired.") };
    return { uploads: await createSignedUploads(bookingLinkUploadPrefix(link.organization_id, link.id), files) };
  } catch (error) {
    return failed(error);
  }
}
