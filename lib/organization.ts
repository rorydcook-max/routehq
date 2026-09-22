import { getDefaultOrganizationSlug } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";
export { getTravelPolicySettings, mergeTravelPolicySettings, jurisdictionByCountry, travelPolicyDefaults } from "@/lib/travel-policy";
export type { HomeTerritoryType, IslandTravelPolicy, TravelPolicySettings } from "@/lib/travel-policy";

const organizationColumns = "id, name, slug, default_locale, currency, timezone, settings, subscription_tier, created_at, logo_url, business_logo_storage_bucket, business_logo_storage_path, owner_signature_url, trading_name, legal_name, registration_or_tax_number, business_address, business_phone, business_email, whatsapp, line_id, contract_accent_colour, authorised_signatory_name, authorised_signatory_title, authorised_signature_storage_bucket, authorised_signature_storage_path, signature_authorised_at, signature_authorisation_text_version, default_contract_locale, default_contract_template_id, contract_footer_text, powered_by_routehq_enabled, accepted_payment_methods, promptpay_id, promptpay_qr_url, bank_name, bank_account_number, bank_account_name, wise_link, revolut_link, receipt_prefix, receipt_footer_text, default_payment_method, line_user_id, line_notifications_enabled, line_daily_summary_enabled, line_daily_summary_time, line_channel_access_token, upfront_discount_enabled, upfront_discount_min_periods, upfront_discount_rate, upfront_discount_label";

export async function getDefaultOrganization() {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user) {
    const { data: membership, error: membershipError } = await getActiveMembership(supabase, user.id);

    if (membershipError) {
      throw new Error(membershipError.message);
    }

    if (membership?.organization_id) {
      const { data, error } = await supabase
        .from("organizations")
        .select(organizationColumns)
        .eq("id", membership.organization_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !data) {
        throw new Error(error?.message || "Active organization was not found.");
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
        business_logo_storage_bucket: string | null;
        business_logo_storage_path: string | null;
        owner_signature_url: string | null;
        trading_name: string | null;
        legal_name: string | null;
        registration_or_tax_number: string | null;
        business_address: string | null;
        business_phone: string | null;
        business_email: string | null;
        whatsapp: string | null;
        line_id: string | null;
        contract_accent_colour: string | null;
        authorised_signatory_name: string | null;
        authorised_signatory_title: string | null;
        authorised_signature_storage_bucket: string | null;
        authorised_signature_storage_path: string | null;
        signature_authorised_at: string | null;
        signature_authorisation_text_version: string | null;
        default_contract_locale: string | null;
        default_contract_template_id: string | null;
        contract_footer_text: string | null;
        powered_by_routehq_enabled: boolean | null;
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
        upfront_discount_enabled: boolean | null;
        upfront_discount_min_periods: number | null;
        upfront_discount_rate: number | null;
        upfront_discount_label: string | null;
      };
    }
  }

  const { data, error } = await supabase
    .from("organizations")
    .select(organizationColumns)
    .eq("slug", getDefaultOrganizationSlug())
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

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
    business_logo_storage_bucket: string | null;
    business_logo_storage_path: string | null;
    owner_signature_url: string | null;
    trading_name: string | null;
    legal_name: string | null;
    registration_or_tax_number: string | null;
    business_address: string | null;
    business_phone: string | null;
    business_email: string | null;
    whatsapp: string | null;
    line_id: string | null;
    contract_accent_colour: string | null;
    authorised_signatory_name: string | null;
    authorised_signatory_title: string | null;
    authorised_signature_storage_bucket: string | null;
    authorised_signature_storage_path: string | null;
    signature_authorised_at: string | null;
    signature_authorisation_text_version: string | null;
    default_contract_locale: string | null;
    default_contract_template_id: string | null;
    contract_footer_text: string | null;
    powered_by_routehq_enabled: boolean | null;
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
    upfront_discount_enabled: boolean | null;
    upfront_discount_min_periods: number | null;
    upfront_discount_rate: number | null;
    upfront_discount_label: string | null;
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
