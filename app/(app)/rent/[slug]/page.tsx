import type { Metadata } from "next";
import { BrandStyle } from "@/components/brand-style";
import { PublicShell, publicCard } from "@/components/public-shell";
import { getPublicCatalog } from "@/lib/public-catalog";
import { Catalog } from "./catalog";
import { EmbedHeight } from "./embed-height";
import { getLocale, getTranslations } from "next-intl/server";
import { ratesFrom, visitorCurrency } from "@/lib/visitor-currency";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";
import { renterUrl } from "@/lib/booking-address";
import { permanentRedirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth/roles";
import { SitePage } from "@/components/site/site-page";
import { PageCountry } from "@/components/page-country";
import { loadSiteData, loadSiteRow, uploadUrls } from "@/lib/sites/data";
import { ldScript, siteJsonLd } from "@/lib/sites/seo";
import { fleetNoun } from "@/lib/sites/format";
import type { SiteConfig } from "@/lib/sites/config";

export const dynamic = "force-dynamic";

type Query = { from?: string; to?: string; vehicle?: string; via?: string; embed?: string; ref?: string; draft?: string; edit?: string };

/** The signed-in owner of this business: they see the draft (and can preview while the page is off). */
async function isOwnerOf(organizationId: string) {
  const membership = await getCurrentMembership().catch(() => null);
  return Boolean(membership && membership.role === "owner" && membership.organizationId === organizationId);
}

/** The site's words for search engines: the owner's headline and line under it, else the defaults. */
async function siteMeta(config: SiteConfig, input: { name: string; place: string; kinds: string[] }) {
  const t = await getTranslations("bsite");
  const values = { business: input.name, place: input.place, noun: fleetNoun(input.kinds) };
  const np = input.place ? "" : "_np";
  const headline = config.text["hero.headline"] || t(`hd_${config.template}${np}`, values);
  const description = config.text["hero.subline"] || config.text["about.body"]?.slice(0, 200) || t(`hs_${config.template}`, values);
  return { title: headline.toLowerCase().includes(input.name.toLowerCase()) ? headline : `${input.name} · ${headline}`, description };
}

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const catalog = await getPublicCatalog(slug);
  const t = await getTranslations("customer");
  // One address for search engines (Rory, 1 Nov 2026): the business's own domain or subdomain when it has one,
  // else rove.rent/<slug>, however the page was reached.
  const canonical = catalog && catalog.enabled ? catalog.canonicalUrl : `${renterUrl()}/${slug}`;
  // The owner's draft preview is never indexed.
  const robots = query.draft || query.edit ? { robots: { index: false, follow: false } } : {};
  if (!catalog || !catalog.enabled) return { title: catalog ? `${catalog.name} · ${t("bookAVehicle")}` : t("bookAVehicle"), alternates: { canonical }, ...robots };
  const kinds = catalog.vehicles.map((vehicle) => vehicle.kind);
  const row = await loadSiteRow(catalog.organizationId, catalog.settings, kinds);
  const place = String(catalog.settings?.main_location?.town || "").trim() || catalog.location.split(",")[0].trim();
  const { title, description } = await siteMeta(row.published, { name: catalog.name, place, kinds });
  // The share picture: their own hero photo, else a vehicle photo, else their logo.
  const uploads = await uploadUrls(row.published);
  const hero = row.published.images.hero;
  const image =
    (hero?.kind === "upload" && uploads[hero.path]) ||
    (hero?.kind === "vehicle" && catalog.vehicles.find((vehicle) => vehicle.id === hero.vehicleId)?.photoUrl) ||
    catalog.vehicles.find((vehicle) => vehicle.photoUrl)?.photoUrl ||
    catalog.logoUrl ||
    null;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical, siteName: catalog.name, ...(image && /^https?:\/\//.test(image) ? { images: [{ url: image }] } : {}) },
    twitter: { card: image ? "summary_large_image" : "summary", title, description },
    ...robots
  };
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <PublicShell width="narrow">
      <section className={`${publicCard} text-center`}>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{message}</p>
      </section>
    </PublicShell>
  );
}

