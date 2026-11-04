import { organizationLogoReference, resolveBrandingDisplayUrl } from "@/lib/branding-assets";
import { safeEmailImageUrl, type EmailBrand } from "@/lib/email/layout";

/** The columns operatorEmailBrand reads from organizations. */
export const OPERATOR_BRAND_COLUMNS = "name, trading_name, logo_url, business_logo_storage_bucket, business_logo_storage_path, settings, contract_accent_colour";

// An email is opened days or months later, so its logo link has to outlive a page's one-hour link.
const LOGO_LINK_SECONDS = 60 * 60 * 24 * 365;

/**
 * How an email to an operator's customer is headed: their logo (or their name) and their colour, never RoveHQ's.
 * Never throws: with no logo, or one that can't be shown in email (SVG, data: URL), the name is used.
 */
export async function operatorEmailBrand(supabase: any, organization: any, fallbackName = ""): Promise<EmailBrand> {
  const name = String(organization?.trading_name || organization?.name || fallbackName || "").trim() || fallbackName;
  let logoUrl: string | null = null;
  try {
    if (organization) {
      logoUrl = safeEmailImageUrl(
        await resolveBrandingDisplayUrl(supabase, { ...organizationLogoReference(organization), allowExternalUrl: true, expiresIn: LOGO_LINK_SECONDS })
      );
    }
  } catch {
    logoUrl = null;
  }
  return { kind: "operator", name, logoUrl, colour: organization?.contract_accent_colour || null };
}

/** Looks the business up and returns its email brand. */
export async function operatorEmailBrandById(supabase: any, organizationId: string, fallbackName = ""): Promise<EmailBrand> {
  try {
    const { data } = await supabase.from("organizations").select(OPERATOR_BRAND_COLUMNS).eq("id", organizationId).maybeSingle();
    return await operatorEmailBrand(supabase, data, fallbackName);
  } catch {
    return { kind: "operator", name: fallbackName };
  }
}
