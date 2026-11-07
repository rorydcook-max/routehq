import { getTranslations } from "next-intl/server";
import { CookieChoicesLink } from "@/components/cookie-choices-link";
import { DESTINATIONS, destinationPath } from "@/lib/rove/destinations";
import { GUIDES } from "@/lib/rove/guides";
import { roveHqSite } from "@/lib/rove/seo";
import { legalUrl } from "@/lib/site/legal-slugs";
import s from "../rove.module.css";

/** Rove's footer: what Rove is, every destination and guide (good for people and for crawling), and the legal links. */
export async function RoveFooter({ locale: _locale }: { locale: string }) {
  const t = await getTranslations("directory");
  const marketing = await getTranslations("marketing");
  return (
    <footer className={s.footer}>
      <div className={`${s.wrap} ${s.footerGrid}`}>
        <div>
          <p className={s.footerHead}>{t("rv.footerTitle")}</p>
          <p style={{ marginTop: 8, maxWidth: "46ch" }}>{t("footer")}</p>
          <p style={{ marginTop: 12 }}>
            <a href={`${roveHqSite()}/?utm_source=rove.rent&utm_medium=referral&utm_campaign=footer`}>{t("rv.footerOperators")}</a>
          </p>
        </div>
        <div>
          <p className={s.footerHead}>{t("rv.navDestinations")}</p>
          <ul className={s.footerList}>
            {DESTINATIONS.filter((destination) => destination.featured).map((destination) => (
              <li key={destinationPath(destination)}>
                <a href={destinationPath(destination)}>{t("rv.rentIn", { place: destination.name })}</a>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className={s.footerHead}>{t("rv.navGuides")}</p>
          <ul className={s.footerList}>
            {GUIDES.map((guide) => (
              <li key={guide.slug}>
                <a href={`/guides/${guide.slug}`} lang="en">
                  {guide.title}
                </a>
              </li>
            ))}
            <li>
              <a href={legalUrl("privacy")}>{t("rv.privacy")}</a>
            </li>
            <li>
              <a href={legalUrl("terms")}>{t("rv.terms")}</a>
            </li>
            <li>
              <CookieChoicesLink className="underline-offset-2 hover:underline" label={marketing("legalCookieChoices")} />
            </li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
