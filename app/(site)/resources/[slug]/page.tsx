import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CONTRACT_BUILDER_PAGES, CONTRACT_BUILDER_SLUG, isContractBuilder } from "@/lib/contract-builder/fields";
import { LEAD_COUNTRIES, leadCountryOptions } from "@/lib/leads";
import { visitorCountry } from "@/lib/site-currency";
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

/** The contract builder's words: its folded fields, the ready panel and what RoveHQ does with agreements. */
const BUILDER_KEYS = [
  "cbTitle", "cbBody", "cbGroupBusiness", "cbGroupVehicle", "cbGroupPrices", "cbGroupRules", "cbBlankNote",
  "cb_logo", "cb_business_reg_no", "cb_business_phone", "cb_business_email", "cb_business_address",
  "cb_vehicle_type", "cb_vehicle_type_car", "cb_vehicle_type_motorbike", "cb_vehicle_make_model", "cb_vehicle_year", "cb_vehicle_plate",
  "cb_vehicle_colour", "cb_area_of_use", "cb_area_of_use_hint", "cb_currency", "cb_rate", "cb_rate_period", "cb_rate_period_day",
  "cb_rate_period_week", "cb_rate_period_month", "cb_deposit", "cb_deposit_return_days", "cb_delivery_fee", "cb_payment_methods",
  "cb_payment_methods_hint", "cb_insurance_level", "cb_insurance_level_compulsory", "cb_insurance_level_third_party",
  "cb_insurance_level_comprehensive", "cb_insurance_excess", "cb_fuel_policy", "cb_fuel_policy_same", "cb_fuel_policy_full",
  "cb_fuel_service_fee", "cb_mileage_limit", "cb_mileage_period", "cb_mileage_period_day", "cb_mileage_period_month",
  "cb_excess_km_fee", "cb_late_hour_fee", "cb_late_grace_minutes", "cb_late_full_day_hours", "cb_cancel_free_hours",
  "cb_cancel_fee_percent", "cb_early_return", "cb_early_return_none", "cb_early_return_prorata", "cb_early_return_fee",
  "cb_notice_days", "cb_cleaning_fee", "cb_smoking", "cb_smoking_no", "cb_smoking_yes", "cb_smoking_fee", "cb_pets", "cb_pets_no",
  "cb_pets_fee", "cb_pet_fee", "cb_loss_of_use_fee", "cb_emergency_repair_limit", "cb_fine_admin_fee", "cb_special_terms",
  "contractReadyTitle", "contractLinkNotice", "contractLinkNoticeNoEmail", "contractPitchTitle", "contractPitchBody",
  "contractPitch1", "contractPitch2", "contractPitch3", "contractPitch4", "contractPitchCta"
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
  const builder = isContractBuilder(slug);
  const words = Object.fromEntries((builder ? [...FORM_KEYS, ...BUILDER_KEYS] : FORM_KEYS).map((key) => [key, m(key)]));
  // A country or city page starts on its own country; the main page on the visitor's.
  const here = builder ? CONTRACT_BUILDER_PAGES[slug] || (await visitorCountry()) : "";
  const initialCountry = (LEAD_COUNTRIES as readonly string[]).includes(here) ? here : "";
  const preview =
    resourcePreview(locale, slug) ||
    resourcePreview("en", slug) ||
    (builder ? resourcePreview(locale, CONTRACT_BUILDER_SLUG) || resourcePreview("en", CONTRACT_BUILDER_SLUG) : null);
  const url = siteUrl(`/resources/${slug}`, locale);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "DigitalDocument",
    name: resource.title,
    description: resource.description,
    inLanguage: locale,
    url,
    encodingFormat: resource.formats.map((format) => (format === "pdf" ? "application/pdf" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
    isAccessibleForFree: true,
    publisher: { "@type": "Organization", name: "RoveHQ", url: siteOrigin() }
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
                    {format === "docx" ? m("downloadDocx") : format === "xlsx" ? m("downloadXlsx") : m("downloadPdf")}
                  </span>
                ))}
              </p>
              <p className={c.disclaimer}>{m("disclaimer")}</p>
            </div>
          </div>
          <aside aria-labelledby="gate-title" className={c.resourceAside}>
            <div className={c.gate}>
              <h2 className={c.gateTitle} id="gate-title">
                {builder ? m("contractGateTitle") : m("leadTitle")}
              </h2>
              <p className={c.gateBody}>{builder ? m("contractGateBody") : m("leadBody")}</p>
              <LeadForm builder={builder} countries={leadCountryOptions(locale)} initialCountry={initialCountry} resource={slug} source={localizeSitePath(`/resources/${slug}`, locale)} words={words} />
            </div>
          </aside>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
