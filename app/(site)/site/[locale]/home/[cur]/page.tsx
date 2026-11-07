import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { numberLocale } from "@/lib/i18n/dates";
import { siteTime } from "@/lib/sites/format";
import { PLANS, fleetText } from "@/lib/plans";
import { faqLd, softwareApplicationLd } from "@/lib/site/schema";
import { hasOwnTranslation } from "@/lib/site/own-translation";
import { formatPlanPrice, planPrices } from "@/lib/plan-currency";
import { notFound } from "next/navigation";
import { isSiteCurrency } from "@/lib/site-currency";
import { setPageCurrency, siteLocale } from "@/lib/site/static-page";
import { BookingPhoneMock, DashboardWindowMock, HandoverPhoneMock, ImportMock, LedgerCard, PassportCard, PaymentPhoneMock, ReturnCard, ShopPageMock, TodayPhoneMock, sampleMoney } from "../../_components/mockups";
import { Arrow, Check, Container, Eyebrow, Plus, RICH, RICH_SERIF, SITE_LINKS, SiteLink } from "../../_components/site-ui";
import { siteMetadata } from "@/lib/site/seo";
import { getResource, listGuides } from "@/lib/site/content";
import { CATEGORY_KEY, JsonLd } from "../../_components/content-ui";
import { FinalCta } from "../../_components/final-cta";
import s from "../../site.module.css";
import c from "../../content.module.css";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** The free resource the home page offers. */
const FEATURED_RESOURCE = "rental-agreement";

/** The home page in a language and a currency: proxy.ts picks the visitor's currency (lib/site/internal-path.ts). */
type Props = { params: Promise<{ locale: string; cur: string }> };

// Drawn ahead of time in US dollars and baht for every language; any other currency the first time it is asked for, then kept.
export function generateStaticParams() {
  return [{ cur: "USD" }, { cur: "THB" }];
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  await siteLocale(params);
  const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
  // The title and description lead with what RoveHQ is (SEO, 7 Nov 2026). A language whose file doesn't have the new
  // ones yet keeps its translated older ones rather than showing English.
  const [ownTitle, ownDescription] = await Promise.all([hasOwnTranslation(locale, "marketing.homeMetaTitle"), hasOwnTranslation(locale, "marketing.homeMetaDescription")]);
  return siteMetadata({
    path: "/",
    locale,
    title: ownTitle ? m("homeMetaTitle") : m("metaTitle"),
    description: ownDescription ? m("homeMetaDescription") : m("metaDescription"),
    absoluteTitle: true
  });
}

