import { getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { roveHasLocale, roveHref } from "@/lib/rove/paths";
import { roveHqSite } from "@/lib/rove/seo";
import { Icon, type IconName } from "./icon";
import { LanguagePicker } from "./language-picker";
import s from "../rove.module.css";

/** Where "List your fleet" goes: RoveHQ's website, tagged so RoveHQ knows the visit came from rove.rent. */
export function listFleetHref(campaign: string) {
  return `${roveHqSite()}/?utm_source=rove.rent&utm_medium=referral&utm_campaign=${campaign}`;
}

/** Rove's header: the logo home, monthly rentals, destinations, guides, the language list and "List your fleet". */
export async function RoveHeader({ locale }: { locale: string }) {
  const t = await getTranslations("directory");
  const current = supportedLocaleOptions.find((option) => option.code === locale);
  const links: Array<{ href: string; label: string; icon: IconName }> = [
    { href: `${roveHref("/search", locale)}?monthly=1`, label: t("rv.navMonthly"), icon: "calendar-repeat" },
    { href: roveHref("/destinations", roveHasLocale("destinations", locale) ? locale : "en"), label: t("rv.navDestinations"), icon: "map-2" },
    { href: roveHref("/guides", locale), label: t("rv.navGuides"), icon: "book-2" }
  ];
  return (
    <header className={s.header}>
      <div className={`${s.wrap} ${s.headerRow}`}>
        <a aria-label={t("rv.homeLabel")} className={s.brand} href={roveHref("/", locale)}>
          <RouteHqLogo product="keys" showDescriptor={false} />
        </a>
        <nav aria-label={t("rv.navLabel")} className={s.nav}>
          {links.map((link) => (
            <a className={`${s.navLink} ${s.navWide}`} href={link.href} key={link.href}>
              {link.label}
            </a>
          ))}
          <LanguagePicker
            current={locale}
            label={t("rv.language")}
            options={supportedLocaleOptions.map((option) => ({ code: option.code, label: option.label.replace(/ \(.*\)$/, "") }))}
            short={(current?.code || locale).toUpperCase()}
          />
          <a className={s.navCta} href={listFleetHref("list_your_fleet")}>
            {t("rv.listFleet")}
          </a>
          <details className={s.menu}>
            <summary aria-label={t("rv.menu")} className={s.menuButton}>
              <Icon name="menu-2" />
            </summary>
            <div className={s.menuPanel}>
              {links.map((link) => (
                <a href={link.href} key={link.href}>
                  <Icon name={link.icon} style={{ fontSize: 20, color: "var(--jade)" }} />
                  {link.label}
                </a>
              ))}
              <a className={s.menuCta} href={listFleetHref("list_your_fleet")}>
                {t("rv.listFleet")}
              </a>
            </div>
          </details>
        </nav>
      </div>
    </header>
  );
}
