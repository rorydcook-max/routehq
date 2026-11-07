import { getTranslations } from "next-intl/server";
import { RouteHqLogo } from "@/components/brand-logo";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { roveHref } from "@/lib/rove/paths";
import { roveHqSite } from "@/lib/rove/seo";
import { LanguagePicker } from "./language-picker";
import s from "../rove.module.css";

/** Rove's header: the logo home, destinations, guides, the language list and "List your fleet" (RoveHQ's website). */
export async function RoveHeader({ locale }: { locale: string }) {
  const t = await getTranslations("directory");
  const current = supportedLocaleOptions.find((option) => option.code === locale);
  return (
    <header className={s.header}>
      <div className={`${s.wrap} ${s.headerRow}`}>
        <a aria-label={t("rv.homeLabel")} className={s.brand} href={roveHref("/", locale)}>
          <RouteHqLogo product="keys" showDescriptor={false} />
        </a>
        <nav aria-label={t("rv.navLabel")} className={s.nav}>
          <a className={`${s.navLink} ${s.navHideSmall}`} href={`${roveHref("/", locale)}#destinations`}>
            {t("rv.navDestinations")}
          </a>
          <a className={`${s.navLink} ${s.navHideSmall}`} href="/guides">
            {t("rv.navGuides")}
          </a>
          <LanguagePicker
            current={locale}
            label={t("rv.language")}
            options={supportedLocaleOptions.map((option) => ({ code: option.code, label: option.label }))}
            short={(current?.code || locale).toUpperCase()}
          />
          <a className={`${s.listCta} ${s.navHideSmall}`} href={`${roveHqSite()}/?utm_source=rove.rent&utm_medium=referral&utm_campaign=list_your_fleet`}>
            {t("rv.listFleet")}
          </a>
        </nav>
      </div>
    </header>
  );
}
