import type { ReactNode } from "react";
import { PageCountry } from "@/components/page-country";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** The booking link's business country, so dates on this customer page are written its way (lib/i18n/customer-dates.ts). */
async function linkCountry(token: string): Promise<string | null> {
  if (!token || token.length < 8) return null;
  try {
    const admin = createSupabaseAdminClient() as any;
    const { data } = await admin.from("booking_links").select("organizations!booking_links_organization_id_fkey(country_code)").eq("token", token).is("deleted_at", null).maybeSingle();
    return data?.organizations?.country_code || null;
  } catch {
    return null;
  }
}

export default async function BookingLinkLayout({ children, params }: { children: ReactNode; params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <PageCountry country={await linkCountry(token)}>{children}</PageCountry>;
}
