import { getTranslations } from "next-intl/server";
import { AuthLanguage } from "@/components/auth-language";
import { RouteHqLogo } from "@/components/brand-logo";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The website's footer: where to go next, the language (the same choice the sign-in pages keep), and the name. */
export async function SiteFooter() {
  const m = await getTranslations("marketing");
  const columns = [
    {
      title: m("footerProduct"),
      links: [
        { href: SITE_LINKS.features, label: m("navFeatures") },
        { href: SITE_LINKS.pricing, label: m("navPricing") }
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
        <div className={s.footerBottom}>
          <p>{m("footerCopyright", { year: String(new Date().getFullYear()) })}</p>
          <div className="[&_label]:min-h-11">
            <span className="sr-only">{m("footerLanguage")}</span>
            <AuthLanguage />
          </div>
        </div>
      </Container>
    </footer>
  );
}
