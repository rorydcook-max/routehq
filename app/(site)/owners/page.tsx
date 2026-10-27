import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowRight, FileText, KeyRound, Search } from "lucide-react";
import { StatementPhoneMock } from "../_components/mockups";
import { Container, SITE_LINKS, SiteLink } from "../_components/site-ui";
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
  const steps = [
    { icon: Search, key: "ownersStep1" },
    { icon: KeyRound, key: "ownersStep2" },
    { icon: FileText, key: "ownersStep3" }
  ];
  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className={s.heroGlow} />
        <Container className="relative grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1.2fr_1fr] lg:pb-24 lg:pt-20">
          <div className="max-w-[620px]">
            <p className={s.eyebrow}>
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
              {t("ownersEyebrow")}
            </p>
            <h1 className={`${s.display} mt-4 text-[2.4rem] sm:text-[3.2rem]`}>{t("ownersTitle")}</h1>
            <p className={`${s.lede} mt-5 text-[1.125rem] leading-relaxed text-[var(--muted)]`}>{t("ownersBody")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SiteLink className={s.btnPrimary} href={SITE_LINKS.directory}>
                {t("ownersBrowse")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
              </SiteLink>
            </div>
          </div>
          <div className="mx-auto w-[72%] max-w-[280px]">
            <StatementPhoneMock />
          </div>
        </Container>
      </section>

      <section className="py-16 sm:py-24">
        <Container>
          <ol className="grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, key }, index) => (
              <li className={`${s.surface} p-6`} key={key}>
                <div className="flex items-center gap-3">
                  <span className={s.iconTile}>
                    <Icon aria-hidden="true" size={20} />
                  </span>
                  <span className="text-[15px] font-semibold text-[var(--muted)]">{index + 1}</span>
                </div>
                <h2 className="mt-4 text-[19px] font-semibold text-[var(--foreground)]">{t(`${key}Title`)}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--muted)]">{t(`${key}Body`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section className="pb-20 sm:pb-28">
        <Container>
          <div className={`${s.tint} flex flex-col items-start justify-between gap-6 rounded-[32px] p-8 sm:p-12 lg:flex-row lg:items-center`}>
            <div className="max-w-[620px]">
              <h2 className={`${s.display} text-[1.9rem] sm:text-[2.3rem]`}>{t("ownersOperatorTitle")}</h2>
              <p className="mt-3 text-[1.0625rem] leading-relaxed text-[var(--muted)]">{t("ownersOperatorBody")}</p>
            </div>
            <SiteLink className={s.btnPrimary} href={SITE_LINKS.signUp}>
              {t("ctaTrial")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
            </SiteLink>
          </div>
        </Container>
      </section>
    </>
  );
}
