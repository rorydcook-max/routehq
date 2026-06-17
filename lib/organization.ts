import { getDefaultOrganizationSlug } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
export { getTravelPolicySettings, mergeTravelPolicySettings, jurisdictionByCountry, travelPolicyDefaults } from "@/lib/travel-policy";
export type { HomeTerritoryType, IslandTravelPolicy, TravelPolicySettings } from "@/lib/travel-policy";

export async function getDefaultOrganization() {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("organizations")
    .select("id, name, slug, default_locale, currency, timezone, settings, subscription_tier, created_at, logo_url, accepted_payment_methods, promptpay_id, promptpay_qr_url, bank_name, bank_account_number, bank_account_name, wise_link, revolut_link, receipt_prefix, receipt_footer_text, default_payment_method, line_user_id, line_notifications_enabled, line_daily_summary_enabled, line_daily_summary_time, line_channel_access_token")
    .eq("slug", getDefaultOrganizationSlug())
    .is("deleted_at", null)
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Default organization was not found.");
  }

  return data as {
    id: string;
    name: string;
    slug: string;
    default_locale: string;
    currency: string;
    timezone: string;
    settings: Record<string, any>;
    subscription_tier: string | null;
    created_at: string | null;
    logo_url: string | null;
    accepted_payment_methods: string[] | null;
    promptpay_id: string | null;
    promptpay_qr_url: string | null;
    bank_name: string | null;
    bank_account_number: string | null;
    bank_account_name: string | null;
    wise_link: string | null;
    revolut_link: string | null;
    receipt_prefix: string | null;
    receipt_footer_text: string | null;
    default_payment_method: string | null;
    line_user_id: string | null;
    line_notifications_enabled: boolean | null;
    line_daily_summary_enabled: boolean | null;
    line_daily_summary_time: string | null;
    line_channel_access_token: string | null;
  };
}

export async function getVehicleCategories(organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("vehicle_categories")
    .select("id, code, name")
    .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
    .order("sort_order", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Array<{ id: string; code: string; name: string }>;
}
