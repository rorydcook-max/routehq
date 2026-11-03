import { notFound } from "next/navigation";
import { GUIDE_CATEGORIES, type GuideCategory } from "@/lib/site/content";
import { siteLocale } from "@/lib/site/static-page";
import { GuidesIndex, guidesMetadata } from "../../guides-index";

type Props = { params: Promise<{ locale: string; category: string }> };

const topic = (value: string) => ((GUIDE_CATEGORIES as readonly string[]).includes(value) ? (value as GuideCategory) : null);

// Every topic in every language, drawn at build time; there are no others.
export const dynamicParams = false;
export function generateStaticParams() {
  return GUIDE_CATEGORIES.map((category) => ({ category }));
}

export async function generateMetadata({ params }: Props) {
  await siteLocale(params);
  const category = topic((await params).category);
  if (!category) notFound();
  return guidesMetadata(category);
}

/** /guides/category/<topic>: the guides on one topic, a page of its own so search engines can list it. */
export default async function GuidesCategoryPage({ params }: Props) {
  await siteLocale(params);
  const category = topic((await params).category);
  if (!category) notFound();
  return <GuidesIndex category={category} />;
}
