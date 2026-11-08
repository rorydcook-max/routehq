import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { DESTINATIONS, destinationPath } from "@/lib/rove/destinations";
import { findGuide, GUIDES, localizedGuide } from "@/lib/rove/guides";
import { articleLd, roveMetadata, roveOgImage } from "@/lib/rove/seo";
import { roveHref } from "@/lib/rove/paths";
import { roveDate, roveLocale, roveLocaleParams } from "@/lib/rove/static";
import { Breadcrumbs } from "../../_components/breadcrumbs";
import { SourceList } from "../../_components/country-rules";
import { JsonLd } from "../../_components/json-ld";
import s from "../../rove.module.css";

export const dynamicParams = false;

type Props = { params: Promise<{ locale: string; slug: string }> };

// The full address, language included: every guide in every language (lib/rove/guides-i18n; English where one
// isn't translated yet). See [country]/page.tsx for why.
export function generateStaticParams() {
  return roveLocaleParams().flatMap(({ locale }) => GUIDES.map((guide) => ({ locale, slug: guide.slug })));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const found = findGuide(slug);
  if (!found) return {};
  const guide = localizedGuide(found, locale);
  const meta = roveMetadata({ title: `${guide.title} | Rove`, description: guide.description, path: `/guides/${guide.slug}`, locale, section: "guide", ogTitle: guide.title });
  return { ...meta, openGraph: { ...meta.openGraph, type: "article", publishedTime: guide.published, modifiedTime: guide.updated } };
}

export default async function GuidePage({ params }: Props) {
  const { slug } = await params;
  const locale = await roveLocale(params.then((value) => ({ locale: value.locale })));
  const found = findGuide(slug);
  if (!found) notFound();
  const guide = localizedGuide(found, locale);
  const t = await getTranslations("directory");
  const path = `/guides/${guide.slug}`;
  const related = guide.related.map((key) => DESTINATIONS.find((destination) => `${destination.country}/${destination.slug}` === key)).filter(Boolean) as typeof DESTINATIONS;
  const others = GUIDES.filter((other) => other.slug !== guide.slug).map((other) => localizedGuide(other, locale));

  return (
    <div className={s.wrap}>
      <Breadcrumbs
        items={[
          { name: "Rove", path: "/" },
          { name: t("rv.guidesTitle"), path: "/guides" },
          { name: guide.title, path }
        ]}
        label={t("rv.breadcrumbs")}
        locale={locale}
      />
      <JsonLd data={articleLd({ title: guide.title, description: guide.description, path, published: guide.published, updated: guide.updated, image: roveOgImage(guide.title, guide.description), locale })} />
      <header className={s.pageHead}>
        <h1 className={s.pageTitle} style={{ maxWidth: "24ch" }}>
          {guide.title}
        </h1>
        <p className={s.pageLede}>{guide.standfirst}</p>
        <p className={`${s.small} ${s.muted}`} style={{ marginTop: 10 }}>
          {t("rv.updated", { date: roveDate(guide.updated, locale) })}
        </p>
      </header>
      <div className={s.guideGrid} style={{ paddingBottom: 24 }}>
        <article className={s.prose} lang={guide.locale === locale ? undefined : guide.locale}>
          {guide.body.map((block, index) =>
            block.type === "h2" ? (
              <h2 key={index}>{block.text}</h2>
            ) : block.type === "p" ? (
              <p key={index}>{block.text}</p>
            ) : (
              <ul key={index}>
                {block.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )
          )}
          <SourceList checked={roveDate(guide.updated, locale)} sources={guide.sources} />
        </article>
        <aside className={s.aside}>
          {related.length ? (
            <div className={s.asideCard}>
              <p style={{ margin: 0, fontWeight: 700 }}>{t("rv.findVehicles")}</p>
              <ul className={s.list} style={{ paddingInlineStart: 18 }}>
                {related.map((destination) => (
                  <li key={destination.slug}>
                    <a href={destinationPath(destination)}>{t("rv.rentIn", { place: destination.name })}</a>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className={s.asideCard}>
            <p style={{ margin: 0, fontWeight: 700 }}>{t("rv.moreGuides")}</p>
            <ul className={s.list} style={{ paddingInlineStart: 18 }}>
              {others.map((other) => (
                <li key={other.slug}>
                  <a href={roveHref(`/guides/${other.slug}`, locale)} lang={other.locale === locale ? undefined : other.locale}>
                    {other.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}
