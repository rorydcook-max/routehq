import { getLocale, getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { CookieChoicesLink } from "@/components/cookie-choices-link";
import { FooterLanguage } from "./site-language";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";
import l from "../legal/legal.module.css";

/** The website's footer: where to go next, the language (the same choice the sign-in pages keep), and the name. */
export async function SiteFooter() {
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  const columns = [
    {
      title: m("footerProduct"),
      links: [
        { href: SITE_LINKS.features, label: m("navFeatures") },
        // RoveHQ for each kind of rental business (lib/site/segments.ts).
        { href: SITE_LINKS.carRental, label: m("navCarRental") },
        { href: SITE_LINKS.scooterRental, label: m("navScooterRental") },
        { href: SITE_LINKS.motorcycleRental, label: m("navMotorcycleRental") },
        // Booking page templates and example pages.
        { href: "/booking-pages", label: m("navBookingPages") },
        { href: SITE_LINKS.pricing, label: m("navPricing") },
        { href: SITE_LINKS.switch, label: m("navSwitch") },
        { href: SITE_LINKS.contact, label: m("navContact") }
      ]
    },
    {
      title: m("footerLearn"),
      links: [
        { href: SITE_LINKS.guides, label: m("navGuides") },
        { href: SITE_LINKS.resources, label: m("navResources") },
        { href: SITE_LINKS.docs, label: m("docsEyebrow") },
        { href: SITE_LINKS.faq, label: m("navFaq") }
      ]
    },
    {
      title: m("footerAccount"),
      links: [
        { href: SITE_LINKS.signIn, label: m("navSignIn") },
        { href: SITE_LINKS.signUp, label: m("navStart") }
      ]
    }
  ];
  const legal = [
    { href: "/legal/privacy", label: m("legalPrivacy") },
    { href: "/legal/terms", label: m("legalTerms") },
    { href: "/legal/dpa", label: m("legalDpa") },
    { href: "/legal/subprocessors", label: m("legalSubprocessors") },
    { href: "/legal/cookies", label: m("legalCookies") }
  ];
  return (
    <footer className={s.footer}>
      <Container>
        <div className={s.footerGrid}>
          <div className={s.footerBrand}>
            <span className="inline-block" dir="ltr">
              <RouteHqLogo className="[&_svg]:h-8 [&_svg]:w-8" showDescriptor={false} />
            </span>
            <p>{m("footerTagline")}</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className={s.footerTitle}>{column.title}</h2>
              <ul className={s.footerList}>
                {column.links.map((link) => (
                  <li key={link.href}>
                    <SiteLink className={s.footerLink} href={link.href}>
                      {link.label}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        {/* Legal pages and the cookie choice: on every page, one quiet line (GDPR / UK GDPR / PDPA, 3 Nov 2026). */}
        <nav aria-label={m("footerLegal")} className={l.legal}>
          {legal.map((link) => (
            <SiteLink className={s.footerLink} href={link.href} key={link.href}>
              {link.label}
            </SiteLink>
          ))}
          <CookieChoicesLink className={s.footerLink} label={m("legalCookieChoices")} />
        </nav>
        <div className={s.footerBottom}>
          <p>{m("footerCopyright", { year: String(new Date().getFullYear()) })}</p>
          <div className="[&_label]:min-h-11">
            <span className="sr-only">{m("footerLanguage")}</span>
            <FooterLanguage locale={locale} />
          </div>
        </div>
      </Container>
    </footer>
  );
}
