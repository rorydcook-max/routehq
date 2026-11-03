import { siteLocale, type SiteParams } from "@/lib/site/static-page";
import { GuidesIndex, guidesMetadata } from "./guides-index";

export async function generateMetadata({ params }: SiteParams) {
  await siteLocale(params);
  return guidesMetadata(null);
}

/** /guides (and /th/guides …): every guide in the visitor's language. */
export default async function GuidesPage({ params }: SiteParams) {
  await siteLocale(params);
  return <GuidesIndex category={null} />;
}
