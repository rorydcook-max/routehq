import { getLocale, getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { MobileMenu } from "./mobile-menu";
import { SiteLanguage } from "./site-language";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The website's header: logo, the few places worth going, sign in and the trial. Sticky, ink, 64px. */
export async function SiteHeader() {
  const [t, m, locale] = await Promise.all([getTranslations("site"), getTranslations("marketing"), getLocale()]);
  const items = [
    { href: SITE_LINKS.features, label: m("navFeatures") },
    { href: SITE_LINKS.pricing, label: m("navPricing") },
    { href: SITE_LINKS.guides, label: m("navGuides") },
    { href: SITE_LINKS.resources, label: m("navResources") },
    { href: SITE_LINKS.faq, label: m("navFaq") },
    { href: SITE_LINKS.contact, label: m("navContact") }
  ];
  const logo = (
    <SiteLink aria-label={t("navHome")} className="inline-flex min-h-11 shrink-0 items-center" href={SITE_LINKS.home}>
      <span className="inline-flex items-center" dir="ltr">
        <RouteHqLogo showDescriptor={false} tone="dark" />
      </span>
    </SiteLink>
  );
  return (
    <header className={s.header}>
      <Container className={s.headerRow}>
        {logo}
        <nav aria-label={t("navLabel")} className={s.nav}>
          {items.map((item) => (
            <SiteLink className={s.navLink} href={item.href} key={item.href}>
              {item.label}
            </SiteLink>
          ))}
        </nav>
        <div className={s.headerActions}>
          <SiteLanguage label={m("footerLanguage")} locale={locale} variant="compact" />
          <SiteLink className={s.navLink} href={SITE_LINKS.signIn}>
            {m("navSignIn")}
          </SiteLink>
          <SiteLink className={`${s.btn} ${s.btnSmall} ${s.btnLight}`} href={SITE_LINKS.signUp}>
            {m("navStart")}
          </SiteLink>
        </div>
        <MobileMenu
          actions={
            <>
              <SiteLanguage label={m("footerLanguage")} locale={locale} variant="row" />
              <SiteLink className={`${s.btn} ${s.btnOutline}`} href={SITE_LINKS.signIn}>
                {m("navSignIn")}
              </SiteLink>
              <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
                {m("navStart")}
              </SiteLink>
            </>
          }
          closeLabel={t("navMenuClose")}
          links={items.map((item) => (
            <SiteLink className={s.menuLink} href={item.href} key={item.href}>
              {item.label}
            </SiteLink>
          ))}
          logo={logo}
          openLabel={t("navMenu")}
        />
      </Container>
    </header>
  );
}
