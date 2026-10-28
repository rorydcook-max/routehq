import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { GUIDE_CATEGORIES, listGuides, type GuideCategory } from "@/lib/site/content";
import { siteMetadata } from "@/lib/site/seo";
import { CATEGORY_KEY, GuideCard } from "../_components/content-ui";
import { FinalCta } from "../_components/final-cta";
import { Container, Eyebrow, SITE_LINKS, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";
import c from "../content.module.css";

const categoryPath = (category: GuideCategory | null) => (category ? `/guides/category/${category}` : "/guides");

export async function guidesMetadata(category: GuideCategory | null): Promise<Metadata> {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const title = category ? `${m(CATEGORY_KEY[category])} · ${m("metaGuidesTitle")}` : m("metaGuidesTitle");
  return siteMetadata({ path: categoryPath(category), locale, title, description: m("metaGuidesDescription") });
}

/**
 * The guides: a dark hero with the topics as links (/guides/category/<topic>, a real page per topic for search),
 * then the guides as cards, newest first. A language with no guides yet shows the English ones, saying so.
 */
export async function GuidesIndex({ category }: { category: GuideCategory | null }) {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  let guides = listGuides(locale);
  const fallback = !guides.length && locale !== "en";
  if (fallback) guides = listGuides("en");
  const shown = category ? guides.filter((guide) => guide.category === category) : guides;
  const say = m as unknown as (key: string, values?: Record<string, string | number>) => string;
  const filters: Array<{ key: GuideCategory | null; label: string }> = [{ key: null, label: m("guidesAll") }, ...GUIDE_CATEGORIES.map((key) => ({ key, label: m(CATEGORY_KEY[key]) }))];

  return (
    <>
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{category ? m("guidesTitle") : m("guidesEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{category ? m(CATEGORY_KEY[category]) : m("guidesTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("guidesBody")}</p>
          </div>
          <nav aria-label={m("guidesFilter")} className={c.filters}>
            {filters.map((filter) => (
              <SiteLink aria-current={filter.key === category ? "page" : undefined} className={`${c.filter} ${filter.key === category ? c.filterOn : ""}`} href={categoryPath(filter.key)} key={filter.key || "all"}>
                {filter.label}
              </SiteLink>
            ))}
          </nav>
        </Container>
      </section>

      <section className={s.section}>
        <Container>
          {fallback ? <p className={c.fallback}>{m("guidesFallback")}</p> : null}
          {shown.length ? (
            <div className={c.grid}>
              {shown.map((guide) => (
                <GuideCard guide={guide} key={guide.slug} linkLocale={fallback ? "en" : undefined} locale={fallback ? "en" : locale} m={say} />
              ))}
            </div>
          ) : (
            <div className={c.empty}>
              <p>{m("guidesEmpty")}</p>
              {category ? (
                <SiteLink className={`${s.link} mt-2`} href={SITE_LINKS.guides}>
                  {m("guidesAll")}
                </SiteLink>
              ) : null}
            </div>
          )}
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
