import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { GUIDES } from "@/lib/rove/guides";
import { itemListLd, roveMetadata } from "@/lib/rove/seo";
import { roveLocale } from "@/lib/rove/static";
import { Breadcrumbs } from "../_components/breadcrumbs";
import { JsonLd } from "../_components/json-ld";
import s from "../rove.module.css";

export const dynamic = "force-static";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await roveLocale(params);
  const t = await getTranslations("directory");
  return roveMetadata({ title: t("rv.guidesMetaTitle"), description: t("rv.guidesLede"), path: "/guides", locale, section: "guides", ogTitle: t("rv.guidesTitle") });
}

export default async function GuidesPage({ params }: Props) {
  const locale = await roveLocale(params);
  // Written in English only so far: other languages' addresses are sent to this one (proxy.ts).
  if (locale !== "en") notFound();
  const t = await getTranslations("directory");
  return (
    <div className={s.wrap}>
      <Breadcrumbs
        items={[
          { name: "Rove", path: "/" },
          { name: t("rv.guidesTitle"), path: "/guides" }
        ]}
        label={t("rv.breadcrumbs")}
        locale={locale}
      />
      <JsonLd data={itemListLd(t("rv.guidesTitle"), GUIDES.map((guide) => ({ name: guide.title, path: `/guides/${guide.slug}` })), locale)} />
      <header className={s.pageHead}>
        <h1 className={s.pageTitle}>{t("rv.guidesTitle")}</h1>
        <p className={s.pageLede}>{t("rv.guidesLede")}</p>
      </header>
      <div className={s.cardGrid} style={{ paddingBottom: 32 }}>
        {GUIDES.map((guide) => (
          <a className={s.guideCard} href={`/guides/${guide.slug}`} key={guide.slug}>
            <span className={s.h3}>{guide.title}</span>
            <span className={s.muted} style={{ display: "block", marginTop: 8 }}>
              {guide.standfirst}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
