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
    <footer className="border-t border-[var(--border)] bg-[var(--panel-secondary)]">
      <Container className="py-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="col-span-2 max-w-[320px] md:col-span-1">
            <RouteHqLogo className="[&_svg]:h-9 [&_svg]:w-9" showDescriptor={false} />
            <p className="mt-4 text-[15px] leading-relaxed text-[var(--muted)]">{t("footerTagline")}</p>
          </div>
          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-[15px] font-semibold text-[var(--foreground)]" style={{ fontFamily: "inherit", letterSpacing: 0 }}>
                {column.title}
              </h2>
              <ul className="mt-3 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <SiteLink className="text-[15px] text-[var(--muted)] transition-colors hover:text-[var(--primary)]" href={link.href}>
                      {link.label}
                    </SiteLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col-reverse items-start justify-between gap-4 border-t border-[var(--border)] pt-6 sm:flex-row sm:items-center">
          <p className="text-[15px] text-[var(--muted)]">{t("footerCopyright", { year: String(new Date().getFullYear()) })}</p>
          <div className="flex items-center gap-3">
            <span className="sr-only">{t("footerLanguage")}</span>
            <AuthLanguage />
          </div>
        </div>
      </Container>
    </footer>
  );
}
