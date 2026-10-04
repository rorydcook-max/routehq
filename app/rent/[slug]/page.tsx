import type { Metadata } from "next";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { businessToday } from "@/lib/business-time";
import { getPublicCatalog } from "@/lib/public-catalog";
import { Catalog } from "./catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const catalog = await getPublicCatalog(slug);
  return { title: catalog ? `${catalog.name} · Book a vehicle` : "Book a vehicle" };
}

function Notice({ title, message }: { title: string; message: string }) {
  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-10">
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

  if (!catalog) return <Notice message="Please check the link, or ask the rental business for a new one." title="Page not found" />;
  if (!catalog.enabled) return <Notice message={`${catalog.name} isn't taking bookings online right now. Please contact them directly.`} title="Online booking is off" />;

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-5 text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
          <BusinessLogoImage
            alt={`${catalog.name} logo`}
            className="max-h-[56px] max-w-[140px] object-contain"
            fallback={<span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-lg font-semibold text-white">{catalog.name.slice(0, 1)}</span>}
            src={catalog.logoUrl}
          />
          <div className="min-w-0">
            <h1 className="text-xl font-semibold">{catalog.name}</h1>
            <p className="text-sm text-[var(--muted)]">{catalog.location || "Vehicle rental"}</p>
          </div>
        </header>

        <Catalog currency={catalog.currency} deposit={catalog.deposit} holdHours={catalog.holdHours} organizationName={catalog.name} slug={slug} today={businessToday()} vehicles={catalog.vehicles} />
      </div>
    </main>
  );
}
