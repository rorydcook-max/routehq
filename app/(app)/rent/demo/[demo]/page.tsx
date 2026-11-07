import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { BrandStyle } from "@/components/brand-style";
import { BookingSiteView } from "@/components/booking-site/booking-site-view";
import { catalogLayoutFor, lowestPrices } from "@/lib/booking-site";
import { bookingDemo } from "@/lib/booking-site-demos";
import { ratesFrom, visitorCurrency } from "@/lib/visitor-currency";
import { Catalog } from "../../[slug]/catalog";

/**
 * An example booking page (rovehq.io/booking-pages links here): a made-up business from lib/booking-site-demos.ts,
 * drawn with the same template and booking parts as a real one. Labelled as a demo, never indexed, and booking is
 * turned off. Nothing is read from or written to the database.
 */

export async function generateMetadata({ params }: { params: Promise<{ demo: string }> }): Promise<Metadata> {
  const demo = bookingDemo((await params).demo);
  return { title: demo ? `${demo.name} (example)` : "Example", robots: { index: false, follow: false } };
}

export default async function BookingDemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const demo = bookingDemo((await params).demo);
  if (!demo) notFound();
  const [rates, visitor] = await Promise.all([ratesFrom(demo.currency), visitorCurrency(await getLocale())]);
  const { fromMonthly, fromDaily } = lowestPrices(demo.vehicles);
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <BrandStyle colour={demo.brandColour} />
      <BookingSiteView
        business={{ name: demo.name, logoUrl: null, location: demo.location, address: "", currency: demo.currency, contacts: { whatsapp: "", line: "", instagram: "", facebook: "" } }}
        demo
        fromDaily={fromDaily}
        fromMonthly={fromMonthly}
        heroUrl={demo.heroUrl}
        site={demo.site}
        vehicleCount={demo.vehicles.length}
      >
        <Catalog
          currency={demo.currency}
          deposit={0}
          demo
          extras={[]}
          gapDays={0}
          holdHours={24}
          layout={catalogLayoutFor(demo.site.template)}
          monthlyFocus={demo.site.template === "monthly"}
          offer={demo.site.template === "monthly" ? "monthly" : "both_dates"}
          organizationName={demo.name}
          rates={rates}
          seasons={[]}
          slug={`demo-${demo.id}`}
          source={null}
          today={today}
          vehicles={demo.vehicles}
          visitorCurrency={visitor}
        />
      </BookingSiteView>
    </>
  );
}
