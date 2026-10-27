import type { Metadata } from "next";
import { BrandStyle } from "@/components/brand-style";
import { PublicBrand, PublicShell, publicCard } from "@/components/public-shell";
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
    <PublicShell width="narrow">
      <section className={`${publicCard} text-center`}>
        <h1 className="text-2xl font-semibold text-[var(--foreground)]">{title}</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--muted)]">{message}</p>
      </section>
    </PublicShell>
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
    // The business sits in the shared header row (logo and name left, language right), not in a card of its own.
    <PublicShell brand={<PublicBrand detail={catalog.location || t("vehicleRental")} logoUrl={catalog.logoUrl} name={catalog.name} />} width="wide">
      <BrandStyle colour={catalog.brandColour} />
      <div className="space-y-5">
        <h1 className="sr-only">{catalog.name}</h1>
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
    </PublicShell>
  );
}
