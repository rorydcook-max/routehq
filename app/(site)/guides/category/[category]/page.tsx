import { notFound } from "next/navigation";
import { GUIDE_CATEGORIES, type GuideCategory } from "@/lib/site/content";
import { GuidesIndex, guidesMetadata } from "../../guides-index";

type Props = { params: Promise<{ category: string }> };

const topic = (value: string) => ((GUIDE_CATEGORIES as readonly string[]).includes(value) ? (value as GuideCategory) : null);

export async function generateMetadata({ params }: Props) {
  const category = topic((await params).category);
  if (!category) notFound();
  return guidesMetadata(category);
}

/** /guides/category/<topic>: the guides on one topic, a page of its own so search engines can list it. */
export default async function GuidesCategoryPage({ params }: Props) {
  const category = topic((await params).category);
  if (!category) notFound();
  return <GuidesIndex category={category} />;
}
