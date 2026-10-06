import type { Metadata } from "next";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { getPublicCatalog } from "@/lib/public-catalog";
import { Catalog } from "./catalog";
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

export default async function PublicCatalogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getPublicCatalog(slug);
  const t = await getTranslations("customer");

  if (!catalog) return <Notice message={t("catalogNotFoundMessage")} title={t("catalogNotFoundTitle")} />;
  if (!catalog.enabled) return <Notice message={t("catalogOffMessage", { business: catalog.name })} title={t("catalogOffTitle")} />;

  return (
    <main className="min-h-screen bg-[var(--panel-secondary)] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl space-y-5">
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

        <Catalog currency={catalog.currency} deposit={catalog.deposit} holdHours={catalog.holdHours} organizationName={catalog.name} slug={slug} gapDays={catalog.gapDays} today={catalog.minStart} vehicles={catalog.vehicles} />
      </div>
    </main>
  );
}
