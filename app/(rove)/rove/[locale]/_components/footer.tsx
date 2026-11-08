import { getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { CookieChoicesLink } from "@/components/cookie-choices-link";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { roveHasLocale, roveHref } from "@/lib/rove/paths";
import { roveHqSite } from "@/lib/rove/seo";
import { legalUrl } from "@/lib/site/legal-slugs";
import { localizeSitePath } from "@/lib/site/locale-path";
import { listFleetHref } from "./header";
import { LanguagePicker } from "./language-picker";
import s from "../rove.module.css";

/**
 * Rove's footer (task build-rove, 8 Nov 2026): renters, operators, company and legal, then the language. Destinations
 * are reached through the Destinations page, the sitemap and links in context, not a list of every place here.
 */
export async function RoveFooter({ locale }: { locale: string }) {
  const t = await getTranslations("directory");
  const marketing = await getTranslations("marketing");
  const hq = (path: string) => `${roveHqSite()}${localizeSitePath(path, locale)}`;
  const current = supportedLocaleOptions.find((option) => option.code === locale);
  const columns = [
    {
      title: t("rv.footerRenters"),
      links: [
        { href: roveHref("/search", locale), label: t("rv.searchTitle") },
        { href: `${roveHref("/search", locale)}?monthly=1`, label: t("rv.navMonthly") },
        { href: roveHref("/destinations", roveHasLocale("destinations", locale) ? locale : "en"), label: t("rv.navDestinations") },
        { href: roveHref("/guides", locale), label: t("rv.guidesTitle") }
      ]
    },
    {
      title: t("rv.footerOperatorsTitle"),
      links: [
        { href: listFleetHref("footer"), label: t("rv.listFleet") },
        { href: hq("/pricing"), label: t("rv.footerHqPricing") },
        { href: hq("/guides"), label: t("rv.footerHqGuides") }
      ]
    },
    {
      title: t("rv.footerCompany"),
      links: [
        { href: hq("/"), label: t("rv.footerAboutHq") },
        { href: hq("/contact"), label: marketing("navContact") }
      ]
    }
  ];
  return (
    <footer className={s.footer}>
      <div className={s.wrap}>
        <div className={s.footerTop}>
          <div>
            <a aria-label={t("rv.homeLabel")} className={s.brand} href={roveHref("/", locale)}>
              <RouteHqLogo product="keys" showDescriptor={false} />
            </a>
            <p className={s.footerAbout}>{t("rv.footerAbout")}</p>
          </div>
          <div className={s.footerCols}>
            {columns.map((column) => (
              <nav aria-label={column.title} key={column.title}>
                <p className={s.footerHead}>{column.title}</p>
                <ul className={s.footerList}>
                  {column.links.map((link) => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label}</a>
                    </li>
                  ))}
                </ul>
              </nav>
            ))}
            <nav aria-label={marketing("footerLegal")}>
              <p className={s.footerHead}>{marketing("footerLegal")}</p>
              <ul className={s.footerList}>
                <li>
                  <a href={legalUrl("privacy")}>{t("rv.privacy")}</a>
                </li>
                <li>
                  <a href={legalUrl("terms")}>{t("rv.terms")}</a>
                </li>
                <li>
                  <CookieChoicesLink className="" label={marketing("legalCookieChoices")} />
                </li>
              </ul>
            </nav>
          </div>
        </div>
        <div className={s.footerBottom}>
          <p style={{ margin: 0 }}>{t("rv.footerCopyright", { year: String(new Date().getFullYear()) })}</p>
          <LanguagePicker
            current={locale}
            label={t("rv.language")}
            options={supportedLocaleOptions.map((option) => ({ code: option.code, label: option.label.replace(/ \(.*\)$/, "") }))}
            placement="up"
            short={current?.label.replace(/ \(.*\)$/, "") || locale}
          />
        </div>
      </div>
    </footer>
  );
}
