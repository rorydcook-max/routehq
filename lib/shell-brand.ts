import { planById } from "@/lib/plans";
import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";

export type ShellBrand = {
  name: string;
  logoUrl: string | null;
  colour: string | null;
  /** Show the small "Powered by RoveHQ" line under their logo. */
  poweredBy: boolean;
};

/** Logo and colour in the app itself: a white-label plan (everything is on during the trial). */
export async function shellBrand(supabase: any, organizationId: string): Promise<ShellBrand | null> {
  try {
    const { data: organization } = await supabase
      .from("organizations")
      .select("name, trading_name, logo_url, business_logo_storage_bucket, business_logo_storage_path, settings, contract_accent_colour, powered_by_routehq_enabled, subscription_tier, subscription_status")
      .eq("id", organizationId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!organization) return null;
    const onTrial = String(organization.subscription_status || "trial") === "trial";
    if (!onTrial && !planById(organization.subscription_tier).whiteLabel) return null;
    const { logoUrl } = await resolveOrganizationBrandingDisplayUrls(supabase, organization);
    return {
      name: String(organization.trading_name || organization.name || ""),
      logoUrl: logoUrl || null,
      colour: organization.contract_accent_colour || null,
      poweredBy: organization.powered_by_routehq_enabled !== false
    };
  } catch {
    return null;
  }

}
