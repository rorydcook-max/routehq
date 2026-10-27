import { getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { MobileMenu } from "./mobile-menu";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The website's header: logo, the few places worth going, and the trial. Sticky, frosted, never taller than 72px. */
export async function SiteHeader() {
  const t = await getTranslations("site");
  const items = [
    { href: SITE_LINKS.features, label: t("navFeatures") },
    { href: SITE_LINKS.pricing, label: t("navPricing") },
    { href: SITE_LINKS.directory, label: t("navDirectory") },
    { href: SITE_LINKS.owners, label: t("navOwners") }
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)]/70 bg-white/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/70">
      <Container className="relative flex h-[68px] items-center justify-between gap-4">
        <SiteLink aria-label={t("navHome")} className="inline-flex shrink-0 items-center" href={SITE_LINKS.home}>
          <RouteHqLogo className="[&_svg]:h-9 [&_svg]:w-9" showDescriptor={false} />
        </SiteLink>
        <nav aria-label={t("navLabel")} className="hidden items-center gap-1 md:flex">
          {items.map((item) => (
            <SiteLink className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-[var(--foreground-secondary)] transition-colors hover:bg-[var(--panel-secondary)] hover:text-[var(--foreground)]" href={item.href} key={item.href}>
              {item.label}
            </SiteLink>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <SiteLink className="rounded-full px-3.5 py-2 text-[15px] font-semibold text-[var(--foreground-secondary)] hover:text-[var(--foreground)]" href={SITE_LINKS.signIn}>
            {t("navSignIn")}
          </SiteLink>
          <SiteLink className={`${s.btnPrimary} ${s.btnSmall}`} href={SITE_LINKS.signUp}>
            {t("ctaTrial")}
          </SiteLink>
        </div>
        <MobileMenu
          closeLabel={t("navMenuClose")}
          items={items}
          openLabel={t("navMenu")}
          signIn={{ href: SITE_LINKS.signIn, label: t("navSignIn") }}
          trial={{ href: SITE_LINKS.signUp, label: t("ctaTrial") }}
        />
      </Container>
    </header>
  );
}
