import type { Metadata, Route } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { BrandStyle } from "@/components/brand-style";
import { SitePage } from "@/components/site/site-page";
import { demoSiteData, siteDemo } from "@/lib/sites/demos";
import { ratesFrom, visitorCurrency } from "@/lib/visitor-currency";

/** The examples from before the website builder, sent to the nearest new one. */
const RETIRED: Record<string, string> = { "coastal-scooters": "redline", "harbor-car-hire": "saltwater", "long-stay-wheels": "northpoint", "island-fleet": "northpoint" };

/**
 * An example website (rovehq.io/booking-pages links here): a made-up business from lib/sites/demos.ts, drawn with the
 * same components as a real one. Labelled as a demo, never indexed; booking and the contact form are off. Nothing is
 * read from or written to the database.
 */

export async function generateMetadata({ params }: { params: Promise<{ demo: string }> }): Promise<Metadata> {
  const demo = siteDemo((await params).demo);
  return { title: demo ? `${demo.name} (example)` : "Example", robots: { index: false, follow: false } };
}

export default async function BookingDemoPage({ params }: { params: Promise<{ demo: string }> }) {
  const id = (await params).demo;
  if (RETIRED[id]) permanentRedirect(`/rent/demo/${RETIRED[id]}` as Route);
  const demo = siteDemo(id);
  if (!demo) notFound();
  const [rates, visitor, t] = await Promise.all([ratesFrom(demo.currency), visitorCurrency(await getLocale()), getTranslations("bsite")]);
  const data = demoSiteData(demo, { t: t as any, rates, visitorCurrency: visitor, today: new Date().toISOString().slice(0, 10) });
  return (
    <>
      <BrandStyle colour={demo.brandColour} />
      <SitePage config={demo.config} data={data} />
    </>
  );
}
