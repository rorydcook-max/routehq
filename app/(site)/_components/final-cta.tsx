import { getTranslations } from "next-intl/server";
import { ArrowRight } from "lucide-react";
import { TRIAL_DAYS } from "@/lib/plans";
import { Container, SITE_LINKS, SiteLink } from "./site-ui";
import s from "../site.module.css";

/** The last word on every page: try it. */
export async function FinalCta({ showPricing = true }: { showPricing?: boolean } = {}) {
  const t = await getTranslations("site");
  return (
    <section className="py-20 sm:py-28">
      <Container>
        <div className="relative overflow-hidden rounded-[32px] bg-[var(--foreground)] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(18,188,184,0.25),transparent_70%)]" />
          <div className="relative mx-auto max-w-[640px]">
            <h2 className={`${s.display} text-[2rem] text-white sm:text-[2.8rem]`}>{t("finalTitle", { days: TRIAL_DAYS })}</h2>
            <p className={`${s.lede} mt-4 text-[1.0625rem] leading-relaxed text-white/75 sm:text-[1.125rem]`}>{t("finalBody")}</p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <SiteLink className={`${s.btnPrimary} !bg-white !text-[var(--foreground)] hover:!bg-[#eef5f4]`} href={SITE_LINKS.signUp}>
                {t("ctaTrial")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
              </SiteLink>
              {showPricing ? (
                <SiteLink className={`${s.btnSecondary} !border-white/30 !bg-transparent !text-white hover:!border-white`} href={SITE_LINKS.pricing}>
                  {t("heroSecondary")}
                </SiteLink>
              ) : null}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
