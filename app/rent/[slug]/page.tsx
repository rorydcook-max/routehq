import type { Metadata } from "next";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { BrandStyle } from "@/components/brand-style";
import { getPublicCatalog } from "@/lib/public-catalog";
import { Catalog } from "./catalog";
import { EmbedHeight } from "./embed-height";
import { getTranslations } from "next-intl/server";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getPublicCatalog(slug);
  const t = await getTranslations("customer");
  return { title: catalog ? `${catalog.name} · ${t("bookAVehicle")}` : t("bookAVehicle") };
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-[var(--panel-secondary)] px-4 py-10">
      <div className="mx-auto mb-3 flex max-w-xl justify-end">
        <CustomerLanguagePicker />
      </div>
      <section className="mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-sm">
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{message}</p>
      </section>
    </main>
  );
}

export default async function PublicCatalogPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ from?: string; to?: string; vehicle?: string; via?: string; embed?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const isoDay = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);
  const catalog = await getPublicCatalog(slug);
  const t = await getTranslations("customer");

  if (!catalog) return <Notice message={t("catalogNotFoundMessage")} title={t("catalogNotFoundTitle")} />;
  if (!catalog.enabled) return <Notice message={t("catalogOffMessage", { business: catalog.name })} title={t("catalogOffTitle")} />;

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
            embedded={embedded}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--panel-secondary)] px-4 py-5 text-[var(--foreground)]">
      <BrandStyle colour={catalog.brandColour} />
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex justify-end">
          <CustomerLanguagePicker />
        </div>
        <header className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <BusinessLogoImage
            alt={`${catalog.name} logo`}
            className="max-h-[56px] max-w-[140px] object-contain"
            fallback={<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-semibold text-white">{catalog.name.slice(0, 1)}</span>}
            src={catalog.logoUrl}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{catalog.name}</h1>
            <p className="text-sm text-[var(--muted)]">{catalog.location || t("vehicleRental")}</p>
          </div>
        </header>

        <Catalog
          currency={catalog.currency}
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
        />
      </div>
    </main>
  );
}