export default async function SiteHomePage({ params }: Props) {
  await siteLocale(params);
  const { cur: currency } = await params;
  if (!isSiteCurrency(currency)) notFound();
  // The pictures below show their amounts in this currency.
  setPageCurrency(currency);
  const [m, t, settings, locale, money] = await Promise.all([getTranslations("marketing"), getTranslations("site"), getTranslations("settingsPage"), getLocale(), sampleMoney()]);
  const say = settings as unknown as Say;
  const nl = numberLocale(locale);
  const price = (amount: number) => formatPlanPrice(amount, currency, nl);
  // The summary's time the way the visitor writes it (sites-global): the page is drawn ahead per language and
  // currency, so English uses the 12-hour clock where that currency's countries do (7:00 AM) and 07:00 elsewhere.
  const TWELVE_HOUR = ["USD", "CAD", "AUD", "NZD", "PHP", "INR"];
  const summaryTime = siteTime("07:00", locale === "en" ? (TWELVE_HOUR.includes(String(currency).toUpperCase()) ? "en-US" : "en-GB") : locale);
  // The free template and the latest guides, in this language when written, else English.
  const ownGuides = listGuides(locale);
  const guidesLocale = ownGuides.length ? undefined : "en";
  const latest = (ownGuides.length ? ownGuides : listGuides("en")).slice(0, 3);
  const magnetResource = getResource(locale, FEATURED_RESOURCE);
  const magnet = magnetResource ? { resource: magnetResource, locale: undefined } : getResource("en", FEATURED_RESOURCE) ? { resource: getResource("en", FEATURED_RESOURCE)!, locale: "en" } : null;

  const steps: Array<{ n: string; key: string; phone: ReactNode; card: ReactNode; dark?: boolean }> = [
    { n: "01", key: "step1", phone: <BookingPhoneMock />, card: <PassportCard /> },
    { n: "02", key: "step2", phone: <HandoverPhoneMock />, card: <ReturnCard />, dark: true },
    { n: "03", key: "step3", phone: <PaymentPhoneMock />, card: <LedgerCard /> }
  ];
  const stats = [
    { label: t("mockOverdue", { count: 1 }), colour: "#d14343" },
    { label: t("mockForToday", { count: 3 }), colour: "#12bcb8" },
    { label: t("mockGoingOut", { count: 2 }), colour: "#4a9ad8" }
  ];

  // Structured data: the product with its plans in US dollars (lib/site/schema.ts), and the questions below.
  // Organization and WebSite come from the layout.
  const homeFaq = [1, 2, 3, 4, 5].map((n) => ({ q: m(`faq${n}Q`), a: m(`faq${n}A`) }));
  const jsonLd = [softwareApplicationLd({ description: m("metaDescription"), locale }), faqLd(homeFaq)];
  // The page's one H1 says what RoveHQ is (SEO, 7 Nov 2026), set small above the headline, which stays the brand line.
  // Until a language has the new words, it uses its translated "For car, scooter and bike rental businesses".
  const heading = (await hasOwnTranslation(locale, "marketing.heroH1")) ? m("heroH1") : m("heroEyebrow");

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* 1. Hero: the promise, then the product, running onto the white below */}
      <section className={`${s.dark} ${s.hero}`}>
        <Container>
          <div className={s.rise}>
            <h1 className={s.eyebrow}>{heading}</h1>
            <p className={`${s.h1} mt-6`}>{m.rich("heroTitle", RICH_SERIF)}</p>
            <p className={`${s.lede} ${s.heroBody}`}>{m("heroBody")}</p>
            <div className={s.heroActions}>
              <SiteLink className={`${s.btn} ${s.btnLight}`} href={SITE_LINKS.signUp}>
                {m("heroCta")}
              </SiteLink>
              <SiteLink className={s.link} href="#how">
                {m("heroSecondary")} <Arrow />
              </SiteLink>
            </div>
            <p className={`${s.note} ${s.heroNote}`}>{m("heroNote")}</p>
          </div>
          <div className={`${s.stage} ${s.rise}`}>
            <div className={s.stageDesk}>
              <DashboardWindowMock />
              <div className={s.stagePhone}>
                <BookingPhoneMock />
              </div>
            </div>
            <div className={s.stageMobile}>
              <TodayPhoneMock />
            </div>
          </div>
        </Container>
      </section>

      {/* 2. On autopilot: what RoveHQ did this morning without anyone touching it, then the plain facts */}
      <section aria-label={t("proofLabel")} className={s.sectionBottom}>
        <Container>
          <div className={s.auto}>
            <p className={s.autoTitle}>{m("autoTitle")}</p>
            <ol className={s.autoFeed}>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <li className={s.autoItem} key={n}>
                  <Check />
                  <span className={s.autoText}>{m(`auto${n}`)}</span>
                  <time className={s.autoTime}>{m(`auto${n}Time`)}</time>
                </li>
              ))}
            </ol>
          </div>
          <ul className={s.facts}>
            {[1, 2, 3, 4].map((n) => (
              <li className={s.fact} key={n}>
                <strong>{m(`fact${n}Title`)}</strong>
                <span>{m(`fact${n}Body`)}</span>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 3. Things you'll never do again: the old jobs, struck through */}
      <section className={`${s.mist} ${s.section}`}>
        <Container>
          <div className={s.head}>
            <Eyebrow>{m("neverEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m("neverTitle")}</h2>
          </div>
          <ul className={s.never}>
            {[1, 2, 3, 4, 5].map((n) => (
              <li key={n}>
                <s>{m(`never${n}`)}</s>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 4. How it works */}
      <section className={s.section} id="how">
        <Container>
          <div className={s.head}>
            <Eyebrow>{m("howEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("howTitle", RICH)}</h2>
          </div>
          <div className={s.steps}>
            {steps.map((step, index) => (
              <article className={`${s.stepRow} ${index % 2 ? s.stepRowFlip : ""} ${step.dark ? `${s.dark} ${s.stepPanel}` : ""}`} key={step.key}>
                <div className={s.stepText}>
                  <p aria-hidden="true" className={s.stepNum}>
                    {step.n}
                  </p>
                  <h3 className={s.stepTitle}>{m(`${step.key}Title`)}</h3>
                  <p className={`${s.body} ${s.stepBody}`}>{m(`${step.key}Body`)}</p>
                  <ul className={s.checks}>
                    {[1, 2, 3].map((b) => (
                      <li key={b}>
                        <Check />
                        {m(`${step.key}b${b}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${s.stepVisual} ${s.scene}`}>
                  <div className={s.scenePhone}>{step.phone}</div>
                  <div className={s.sceneCard}>{step.card}</div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* 4b. Moving in: RoveHQ brings a business's records in for it, free. The picture follows the words on phones. */}
      <section aria-labelledby="moving-in" className={s.sectionBottom}>
        <Container className={s.importRow}>
          <div className={s.importText}>
            <div className={s.head}>
              <Eyebrow>{m("importEyebrow")}</Eyebrow>
              <h2 className={s.h2} id="moving-in">
                {m("importTitle")}
              </h2>
              <p className={s.body}>{m("importBody")}</p>
            </div>
            <ul className={s.checks}>
              {[1, 2, 3].map((n) => (
                <li key={n}>
                  <Check />
                  {m(`import${n}`)}
                </li>
              ))}
            </ul>
            <p className={s.importNote}>{m("importNote")}</p>
          </div>
          <div className={s.importVisual}>
            <ImportMock />
          </div>
        </Container>
      </section>

      {/* 5. Every morning */}
      <section className={`${s.mist} ${s.section}`}>
        <Container className={s.dayGrid}>
          <div className={s.dayPhone}>
            <TodayPhoneMock />
          </div>
          <div>
            <div className={s.head}>
              <Eyebrow>{m("dayEyebrow")}</Eyebrow>
              <h2 className={s.h2}>{m.rich("dayTitle", RICH)}</h2>
              <p className={s.lede}>{m("dayBody")}</p>
            </div>
            <div className={s.dayTools}>
              <ul className={s.list}>
                {stats.map((stat) => (
                  <li className={s.statRow} key={stat.label}>
                    <span aria-hidden="true" className={s.statDot} style={{ background: stat.colour }} />
                    {stat.label}
                  </li>
                ))}
              </ul>
              <div className={s.chat}>
                <p className={s.chatTitle}>{m("daySummaryTitle")}</p>
                <div>
                  <div className={s.chatRow}>
                    <span className={s.chatAvatar}>R</span>
                    <div className={s.chatBubble}>
                      <p>
                        {t("mockOverdue", { count: 1 })} · {t("mockForToday", { count: 3 })}
                      </p>
                      <p>{m("daySummaryTaken", { amount: money(9800) })}</p>
                      <p>{m("daySummaryTomorrow", { count: 2 })}</p>
                    </div>
                  </div>
                  <p className={s.chatTime}>{summaryTime}</p>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* 6. Grow */}
      <section className={`${s.dark} ${s.section}`}>
        <Container>
          <div className={`${s.head} ${s.headWide}`}>
            <Eyebrow>{m("growEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("growTitle", RICH)}</h2>
            <p className={s.lede}>{m("growBody")}</p>
          </div>
        </Container>
        <Container className={s.growGrid}>
          <div>
            <ul className={s.list}>
              {[1, 2, 3].map((n) => (
                <li className={s.listItem} key={n}>
                  <h3>{m(`grow${n}Title`)}</h3>
                  <p>{m(`grow${n}Body`)}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <ShopPageMock />
          </div>
        </Container>
      </section>

      {/* 7. The rest of the job */}
      <section className={s.section}>
        <Container>
          <div className={s.head}>
            <h2 className={s.h2}>{m("restTitle")}</h2>
            <p className={s.lede}>{m("restBody")}</p>
          </div>
          <ul className={s.row4}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <li className={s.rowItem} key={n}>
                <h3>{m(`rest${n}Title`)}</h3>
                <p>{m(`rest${n}Body`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 8. Plans in brief */}
      <section className={`${s.mist} ${s.section}`}>
        <Container>
          <div className={`${s.head} ${s.headWide}`}>
            <Eyebrow>{m("priceEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("priceTitle", RICH)}</h2>
            <p className={s.lede}>{m("priceBody")}</p>
          </div>
          <div className={s.planStrip}>
            {PLANS.map((plan) => {
              const hot = plan.id === "pro";
              const monthly = planPrices(plan, currency).monthly;
              return (
                <div className={`${s.planCell} ${hot ? s.planHot : ""}`} key={plan.id}>
                  <div className="min-w-0">
                    <p className={s.planName}>{say(`bl_${plan.id}`)}</p>
                    <p className={s.planMeta}>{plan.id === "business" ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}</p>
                  </div>
                  <div className="text-end min-[900px]:contents">
                    <p className={s.planPrice}>{plan.monthly === 0 ? say("pl_free") : price(monthly)}</p>
                    <p className={`${s.planMeta} ${s.planPer}`}>{plan.monthly === 0 ? say("pl_forever") : say("bl_perMonth")}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <SiteLink className={`${s.link} mt-6`} href={SITE_LINKS.pricing}>
            {m("priceLink")} <Arrow />
          </SiteLink>
        </Container>
      </section>

      {/* 9. Why, 10. Questions */}
      <section className={s.section}>
        <Container>
          <div className={`${s.twoCol} ${s.twoColWhy}`}>
            <div className={`${s.head} ${s.headWide}`}>
              <Eyebrow>{m("whyEyebrow")}</Eyebrow>
              <h2 className={`${s.h2} ${s.h2Why}`}>{m.rich("whyTitle", RICH)}</h2>
            </div>
            <p className={`${s.body} lg:pt-9`}>{m("whyBody")}</p>
          </div>
          <div className={`${s.twoCol} mt-[var(--section)]`}>
            <h2 className={s.h2}>{m("faqTitle")}</h2>
            <div>
              <div className={s.faq}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <details className={s.faqItem} key={n}>
                    <summary>
                      {m(`faq${n}Q`)}
                      <Plus />
                    </summary>
                    <p>{m(`faq${n}A`)}</p>
                  </details>
                ))}
              </div>
              <SiteLink className={`${s.link} mt-4`} href={SITE_LINKS.faq}>
                {m("faqSeeAll")} <Arrow />
              </SiteLink>
            </div>
          </div>
        </Container>
      </section>

      {/* 11. Free for rental businesses: the free template and the latest guides */}
      {magnet || latest.length ? (
        <section aria-labelledby="free-title" className={`${s.mist} ${s.section}`}>
          <Container>
            <div className={`${s.head} ${s.headWide}`}>
              <Eyebrow>{m("homeFreeEyebrow")}</Eyebrow>
              <h2 className={s.h2} id="free-title">
                {m("homeFreeTitle")}
              </h2>
            </div>
            <div className={c.free}>
              {magnet ? (
                <div className={c.freeMagnet}>
                  <p className={`${c.tag} ${c.tagOnDark}`}>{m("leadEyebrow")}</p>
                  <p className={c.leadCardTitle}>{magnet.resource.title}</p>
                  <p className={c.leadCardBody}>{magnet.resource.description}</p>
                  <div className={c.btnRow}>
                    <SiteLink className={`${s.btn} ${s.btnLight}`} href={`/resources/${magnet.resource.slug}`} locale={magnet.locale}>
                      {m("resourceOpen")} <Arrow />
                    </SiteLink>
                  </div>
                </div>
              ) : null}
              {latest.length ? (
                <div>
                  <p className={c.listLabel}>{m("homeFreeGuides")}</p>
                  <ul className={c.freeList}>
                    {latest.map((guide) => (
                      <li className={c.freeItem} key={guide.slug}>
                        <div className="min-w-0">
                          <h3>
                            <SiteLink href={`/guides/${guide.slug}`} locale={guidesLocale}>
                              {guide.title}
                            </SiteLink>
                          </h3>
                          <p>
                            {m(CATEGORY_KEY[guide.category])} · {m("readTime", { minutes: guide.readingMinutes })}
                          </p>
                        </div>
                        <Arrow />
                      </li>
                    ))}
                  </ul>
                  <SiteLink className={`${s.link} mt-4`} href={SITE_LINKS.guides}>
                    {m("guidesSeeAll")} <Arrow />
                  </SiteLink>
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      <FinalCta />
    </>
  );
}
