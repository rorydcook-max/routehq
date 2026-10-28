import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { listResources } from "@/lib/site/content";
import { siteMetadata } from "@/lib/site/seo";
import { FinalCta } from "../_components/final-cta";
import { Arrow, Container, Eyebrow, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";
import c from "../content.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/resources", locale, title: m("metaResourcesTitle"), description: m("metaResourcesDescription") });
}

/** /resources: the free templates and tools, each with its own page (where the download is). */
export default async function ResourcesPage() {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  let resources = listResources(locale);
  const fallback = !resources.length && locale !== "en";
  if (fallback) resources = listResources("en");

  return (
    <>
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("resourcesEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("resourcesTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("resourcesBody")}</p>
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container>
          {fallback ? <p className={c.fallback}>{m("guidesFallback")}</p> : null}
          {resources.length ? (
            <div className={c.grid}>
              {resources.map((resource) => (
                <article className={c.card} key={resource.slug}>
                  {resource.fileLabel ? <p className={c.tag}>{resource.fileLabel}</p> : null}
                  <h2 className={c.cardTitle}>
                    <SiteLink href={`/resources/${resource.slug}`} locale={fallback ? "en" : undefined}>
                      {resource.title}
                    </SiteLink>
                  </h2>
                  <p className={c.cardBody}>{resource.description}</p>
                  <p className={c.cardMeta}>
                    <span>{resource.formats.map((format) => format.toUpperCase()).join(" · ")}</span>
                  </p>
                  <span aria-hidden="true" className={s.link}>
                    {m("resourceOpen")} <Arrow />
                  </span>
                </article>
              ))}
            </div>
          ) : (
            <p className={c.empty}>{m("resourcesEmpty")}</p>
          )}
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
