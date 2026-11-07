import { resolveBrandingAssetUrl } from "@/lib/branding-assets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublishedReviews, getReviewStats, googleReviewUrl } from "@/lib/reviews";
import { serviceAreasFor, type BranchRow } from "@/lib/service-area";
import { siteConfigFrom, siteConfigFromLegacy, templateForFleet, type SiteConfig } from "@/lib/sites/config";
import { buildPolicies } from "@/lib/sites/policies";
import type { SiteCatalog, SiteData } from "@/lib/sites/types";
import type { getPublicCatalog } from "@/lib/public-catalog";

/**
 * The website's server side (Rory, 7 Nov 2026): reading a business's draft and published site (booking_sites,
 * migration 0133) and gathering what the page shows from RoveHQ: contact details, service areas, policies from
 * Settings, real published reviews and signed URLs for uploaded images.
 */

type Catalog = Extract<NonNullable<Awaited<ReturnType<typeof getPublicCatalog>>>, { vehicles: unknown }>;
type Say = (key: string, values?: Record<string, string | number>) => string;

export type SiteRow = { draft: SiteConfig; published: SiteConfig; publishedAt: string | null; hasRow: boolean };

/**
 * A business's site. With no row yet (or before the first Publish) both copies are the default: the old booking
 * page's choices carried over, or the template that suits the fleet.
 */
export async function loadSiteRow(organizationId: string, settings: unknown, kinds: string[]): Promise<SiteRow> {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("booking_sites").select("draft, published, published_at").eq("organization_id", organizationId).maybeSingle();
  const fallback = siteConfigFromLegacy(settings, kinds);
  const fallbackTemplate = fallback.template || templateForFleet(kinds);
  const published = data?.published ? siteConfigFrom(data.published, fallbackTemplate) : fallback;
  const draft = data?.draft && Object.keys(data.draft).length ? siteConfigFrom(data.draft, fallbackTemplate) : published;
  return { draft, published, publishedAt: data?.published_at || null, hasRow: Boolean(data) };
}

/** Signed URLs for a config's uploaded images (an hour, like the rest of the booking page's photos). */
export async function uploadUrls(config: SiteConfig): Promise<Record<string, string>> {
  const admin = createSupabaseAdminClient() as any;
  const paths = [config.images.hero, config.images.about].flatMap((ref) => (ref?.kind === "upload" ? [ref.path] : []));
  const entries = await Promise.all(
    paths.map(async (path) => [path, await resolveBrandingAssetUrl(admin, { bucket: "branding", path }, { expiresIn: 60 * 60 }).catch(() => null)] as const)
  );
  return Object.fromEntries(entries.filter(([, url]) => url)) as Record<string, string>;
}

/** Everything the page shows from RoveHQ, for a catalog already loaded with getPublicCatalog. */
export async function loadSiteData(input: { catalog: Catalog; slug: string; config: SiteConfig; catalogProps: SiteCatalog; t: Say }): Promise<SiteData> {
  const { catalog, config, t } = input;
  const admin = createSupabaseAdminClient() as any;
  const [{ data: organization }, { data: branches }, reviews, reviewStats, uploads] = await Promise.all([
    admin
      .from("organizations")
      .select("name, trading_name, settings, business_phone, business_email, business_address, whatsapp, line_id, accepted_payment_methods")
      .eq("id", catalog.organizationId)
      .maybeSingle(),
    admin.from("branches").select("id, name, address, latitude, longitude, service_radius_km, is_active").eq("organization_id", catalog.organizationId),
    getPublishedReviews(catalog.organizationId, 12).catch(() => []),
    getReviewStats(catalog.organizationId).catch(() => ({ average: 0, count: 0 })),
    uploadUrls(config)
  ]);
  const settings = organization?.settings && typeof organization.settings === "object" ? (organization.settings as Record<string, any>) : {};
  const areas = serviceAreasFor({ name: organization?.name, settings }, ((branches || []) as BranchRow[]))
    // Only a radius the owner set counts as delivery; otherwise the page says "pickup at".
    .map((area) => ({ name: area.name, radiusKm: area.radiusSet ? area.radiusKm : null }));
  const channels = settings.contact_channels && typeof settings.contact_channels === "object" ? settings.contact_channels : {};
  const methods = Array.isArray(organization?.accepted_payment_methods) && organization.accepted_payment_methods.length ? organization.accepted_payment_methods.map(String) : ["cash"];
  const place = String(settings.main_location?.town || "").trim() || String(catalog.location || "").split(",")[0].trim();

  return {
    slug: input.slug,
    business: {
      name: String(organization?.trading_name || catalog.name),
      logoUrl: catalog.logoUrl,
      place,
      address: String(organization?.business_address || catalog.address || ""),
      phone: String(organization?.business_phone || catalog.phone || ""),
      email: String(organization?.business_email || ""),
      whatsapp: String(organization?.whatsapp || ""),
      line: String(organization?.line_id || ""),
      currency: catalog.currency,
      social: { whatsapp: String(organization?.whatsapp || ""), line: String(organization?.line_id || ""), instagram: String(channels.instagram || ""), facebook: String(channels.messenger || "") }
    },
    brandColour: catalog.brandColour,
    vehicles: catalog.vehicles,
    catalog: input.catalogProps,
    policies: buildPolicies(
      {
        currency: catalog.currency,
        deposits: catalog.vehicles.map((vehicle) => vehicle.deposit),
        insuranceExcess: Math.max(0, Number(settings.insurance_excess) || 0),
        extras: catalog.extras,
        areas,
        paymentMethods: methods,
        holdHours: catalog.holdHours,
        notes: config.policyNotes
      },
      t
    ),
    areas,
    reviews: (reviews as Awaited<ReturnType<typeof getPublishedReviews>>).map((review) => ({
      id: review.id,
      rating: review.rating,
      body: review.text,
      name: review.name,
      date: review.createdAt || null,
      country: review.country || null,
      vehicle: review.vehicleName || null,
      reply: review.reply || null
    })),
    reviewStats,
    googleReviewsUrl: googleReviewUrl(settings),
    uploads,
    demo: false
  };
}
