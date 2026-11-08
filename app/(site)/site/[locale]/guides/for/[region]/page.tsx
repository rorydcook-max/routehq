import { notFound } from "next/navigation";
import { siteLocale, siteLocaleParams } from "@/lib/site/static-page";
import { isSiteRegion, SITE_REGIONS } from "@/lib/site/region";
import { GuidesIndex, guidesMetadata } from "../../guides-index";

type Props = { params: Promise<{ locale: string; region: string }> };

// One copy per region (lib/site/region.ts), drawn ahead for every language; the canonical address stays /guides.
// The language is listed with each (as guides/[slug] does): given the parent's params, Next 16.4 didn't draw them.
export function generateStaticParams() {
  return siteLocaleParams().flatMap(({ locale }) => SITE_REGIONS.map((region) => ({ locale, region })));
}

export async function generateMetadata({ params }: Props) {
  await siteLocale(params);
  return guidesMetadata(null);
}

/** /guides for a visitor from a region: proxy.ts sends them here (lib/site/internal-path.ts), guides about their region first. */
export default async function RegionalGuidesPage({ params }: Props) {
  await siteLocale(params);
  const { region } = await params;
  if (!isSiteRegion(region)) notFound();
  return <GuidesIndex category={null} region={region} />;
}
