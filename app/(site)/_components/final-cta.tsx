import { getTranslations } from "next-intl/server";
import { TRIAL_DAYS } from "@/lib/plans";
import { Arrow, Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The last word on every page: try it. */
export async function FinalCta({ showPricing = true }: { showPricing?: boolean } = {}) {
  const t = await getTranslations("site");
  return (
    <section className={s.final}>
      <Container>
        <h2 className={s.finalTitle}>{t("finalTitle", { days: TRIAL_DAYS })}</h2>
        <div className="mt-8 grid gap-8 md:mt-12 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
          <p className={s.heroSub}>{t("finalBody")}</p>
          <div className={s.heroActions}>
            <SiteLink className={`${s.btn} ${s.btnSignal}`} href={SITE_LINKS.signUp}>
              {t("ctaTrial")} <Arrow />
            </SiteLink>
            {showPricing ? (
              <SiteLink className={`${s.textLink} text-white`} href={SITE_LINKS.pricing}>
                {t("heroSecondary")}
              </SiteLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}
