import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { leadCountryOptions } from "@/lib/leads";
import { getResource, resourceLocales, resourcePreview } from "@/lib/site/content";
import { localizeSitePath } from "@/lib/site/locale-path";
import { siteMetadata, siteOrigin, siteUrl } from "@/lib/site/seo";
import { JsonLd } from "../../_components/content-ui";
import { FinalCta } from "../../_components/final-cta";
import { Check, Container, Eyebrow, SITE_LINKS, SiteLink } from "../../_components/site-ui";
import { LeadForm } from "./lead-form";
import s from "../../site.module.css";
import c from "../../content.module.css";

type Props = { params: Promise<{ slug: string }> };

/** The words the form needs in the browser (the website sends no words with the page, so they go as props). */
const FORM_KEYS = [
  "leadEmail", "leadName", "leadBusiness", "leadCountry", "leadFleet", "leadConsent", "leadButton", "leadSending",
  "leadThanks", "leadThanksNoEmail", "leadLinkNote", "leadRequired", "leadEmailInvalid", "leadTooMany", "leadError",
  "leadPrivacy", "countryOther", "fleet1", "fleet2", "fleet3", "fleet4"
];

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [{ slug }, locale] = await Promise.all([params, getLocale()]);
  const resource = getResource(locale, slug);
  // Here as well as in the page, so a missing resource (or translation) answers 404 before anything is streamed.
  if (!resource) notFound();
  return siteMetadata({ path: `/resources/${slug}`, locale, title: resource.title, description: resource.description, available: resourceLocales(slug) });
}

/**
 * A free resource's page (indexable): what it is, what's inside, a look at the first page, and the short form that
 * gives the download. The form comes first on phones.
 */
export default async function ResourcePage({ params }: Props) {
  const [{ slug }, locale, m] = await Promise.all([params, getLocale(), getTranslations("marketing")]);
  const resource = getResource(locale, slug);
  if (!resource) notFound();
  const words = Object.fromEntries(FORM_KEYS.map((key) => [key, m(key)]));
  const preview = resourcePreview(locale, slug) || resourcePreview("en", slug);
  const url = siteUrl(`/resources/${slug}`, locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DigitalDocument",
    name: resource.title,
    description: resource.description,
    inLanguage: locale,
    url,
    encodingFormat: resource.formats.map((format) => (format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "RouteHQ", url: siteOrigin() }
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${s.dark} ${s.hero} ${s.heroPlain} ${c.articleHero}`}>
        <Container>
          <div className={s.rise}>
            <nav aria-label={m("navResources")} className={c.crumbs}>
              <SiteLink href={SITE_LINKS.resources}>{m("navResources")}</SiteLink>
            </nav>
            <Eyebrow className="mt-6">{m("leadEyebrow")}</Eyebrow>
            <h1 className={c.articleTitle}>{resource.title}</h1>
            <p className={`${s.lede} ${c.articleLede}`}>{resource.description}</p>
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={c.resourceLayout}>
          <div className={c.resourceMain}>
            {resource.html.trim() ? <div className={c.prose} dangerouslySetInnerHTML={{ __html: resource.html }} /> : null}
            {resource.inside.length ? (
              <div className={resource.html.trim() ? "mt-12" : ""}>
                <h2 className={c.sectionTitle}>{m("resourceInside")}</h2>
                <ul className={c.inside}>
                  {resource.inside.map((line) => (
                    <li key={line}>
                      <Check />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {preview ? (
              <div className="mt-12">
                <h2 className={c.sectionTitle}>{m("resourcePreview")}</h2>
                <div aria-hidden="true" className={c.paperStage}>
                  <div className={c.paper} dangerouslySetInnerHTML={{ __html: preview }} />
                </div>
              </div>
            ) : null}
            <div className="mt-12">
              <h2 className={c.sectionTitle}>{m("resourceFormats")}</h2>
              <p className={c.formats}>
                {resource.formats.map((format) => (
                  <span className={c.format} key={format}>
                    {format === "docx" ? m("downloadDocx") : m("downloadPdf")}
                  </span>
                ))}
              </p>
              <p className={c.disclaimer}>{m("disclaimer")}</p>
            </div>
          </div>
          <aside aria-labelledby="gate-title" className={c.resourceAside}>
            <div className={c.gate}>
              <h2 className={c.gateTitle} id="gate-title">
                {m("leadTitle")}
              </h2>
              <p className={c.gateBody}>{m("leadBody")}</p>
              <LeadForm countries={leadCountryOptions(locale)} resource={slug} source={localizeSitePath(`/resources/${slug}`, locale)} words={words} />
            </div>
          </aside>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
