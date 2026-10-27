import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, Plus } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { FINDERS_FEE_PCT, FOUNDING_SLOTS, PLANS, TRIAL_DAYS, fleetText } from "@/lib/plans";
import { formatPlanPrice, planPrices } from "@/lib/plan-currency";
import { visitorCurrency } from "@/lib/site-currency";
import {
  BookingPhoneMock,
  DashboardWindowMock,
  HandoverPhoneMock,
  LedgerCard,
  PaidToast,
  PassportCard,
  PaymentPhoneMock,
  ReturnCard,
  ShopPageMock,
  TodayPhoneMock,
  sampleMoney
} from "../_components/mockups";
import { Arrow, Container, Eyebrow, SITE_LINKS, SiteLink } from "../_components/site-ui";
import { FinalCta } from "../_components/final-cta";
import s from "../site.module.css";

const LANGUAGE_COUNT = supportedLocaleCodes.length;

type Say = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("site");
  const title = t("metaHomeTitle");
  const description = t("metaHomeDescription", { days: TRIAL_DAYS });
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: "/" },
    openGraph: { type: "website", url: "/", siteName: "RouteHQ", title, description },
    twitter: { card: "summary_large_image", title, description }
  };
}

export default async function SiteHomePage() {
  const [t, settings, locale, currency, money] = await Promise.all([getTranslations("site"), getTranslations("settingsPage"), getLocale(), visitorCurrency(), sampleMoney()]);
  const say = settings as unknown as Say;
  const nl = numberLocale(locale);
  const price = (amount: number) => formatPlanPrice(amount, currency, nl);

  const facts: Array<{ key: string; values?: Record<string, number> }> = [
    { key: "Phone" },
    { key: "Languages", values: { count: LANGUAGE_COUNT } },
    { key: "Chat" },
    { key: "Pay" },
    { key: "NoApp" },
    { key: "Free", values: { days: TRIAL_DAYS } }
  ];

  const features: Array<{ key: string; phone: ReactNode; card: ReactNode; ink?: boolean; flip?: boolean }> = [
    { key: "f1", phone: <BookingPhoneMock />, card: <PassportCard /> },
    { key: "f2", phone: <HandoverPhoneMock />, card: <ReturnCard />, ink: true, flip: true },
    { key: "f3", phone: <PaymentPhoneMock />, card: <LedgerCard /> }
  ];

  const day = [
    { time: "08:40", key: "day1", chip: t("dayChip1") },
    { time: "10:00", key: "day2", chip: t("dayChip2", { count: 8 }) },
    { time: "10:05", key: "day3", chip: t("mockPaidToast", { amount: money(5600) }), hot: true },
    { time: "13:20", key: "day4", chip: t("dayChip4") },
    { time: "16:30", key: "day5", chip: t("dayChip5", { amount: money(3000) }) },
    { time: "20:00", key: "day6", chip: t("dayChip6", { amount: money(9800) }) }
  ];

  const index = ["Reminders", "Inbox", "Calendar", "Paperwork", "Reports", "Owners", "Team", "Languages", "Importer", "Calculator"];
  const grow = ["BookingPage", "Directory", "Widget", "Partners"];
  const faqs = ["Phone", "App", "Trial", "Import", "Line", "Languages", "Bikes", "Cancel", "Who"];
  const faqValues: Record<string, Record<string, string | number>> = {
    Trial: { days: TRIAL_DAYS },
    Languages: { count: LANGUAGE_COUNT }
  };

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "RouteHQ",
    url: "https://routehq.app",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Vehicle rental management",
    operatingSystem: "Web, Android, iOS",
    description: t("metaHomeDescription", { days: TRIAL_DAYS }),
    inLanguage: [...supportedLocaleCodes],
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "THB",
      lowPrice: Math.min(...PLANS.map((plan) => plan.monthly)),
      highPrice: Math.max(...PLANS.map((plan) => plan.monthly)),
      offerCount: PLANS.length
    },
    publisher: { "@type": "Organization", name: "RouteHQ", url: "https://routehq.app", logo: "https://routehq.app/routehq-logo.svg" }
  };

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} type="application/ld+json" />

      {/* ── Hero: the promise, then the product, big, spilling onto the page below ── */}
      <section className={s.hero}>
        <Container className={s.heroTop}>
          <Eyebrow className={s.rise} dark>
            {t("heroEyebrow")}
          </Eyebrow>
          <h1 className={`${s.heroTitle} ${s.rise} mt-6`}>{t.rich("heroTitle", { hl: (chunks) => <span className={s.hl}>{chunks}</span> })}</h1>
          <div className={`${s.heroRow} ${s.rise} ${s.rise2}`}>
            <p className={s.heroSub}>{t("heroBody")}</p>
            <div>
              <div className={s.heroActions}>
                <SiteLink className={`${s.btn} ${s.btnSignal}`} href={SITE_LINKS.signUp}>
                  {t("ctaTrial")} <Arrow />
                </SiteLink>
                <SiteLink className={`${s.textLink} text-white`} href={SITE_LINKS.pricing}>
                  {t("heroSecondary")}
                </SiteLink>
              </div>
              <p className={s.heroNote}>{t("heroNote", { days: TRIAL_DAYS })}</p>
            </div>
          </div>

          <div className={`${s.stage} ${s.rise} ${s.rise3}`}>
            <div className={s.stageDesk}>
              <DashboardWindowMock />
              <div className={s.stagePhone}>
                <BookingPhoneMock />
              </div>
              <PaidToast className={s.stageToast} />
            </div>
            <div className={s.stageMobile}>
              <TodayPhoneMock />
              <PaidToast className={s.stageToast} />
            </div>
          </div>
        </Container>
      </section>

      {/* ── Plain facts ── */}
      <section aria-label={t("proofLabel")}>
        <Container>
          <div className={s.facts}>
            {facts.map(({ key, values }) => (
              <p className={s.fact} key={key}>
                <strong>{t(`fact${key}Title`, values || {})}</strong>
                {t(`fact${key}Body`, values || {})}
              </p>
            ))}
          </div>
        </Container>
      </section>

      {/* ── The problem, in one breath ── */}
      <section className={s.section}>
        <Container>
          <p className={s.statement}>
            {t("introTitle")} <span>{t("introBody")}</span>
          </p>
        </Container>
      </section>

      {/* ── Three jobs it does best ── */}
      <section className="pb-[clamp(88px,11vw,168px)]" id="features">
        <Container>
          {features.map((feature) => (
            <article className={s.feature} key={feature.key}>
              <div className={s.featureHead}>
                <div>
                  <Eyebrow>{t(`${feature.key}Eyebrow`)}</Eyebrow>
                  <h2 className={`${s.h2} mt-5`}>{t(`${feature.key}Title`)}</h2>
                </div>
                <div>
                  <p className={s.lede}>{t(`${feature.key}Body`)}</p>
                  <ul className={s.points}>
                    {[1, 2, 3].map((point) => (
                      <li key={point}>
                        <Check aria-hidden="true" size={18} strokeWidth={2.5} />
                        {t(`${feature.key}Point${point}`)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className={`${s.panel} ${feature.ink ? s.panelInk : ""} ${feature.flip ? s.panelFlip : ""}`}>
                <div className={s.panelPhone}>{feature.phone}</div>
                <div className={s.panelCard}>{feature.card}</div>
              </div>
            </article>
          ))}
        </Container>
      </section>

      {/* ── A day with RouteHQ ── */}
      <section className={`${s.day} ${s.section}`}>
        <Container className={s.dayGrid}>
          <div className={s.dayHead}>
            <Eyebrow dark>{t("dayEyebrow")}</Eyebrow>
            <h2 className={`${s.h2} mt-5 text-white`}>{t("dayTitle")}</h2>
            <p className={`${s.heroSub} mt-6`}>{t("dayBody")}</p>
          </div>
          <ol className={s.dayList}>
            {day.map((item) => (
              <li className={`${s.dayItem} ${item.hot ? s.dayItemHot : ""}`} key={item.key}>
                <p className={s.dayTime}>{item.time}</p>
                <div>
                  <h3 className="text-[19px] font-semibold leading-snug text-white">{t(`${item.key}Title`)}</h3>
                  <p className="mt-1.5 max-w-[34em] text-[16px] leading-relaxed text-[var(--ink-muted)]">{t(`${item.key}Body`)}</p>
                  <p className={s.dayChip}>
                    <span>
                      <Check aria-hidden="true" size={13} strokeWidth={3} />
                    </span>
                    {item.chip}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ── The rest of the job ── */}
      <section className={s.section}>
        <Container className={s.split}>
          <div className={s.splitSticky}>
            <h2 className={s.h2}>{t("gridTitle")}</h2>
            <p className={`${s.lede} mt-5`}>{t("gridBody")}</p>
          </div>
          <div className={s.index}>
            {index.map((key) => (
              <div className={s.indexItem} key={key}>
                <h3>{t(`grid${key}Title`, { count: LANGUAGE_COUNT })}</h3>
                <p>{t(`grid${key}Body`)}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Bookings coming in ── */}
      <section className={`${s.paper} ${s.section} overflow-hidden`}>
        <Container className={s.growGrid}>
          <div className={s.growHead}>
            <Eyebrow>{t("growEyebrow")}</Eyebrow>
            <h2 className={`${s.h2} mt-5`}>{t("growTitle")}</h2>
            <p className={`${s.lede} mt-5`}>{t("growBody")}</p>
          </div>
          <div className={s.growMock}>
            <ShopPageMock />
          </div>
          <div className={s.growList}>
            <div>
              {grow.map((key) => (
                <div className={s.indexItem} key={key}>
                  <h3>{t(`grow${key}Title`)}</h3>
                  <p>{t(`grow${key}Body`, { pct: FINDERS_FEE_PCT })}</p>
                </div>
              ))}
            </div>
            <SiteLink className={`${s.textLink} mt-4 text-[var(--text)]`} href={SITE_LINKS.directory}>
              {t("growDirectoryLink")} <Arrow />
            </SiteLink>
          </div>
        </Container>
      </section>

      {/* ── Plans in brief ── */}
      <section className={s.section}>
        <Container>
          <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
            <div className="max-w-[720px]">
              <Eyebrow>{t("navPricing")}</Eyebrow>
              <h2 className={`${s.h2} mt-5`}>{t("plansTitle")}</h2>
              <p className={`${s.lede} mt-5`}>{t("plansBody")}</p>
            </div>
            <SiteLink className={`${s.btn} ${s.btnOutline}`} href={SITE_LINKS.pricing}>
              {t("priceTeaserLink")} <Arrow />
            </SiteLink>
          </div>
          <div className={s.planRow}>
            {PLANS.map((plan) => {
              const hot = plan.id === "pro";
              const monthly = planPrices(plan, currency).monthly;
              return (
                <div className={`${s.planCell} ${hot ? s.planHot : ""}`} key={plan.id}>
                  <div className="min-w-0">
                    <p className={s.planName}>
                      {say(`bl_${plan.id}`)}
                      {hot ? <span className={s.planBadge}>{say("pl_popular")}</span> : null}
                    </p>
                    <p className={`${s.planMeta} mt-1`}>{plan.id === "business" ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}</p>
                  </div>
                  <div className="text-end min-[900px]:contents">
                    <p className={s.planPrice}>{plan.monthly === 0 ? say("pl_free") : price(monthly)}</p>
                    <p className={`${s.planMeta} ${s.planPer} mt-1 min-[900px]:mt-2`}>{plan.monthly === 0 ? say("pl_forever") : say("bl_perMonth")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-6 flex items-start gap-3 text-[15px] font-medium text-[var(--text)]">
            <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[var(--signal)]" />
            {t("foundingOffer", { count: FOUNDING_SLOTS })}
          </p>
        </Container>
      </section>

      {/* ── Owners, then questions ── */}
      <section className="pb-[clamp(88px,11vw,168px)]">
        <Container>
          <div className={s.strip}>
            <div className="max-w-[640px]">
              <h2 className={s.h3}>{t("ownersTeaserTitle")}</h2>
              <p className="mt-2 text-[16px] leading-relaxed text-[var(--text-muted)]">{t("ownersTeaserBody")}</p>
            </div>
            <SiteLink className={`${s.textLink} text-[var(--text)]`} href={SITE_LINKS.owners}>
              {t("ownersTeaserLink")} <Arrow />
            </SiteLink>
          </div>

          <div className={`${s.split} mt-[clamp(88px,11vw,168px)]`}>
            <div className={s.splitSticky}>
              <h2 className={s.h2}>{t("faqTitle")}</h2>
              <p className={`${s.lede} mt-5`}>{t("faqBody")}</p>
            </div>
            <div className={s.faq}>
              {faqs.map((key) => (
                <details className={s.faqItem} key={key}>
                  <summary>
                    {t(`faq${key}Q`)}
                    <Plus aria-hidden="true" size={20} />
                  </summary>
                  <p>{t(`faq${key}A`, faqValues[key] || {})}</p>
                </details>
              ))}
            </div>
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
