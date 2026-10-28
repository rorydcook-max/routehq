import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { siteMetadata } from "@/lib/site/seo";
import { supportContacts } from "@/lib/support";
import { FinalCta } from "../_components/final-cta";
import { Arrow, Container, Eyebrow, SITE_LINKS, SiteLink } from "../_components/site-ui";
import { ContactForm } from "./contact-form";
import s from "../site.module.css";

/** The words the form needs in the browser (the website sends the app's words to no page, so they go as props). */
const FORM_KEYS = [
  "contactName",
  "contactEmail",
  "contactPhone",
  "contactBusiness",
  "contactFleet",
  "fleet1",
  "fleet2",
  "fleet3",
  "fleet4",
  "contactTopic",
  "topicGeneral",
  "topicImport",
  "topicPricing",
  "topicPartner",
  "topicOther",
  "contactMessage",
  "contactSend",
  "contactSending",
  "contactThanks",
  "contactError",
  "contactRequired",
  "contactEmailInvalid",
  "contactTooMany"
];

export async function generateMetadata(): Promise<Metadata> {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  return siteMetadata({ path: "/contact", locale, title: m("metaContactTitle"), description: m("metaContactDescription") });
}

export default async function ContactPage() {
  const m = await getTranslations("marketing");
  const words = Object.fromEntries(FORM_KEYS.map((key) => [key, m(key)]));
  const contacts = supportContacts();
  const rows = [
    contacts.line && contacts.lineUrl ? { label: m("contactLine"), value: contacts.line, href: contacts.lineUrl } : null,
    contacts.whatsapp && contacts.whatsappUrl ? { label: m("contactWhatsapp"), value: contacts.whatsapp, href: contacts.whatsappUrl } : null,
    contacts.email ? { label: m("contactEmailUs"), value: contacts.email, href: `mailto:${contacts.email}` } : null
  ].filter((row): row is { label: string; value: string; href: string } => Boolean(row));

  return (
    <>
      <section className={`${s.dark} ${s.hero} ${s.heroPlain}`}>
        <Container>
          <div className={s.rise}>
            <Eyebrow>{m("contactEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m("contactTitle")}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("contactBody")}</p>
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={s.contactGrid}>
          <div className={s.contactMain}>
            <ContactForm words={words} />
          </div>
          <aside aria-labelledby="contact-other" className={s.contactAside}>
            <h2 className={s.h3} id="contact-other">
              {m("contactOtherTitle")}
            </h2>
            {rows.length ? (
              <ul className={s.contactRows}>
                {rows.map((row) => (
                  <li key={row.label}>
                    <span className={s.contactRowLabel}>{row.label}</span>
                    <a className={s.contactRowValue} dir="ltr" href={row.href} rel={row.href.startsWith("http") ? "noopener noreferrer" : undefined} target={row.href.startsWith("http") ? "_blank" : undefined}>
                      {row.value}
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`${s.body} mt-4`}>{m("contactFormOnly")}</p>
            )}
            <p className={`${s.body} mt-8`}>{m("contactCustomers")}</p>
            <SiteLink className={`${s.link} mt-2`} href={SITE_LINKS.faq}>
              {m("contactFaqLink")} <Arrow />
            </SiteLink>
          </aside>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
