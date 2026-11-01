"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getDefaultOrganization } from "@/lib/organization";
import { vehiclePhotoUrls } from "@/lib/vehicle-photos";

/**
 * Every vehicle's main photo for the business being used, so a vehicle's picture is its photo wherever it appears
 * (Rory, 1 Nov 2026). Links last 12 hours; the browser keeps them for an hour, so pictures are not fetched again
 * on every page. Nothing (an empty list) when not signed in.
 */
export async function vehicleMainPhotos(): Promise<{ organizationId: string; photos: Record<string, string> }> {
  try {
    const [supabase, organization] = await Promise.all([createSupabaseServerClient(), getDefaultOrganization()]);
    const {
      data: { user }
    } = await (supabase as any).auth.getUser();
    if (!user || !organization?.id) return { organizationId: "", photos: {} };
    const map = await vehiclePhotoUrls(supabase, organization.id, 1, 12 * 3600);
    return { organizationId: organization.id, photos: Object.fromEntries([...map].map(([id, urls]) => [id, urls[0]])) };
  } catch {
    return { organizationId: "", photos: {} };
  }
}