/**
 * A business's booking website (Rory, 7 Nov 2026): served here for rove.rent/<slug>, its subdomain and its own
 * domain (proxy.ts rewrites those to this page). The published site for everyone; the draft, with click-to-edit
 * text, for the signed-in owner inside the Booking page tool (?draft=1&edit=1), even while the page is switched off.
 * ?embed=1 is the booking box on their own website: just the booking, sized to fit.
 */
export default async function PublicCatalogPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<Query> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const isoDay = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);
  // A partner's referral link (Partner network): the referring business, checked when the customer books.
  const referrer = /^[0-9a-f-]{36}$/i.test(String(query.ref || "")) ? String(query.ref) : null;
  const wantsDraft = query.draft === "1";
  const catalog = await getPublicCatalog(slug, { includeOff: wantsDraft });
  const t = await getTranslations("customer");

  if (!catalog) {
    // A business that changed its address: its old links send people to the new one (Rory, 1 Nov 2026).
    const { data: renamed } = await (createSupabaseAdminClient() as any)
      .from("organizations")
      .select("slug")
      .contains("settings", { previous_slugs: [slug] })
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (renamed?.slug && renamed.slug !== slug) {
      const rest = new URLSearchParams(Object.entries(query).filter(([, value]) => typeof value === "string") as Array<[string, string]>).toString();
      permanentRedirect(`/rent/${renamed.slug}${rest ? `?${rest}` : ""}`);
    }
    return <Notice message={t("catalogNotFoundMessage")} title={t("catalogNotFoundTitle")} />;
  }
  if (!catalog.enabled) return <Notice message={t("catalogOffMessage", { business: catalog.name })} title={t("catalogOffTitle")} />;
  const owner = wantsDraft ? await isOwnerOf(catalog.organizationId) : false;
  if (catalog.pageOff && !owner) return <Notice message={t("catalogOffMessage", { business: catalog.name })} title={t("catalogOffTitle")} />;

  // Prices are the business's; beside them, roughly what that is in the renter's own currency.
  const [rates, visitor] = await Promise.all([ratesFrom(catalog.currency), visitorCurrency(await getLocale())]);
  const catalogProps = {
    currency: catalog.currency,
    deposit: catalog.deposit,
    holdHours: catalog.holdHours,
    gapDays: catalog.gapDays,
    today: catalog.minStart,
    offer: catalog.offer,
    seasons: catalog.seasons,
    extras: catalog.extras,
    rates,
    visitorCurrency: visitor,
    initialStart: isoDay(query.from),
    initialEnd: isoDay(query.to),
    initialVehicleId: query.vehicle ? String(query.vehicle).slice(0, 60) : null,
    source: query.embed === "1" ? "website" : query.via === "directory" ? "directory" : null,
    referrer
  };

  // The booking box on the business's own website (embed.js): just the booking, sized to fit, on a clear background.
  if (query.embed === "1") {
    return (
      <main className="bg-transparent px-1 py-1 text-[var(--foreground)]">
        <style>{"html,body{background:transparent!important}"}</style>
        <BrandStyle colour={catalog.brandColour} />
        <EmbedHeight />
        <div className="mx-auto max-w-4xl space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--muted)]">{t("embedPoweredBy", { business: catalog.name })}</p>
            <CustomerLanguagePicker />
          </div>
          <PageCountry country={catalog.country}>
            <Catalog {...catalogProps} embedded organizationName={catalog.name} slug={slug} vehicles={catalog.vehicles} />
          </PageCountry>
        </div>
      </main>
    );
  }

  const kinds = catalog.vehicles.map((vehicle) => vehicle.kind);
  const row = await loadSiteRow(catalog.organizationId, catalog.settings, kinds);
  const config = owner ? row.draft : row.published;
  const data = await loadSiteData({ catalog, slug, config, catalogProps, t: (await getTranslations("bsite")) as any });
  const meta = await siteMeta(config, { name: data.business.name, place: data.business.place, kinds });
  const ld = owner ? null : siteJsonLd(data, config, { url: catalog.canonicalUrl, description: meta.description, image: null });

  return (
    <>
      <BrandStyle colour={catalog.brandColour} />
      {ld ? <script dangerouslySetInnerHTML={{ __html: ldScript(ld) }} type="application/ld+json" /> : null}
      <PageCountry country={catalog.country}>
        <SitePage config={config} data={data} edit={owner && query.edit === "1"} />
      </PageCountry>
    </>
  );
}
