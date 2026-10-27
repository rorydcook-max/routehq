import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { StatementPhoneMock } from "../_components/mockups";
import { FinalCta } from "../_components/final-cta";
import { Container, Eyebrow, RICH, SITE_LINKS, SiteLink } from "../_components/site-ui";
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
  const m = await getTranslations("marketing");
  return (
    <>
      <section className={`${s.dark} ${s.hero} ${s.heroOwners}`}>
        <Container className={s.ownersGrid}>
          <div className={`${s.rise} ${s.heroOwnersText}`}>
            <Eyebrow>{m("ownersEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} ${s.h1Owners} mt-6`}>{m.rich("ownersTitle", RICH)}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("ownersBody")}</p>
          </div>
          <div className={`${s.ownersPhone} ${s.rise}`}>
            <StatementPhoneMock />
          </div>
        </Container>
      </section>

      <section className={s.section}>
        <Container>
          <ol className={s.stepsRow}>
            {["01", "02", "03"].map((n, index) => (
              <li key={n}>
                <p aria-hidden="true" className={s.stepNum}>
                  {n}
                </p>
                <h2 className={s.stepTitle}>{m(`own${index + 1}Title`)}</h2>
                <p className={`${s.body} ${s.stepBody}`}>{m(`own${index + 1}Body`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className={s.sectionBottom}>
        <Container>
          <div className={s.opRow}>
            <div>
              <h2 className={s.h3}>{m("ownersOpTitle")}</h2>
              <p className={`${s.body} mt-2`}>{m("ownersOpBody")}</p>
            </div>
            <SiteLink className={`${s.btn} ${s.btnInk}`} href={SITE_LINKS.signUp}>
              {m("ownersOpCta")}
            </SiteLink>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
