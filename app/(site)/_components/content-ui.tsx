import { getLocale, getTranslations } from "next-intl/server";
import { getResource, type GuideCategory, type GuideMeta } from "@/lib/site/content";
import { Arrow, SiteLink } from "./site-ui";
import s from "../site.module.css";
import c from "../content.module.css";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** The UI string naming a guide topic. */
export const CATEGORY_KEY: Record<GuideCategory, string> = {
  starting: "categoryStarting",
  legal: "categoryLegal",
  operations: "categoryOperations",
  money: "categoryMoney",
  marketing: "categoryMarketing"
};

/** A content date (YYYY-MM-DD) in the reader's language, e.g. "28 Oct 2026". */
export function contentDate(date: string, locale: string) {
  if (!date) return "";
  const value = new Date(`${date}T00:00:00Z`);
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(value);
  } catch {
    return date;
  }
}

/** The author's initials in a circle (one author for now: Rory, the founder). */
export function Avatar({ name, large = false }: { name: string; large?: boolean }) {
  return (
    <span aria-hidden="true" className={`${c.avatar} ${large ? c.avatarLarge : ""}`}>
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** A guide in a list: topic, title (the whole card is the link), description, reading time and date. */
export function GuideCard({ guide, m, locale, linkLocale }: { guide: GuideMeta; m: Say; locale: string; linkLocale?: string }) {
  return (
    <article className={c.card}>
      <p className={c.tag}>{m(CATEGORY_KEY[guide.category])}</p>
      <h3 className={c.cardTitle}>
        <SiteLink href={`/guides/${guide.slug}`} locale={linkLocale}>
          {guide.title}
        </SiteLink>
      </h3>
      <p className={c.cardBody}>{guide.description}</p>
      <p className={c.cardMeta}>
        <span>{m("readTime", { minutes: guide.readingMinutes })}</span>
        <time dateTime={guide.updated}>{contentDate(guide.updated, locale)}</time>
      </p>
    </article>
  );
}

/**
 * A free resource offered inside an article: its title and one line, and the way to its page. In the reader's
 * language when the resource has been translated, else the English page.
 */
export async function LeadCard({ slug }: { slug: string }) {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const own = getResource(locale, slug);
  const resource = own || getResource("en", slug);
  if (!resource) return null;
  return (
    <aside aria-label={m("leadEyebrow")} className={c.leadCard}>
      <div>
        <p className={c.tag}>{m("leadEyebrow")}</p>
        <p className={c.leadCardTitle}>{resource.title}</p>
        <p className={c.leadCardBody}>{resource.description}</p>
      </div>
      <SiteLink className={`${s.btn} ${s.btnInk} ${c.leadCardCta}`} href={`/resources/${slug}`} locale={own ? undefined : "en"}>
        {m("resourceOpen")} <Arrow />
      </SiteLink>
    </aside>
  );
}

/** JSON-LD in a script tag, with "<" escaped so content can never close the tag. */
export function JsonLd({ data }: { data: unknown }) {
  return <script dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} type="application/ld+json" />;
}
