import { getTranslations } from "next-intl/server";
import { AuthLanguage } from "@/components/auth-language";
import { RouteHqLogo } from "@/components/brand-logo";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";

/** The website's footer: where to go next, the language (the same choice the sign-in pages keep), and the name. */
export async function SiteFooter() {
  const t = await getTranslations("site");
  const columns = [
    {
      title: t("footerProduct"),
      links: [
        { href: SITE_LINKS.features, label: t("navFeatures") },
        { href: SITE_LINKS.pricing, label: t("navPricing") },
        { href: SITE_LINKS.owners, label: t("navOwners") }
      ]
    },
    {
      title: t("footerRenters"),
      links: [{ href: SITE_LINKS.directory, label: t("footerDirectory") }]
    },
    {
      title: t("footerAccount"),
      links: [
        { href: SITE_LINKS.signIn, label: t("navSignIn") },
        { href: SITE_LINKS.signUp, label: t("ctaTrial") }
      ]
    }
  ];
  return (
    <footer className="bg-[var(--paper)] text-[var(--text)]">
      <Container className="pb-10 pt-16 sm:pt-20">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.6fr_repeat(3,1fr)]">
          <div className="col-span-2 max-w-[340px] md:col-span-1">
            <span className="inline-block" dir="ltr">
              <RouteHqLogo className="[&_svg]:h-8 [&_svg]:w-8" showDescriptor={false} />
            </span>
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--text-muted)]">{t("footerTagline")}</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-[14px] font-semibold text-[var(--text)]">{column.title}</h2>
              <ul className="mt-3">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <SiteLink className="inline-flex min-h-10 items-center text-[15px] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]" href={link.href}>
                      {link.label}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col-reverse items-start justify-between gap-4 border-t border-[var(--line)] pt-6 sm:flex-row sm:items-center">
          <p className="text-[14px] text-[var(--text-muted)]">{t("footerCopyright", { year: String(new Date().getFullYear()) })}</p>
          <div className="flex items-center gap-3">
            <span className="sr-only">{t("footerLanguage")}</span>
            <AuthLanguage />
          </div>
        </div>
      </Container>
    </footer>
  );
}
