import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatementPhoneMock } from "../_components/mockups";
import { FinalCta } from "../_components/final-cta";
import { Arrow, Container, Eyebrow, SITE_LINKS, SiteLink } from "../_components/site-ui";
import s from "../site.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  const title = t("metaOwnersTitle");
  const description = t("metaOwnersDescription");
  return {
    title,
    description,
    alternates: { canonical: "/owners" },
    openGraph: { type: "website", url: "/owners", siteName: "RouteHQ", title: `${title} | RouteHQ`, description }
  };
}

/** For people who own a car or motorbike and want a rental business to run it for them. Short on purpose. */
export default async function OwnersPage() {
  const t = await getTranslations("site");
  const steps = ["ownersStep1", "ownersStep2", "ownersStep3"];
  return (
    <>
      <section className={`${s.hero} ${s.heroOwners}`}>
        <Container className={`${s.heroTop} ${s.ownersGrid}`}>
          <div className="pb-4 lg:pb-[calc(var(--spill)+48px)]">
            <Eyebrow dark>{t("ownersEyebrow")}</Eyebrow>
            <h1 className={`${s.heroTitle} mt-6 !text-[clamp(2.6rem,1.2rem+5.2vw,5.6rem)]`}>{t("ownersTitle")}</h1>
            <p className={`${s.heroSub} mt-8`}>{t("ownersBody")}</p>
            <div className={`${s.heroActions} mt-8`}>
              <SiteLink className={`${s.btn} ${s.btnSignal}`} href={SITE_LINKS.directory}>
                {t("ownersBrowse")} <Arrow />
              </SiteLink>
            </div>
          </div>
          <div className={s.ownersPhone}>
            <StatementPhoneMock />
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container>
          <ol className={s.steps}>
            {steps.map((key, index) => (
              <li className={s.step} key={key}>
                <p className={s.stepNumber}>{String(index + 1).padStart(2, "0")}</p>
                <h2 className={`${s.h3} mt-6`}>{t(`${key}Title`)}</h2>
                <p className="mt-3 text-[16px] leading-relaxed text-[var(--text-muted)]">{t(`${key}Body`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="pb-[clamp(88px,11vw,168px)]">
        <Container>
          <div className={s.strip}>
            <div className="max-w-[640px]">
              <h2 className={s.h3}>{t("ownersOperatorTitle")}</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-muted)]">{t("ownersOperatorBody")}</p>
            </div>
            <SiteLink className={`${s.btn} ${s.btnInk}`} href={SITE_LINKS.signUp}>
              {t("ctaTrial")} <Arrow />
            </SiteLink>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
