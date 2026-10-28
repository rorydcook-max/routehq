import { getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { MobileMenu } from "./mobile-menu";
import { SiteLanguage } from "./site-language";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The website's header: logo, the few places worth going, sign in and the trial. Sticky, ink, 64px. */
export async function SiteHeader() {
  const [t, m] = await Promise.all([getTranslations("site"), getTranslations("marketing")]);
  const items = [
    { href: SITE_LINKS.features, label: m("navFeatures") },
    { href: SITE_LINKS.pricing, label: m("navPricing") },
    { href: SITE_LINKS.faq, label: m("navFaq") },
    { href: SITE_LINKS.contact, label: m("navContact") }
  ];
  const logo = (
    <SiteLink aria-label={t("navHome")} className="inline-flex min-h-11 shrink-0 items-center" href={SITE_LINKS.home}>
      <span className="inline-flex items-center" dir="ltr">
        <RouteHqLogo className="[&_svg]:h-8 [&_svg]:w-8" showDescriptor={false} tone="dark" />
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
          <SiteLanguage label={m("footerLanguage")} variant="compact" />
          <SiteLink className={s.navLink} href={SITE_LINKS.signIn}>
            {m("navSignIn")}
          </SiteLink>
          <SiteLink className={`${s.btn} ${s.btnSmall} ${s.btnLight}`} href={SITE_LINKS.signUp}>
            {m("navStart")}
          </SiteLink>
        </div>
        <MobileMenu
          closeLabel={t("navMenuClose")}
          items={items}
          language={<SiteLanguage label={m("footerLanguage")} variant="row" />}
          logo={logo}
          openLabel={t("navMenu")}
          signIn={{ href: SITE_LINKS.signIn, label: m("navSignIn") }}
          start={{ href: SITE_LINKS.signUp, label: m("navStart") }}
        />
      </Container>
    </header>
  );
}
