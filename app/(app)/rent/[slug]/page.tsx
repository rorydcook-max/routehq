import type { Metadata } from "next";
import { BrandStyle } from "@/components/brand-style";
import { PublicBrand, PublicShell, publicCard } from "@/components/public-shell";
import { getPublicCatalog } from "@/lib/public-catalog";
import { Catalog } from "./catalog";
import { EmbedHeight } from "./embed-height";
import { getLocale, getTranslations } from "next-intl/server";
import { ratesFrom, visitorCurrency } from "@/lib/visitor-currency";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";
import { renterUrl } from "@/lib/booking-address";
import { permanentRedirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BookingSiteView } from "@/components/booking-site/booking-site-view";
import { BOOKING_TEMPLATES, catalogLayoutFor, lowestPrices, type BookingTemplate } from "@/lib/booking-site";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ template?: string }> }): Promise<Metadata> {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const catalog = await getPublicCatalog(slug);
  const t = await getTranslations("customer");
  // One address for search engines (Rory, 1 Nov 2026): the business's own domain or subdomain when it has one,
  // else rove.rent/<slug>, however the page was reached.
  const canonical = catalog && catalog.enabled ? catalog.canonicalUrl : `${renterUrl()}/${slug}`;
  // A template preview (?template=, from Settings) is never indexed.
  return { title: catalog ? `${catalog.name} · ${t("bookAVehicle")}` : t("bookAVehicle"), alternates: { canonical }, ...(query.template ? { robots: { index: false, follow: false } } : {}) };
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

export default async function PublicCatalogPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; to?: string; vehicle?: string; via?: string; embed?: string; ref?: string; template?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const isoDay = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);
  // A partner's referral link (Partner network): the referring business, checked when the customer books.
  const referrer = /^[0-9a-f-]{36}$/i.test(String(query.ref || "")) ? String(query.ref) : null;
  const catalog = await getPublicCatalog(slug);
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

  // Prices are the business's; beside them, roughly what that is in the renter's own currency.
  const [rates, visitor] = await Promise.all([ratesFrom(catalog.currency), visitorCurrency(await getLocale())]);

  // The booking box on the business's own website (embed.js): just the booking, sized to fit, on a clear background.
  const embedded = query.embed === "1";
  if (embedded) {
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
          <Catalog
            currency={catalog.currency}
            rates={rates}
            visitorCurrency={visitor}
            offer={catalog.offer}
            deposit={catalog.deposit}
            holdHours={catalog.holdHours}
            organizationName={catalog.name}
            slug={slug}
            gapDays={catalog.gapDays}
            today={catalog.minStart}
            vehicles={catalog.vehicles}
            seasons={catalog.seasons}
            extras={catalog.extras}
            initialStart={isoDay(query.from)}
            initialEnd={isoDay(query.to)}
            initialVehicleId={query.vehicle ? String(query.vehicle).slice(0, 60) : null}
            source={embedded ? "website" : query.via === "directory" ? "directory" : null}
            referrer={referrer}
            embedded={embedded}
          />
        </div>
      </main>
    );
  }

  // The page's template (Settings > Booking page). ?template= shows another one before choosing it (the Preview link).
  const previewTemplate = BOOKING_TEMPLATES.includes(query.template as BookingTemplate) ? (query.template as BookingTemplate) : null;
  const site = previewTemplate ? { ...catalog.site, template: previewTemplate } : catalog.site;
  if (site.template !== "standard") {
    const { fromMonthly, fromDaily } = lowestPrices(catalog.vehicles);
    return (
      <>
        <BrandStyle colour={catalog.brandColour} />
        <BookingSiteView
          business={{ name: catalog.name, logoUrl: catalog.logoUrl, location: catalog.location, address: catalog.address, currency: catalog.currency, contacts: catalog.contacts }}
          fromDaily={fromDaily}
          fromMonthly={fromMonthly}
          heroUrl={catalog.heroUrl || catalog.vehicles.find((vehicle) => vehicle.photoUrl)?.photoUrl || null}
          site={site}
          vehicleCount={catalog.vehicles.length}
        >
          <Catalog
            currency={catalog.currency}
            rates={rates}
            visitorCurrency={visitor}
            offer={catalog.offer}
            deposit={catalog.deposit}
            holdHours={catalog.holdHours}
            organizationName={catalog.name}
            slug={slug}
            gapDays={catalog.gapDays}
            today={catalog.minStart}
            vehicles={catalog.vehicles}
            seasons={catalog.seasons}
            extras={catalog.extras}
            initialStart={isoDay(query.from)}
            initialEnd={isoDay(query.to)}
            initialVehicleId={query.vehicle ? String(query.vehicle).slice(0, 60) : null}
            source={query.via === "directory" ? "directory" : null}
            referrer={referrer}
            layout={catalogLayoutFor(site.template)}
            monthlyFocus={site.template === "monthly"}
          />
        </BookingSiteView>
      </>
    );
  }

  return (
    // The business sits in the shared header row (logo and name left, language right), not in a card of its own.
    <PublicShell brand={<PublicBrand detail={catalog.location || t("vehicleRental")} logoUrl={catalog.logoUrl} name={catalog.name} />} width="wide">
      <BrandStyle colour={catalog.brandColour} />
      <div className="space-y-5">
        <h1 className="sr-only">{catalog.name}</h1>
        <Catalog
          currency={catalog.currency}
          rates={rates}
          visitorCurrency={visitor}
          offer={catalog.offer}
          deposit={catalog.deposit}
          holdHours={catalog.holdHours}
          organizationName={catalog.name}
          slug={slug}
          gapDays={catalog.gapDays}
          today={catalog.minStart}
          vehicles={catalog.vehicles}
          seasons={catalog.seasons}
          extras={catalog.extras}
          initialStart={isoDay(query.from)}
          initialEnd={isoDay(query.to)}
          initialVehicleId={query.vehicle ? String(query.vehicle).slice(0, 60) : null}
          source={query.via === "directory" ? "directory" : null}
          referrer={referrer}
        />
      </div>
    </PublicShell>
  );
}
