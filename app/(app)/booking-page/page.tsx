import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { bookingAddress, canUseOwnDomain, canUseSubdomain, cleanSubdomain, renterUrl, rootDomain, subdomainUrl } from "@/lib/booking-address";
import { bookingRules } from "@/lib/booking-rules";
import { resolveOrganizationBrandingDisplayUrls } from "@/lib/branding-assets";
import { loadSiteRow, uploadUrls } from "@/lib/sites/data";
import { kindFromCategory } from "@/lib/vehicle-groups";
import { getCustomPlan } from "@/lib/custom-plan";
import { getDefaultOrganization } from "@/lib/organization";
import { publicBookingSettings } from "@/lib/public-catalog";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { vehiclePhotoUrls } from "@/lib/vehicle-photos";
import { BookingPageTool } from "./booking-page-tool";

function browserSafeAssetFallback(value: string | null | undefined) {
  const rawValue = String(value || "").trim();
  return rawValue.startsWith("http") || rawValue.startsWith("data:") ? rawValue : null;
}

/**
 * Booking page (side menu › Tools; Rory, 7 Nov 2026): everything about the business's public booking page in one
 * place, the editor beside a live preview of the real page. Moved here from Settings › Rentals and payments. The
 * booking rules every booking follows (deposit, holds and notice, payment methods) stay in Settings. Owner only.
 */
export default async function BookingPagePage() {
  const membership = await getCurrentMembership();
  if (membership && membership.role !== "owner") redirect("/?notice=owner-only");
  const [userEmail, organization, t] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("settingsPage")]);
  const supabase = (await createSupabaseServerClient()) as any;
  const admin = createSupabaseAdminClient() as any;

  const [{ data: addressRow }, customPlan, { data: vehicleRates }, brandingDisplayUrls] = await Promise.all([
    supabase.from("organizations").select("booking_subdomain, custom_domain, custom_domain_status").eq("id", organization.id).maybeSingle(),
    getCustomPlan(organization.id),
    supabase.from("vehicles").select("id, make, model, trim, daily_rate, weekly_rate, monthly_rate, vehicle_categories(code, name)").eq("organization_id", organization.id).is("deleted_at", null).order("monthly_rate", { ascending: true }),
    resolveOrganizationBrandingDisplayUrls(supabase, organization, { allowExternalUrl: true })
  ]);
  const addressOrg = { ...(organization as any), ...(addressRow || {}), custom_limits: customPlan.custom_limits };
  const vehicles = (vehicleRates || []) as Array<{ id: string; make: string | null; model: string | null; trim: string | null; daily_rate: unknown; weekly_rate: unknown; monthly_rate: unknown; vehicle_categories: any }>;
  const priced = vehicles.filter((v) => Number(v.daily_rate) > 0 || Number(v.weekly_rate) > 0 || Number(v.monthly_rate) > 0).length;

  // The website: the draft being edited and what is published (booking_sites), and each vehicle's main photo for the image picker.
  const [siteRow, photos] = await Promise.all([
    loadSiteRow(organization.id, organization.settings, vehicles.map((vehicle) => kindFromCategory(vehicle.vehicle_categories))),
    vehiclePhotoUrls(admin, organization.id, 1).catch(() => new Map<string, string[]>())
  ]);
  const uploads = { ...(await uploadUrls(siteRow.published)), ...(await uploadUrls(siteRow.draft)) };
  const editorVehicles = vehicles.map((vehicle) => ({ id: vehicle.id, name: [vehicle.make, vehicle.model, vehicle.trim].filter(Boolean).join(" ") || "—", photoUrl: photos.get(vehicle.id)?.[0] || null }));

  const settings = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings) ? (organization.settings as Record<string, any>) : {};
  const logoUrl =
    organization.business_logo_storage_bucket && organization.business_logo_storage_path ? "/api/branding-assets/logo" : brandingDisplayUrls.logoUrl || browserSafeAssetFallback(organization.logo_url);
  const booking = publicBookingSettings(organization.settings);
  const businessName = String(organization.trading_name || organization.name || "");

  return (
    <AppShell hero={<PageBand title={t("bt_title")} />} userEmail={userEmail}>
      <BookingPageTool
        address={{
          canDomain: canUseOwnDomain(addressOrg),
          canSubdomain: canUseSubdomain(addressOrg),
          domain: addressOrg.custom_domain || null,
          domainStatus: addressOrg.custom_domain_status || null,
          pathUrl: `${renterUrl()}/${organization.slug}`,
          rootDomain: rootDomain(),
          subdomain: addressOrg.booking_subdomain || null,
          subdomainUrl: addressOrg.booking_subdomain ? subdomainUrl(addressOrg.booking_subdomain) : null,
          suggestion:
            cleanSubdomain(String(organization.name || organization.slug).replace(/\b(car|cars|rent|rental|rentals|test\d*)\b/gi, "")) || cleanSubdomain(organization.slug).slice(0, 20)
        }}
        booking={{ enabled: booking.enabled, offer: booking.offer, deposit: booking.deposit, holdHours: bookingRules(organization.settings).holdHours }}
        businessName={businessName}
        colour={String((organization as any).contract_accent_colour || "#0e5e6f")}
        draft={siteRow.draft}
        editorVehicles={editorVehicles}
        published={siteRow.published}
        uploads={uploads}
        link={bookingAddress(addressOrg).url}
        logoUrl={logoUrl}
        slug={organization.slug}
        vehicles={{ priced, total: vehicles.length }}
      />
    </AppShell>
  );
}
