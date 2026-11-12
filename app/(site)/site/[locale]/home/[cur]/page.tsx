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
import { getResource, listGuidesFor } from "@/lib/site/content";
import { paysByQr, regionForCurrency } from "@/lib/site/region";
import { CATEGORY_KEY, JsonLd } from "../../_components/content-ui";
import { FinalCta } from "../../_components/final-cta";
import { HowTabs } from "../../_components/how-tabs";
import { TimeCalc } from "../../_components/time-calc";
import { ArrowRight, BellRing, Bike, CalendarDays, CalendarX2, CarFront, CircleCheck, CircleHelp, FileCheck2, Gift, Inbox, Keyboard, Languages, Link2, MessagesSquare, ReceiptText, ScanSearch, Smartphone, TrendingUp, Upload, Users, Zap } from "lucide-react";
import s from "../../site.module.css";
import h from "../../home.module.css";
import c from "../../content.module.css";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** The free resource the home page offers. */
const FEATURED_RESOURCE = "rental-agreement";

/** Keys with a "<key>Global" wording for visitors outside Asia, who don't pay by QR code and slip (lib/site/region.ts). */
const GLOBAL_VARIANTS = new Set(["heroBody", "step1Body", "step3Title", "step3Body", "step3b1", "step3b2", "auto2", "auto5", "never1", "never2"]);

/** A picture for each line of the home page, in the order the lines are written. */
const NEVER_ICONS = [Keyboard, MessagesSquare, CircleHelp, ScanSearch, CalendarX2];
const FACT_ICONS = [Gift, Smartphone, Languages, Link2];
const REST_ICONS = [BellRing, CalendarDays, Inbox, FileCheck2, TrendingUp, ReceiptText, Users, Upload];
/** Who it is for: a door to the page for each kind of rental business. */
const WHO = [
  { key: "whoCars", href: SITE_LINKS.carRental, Icon: CarFront },
  { key: "whoScooters", href: SITE_LINKS.scooterRental, Icon: Zap },
  { key: "whoMotorcycles", href: SITE_LINKS.motorcycleRental, Icon: Bike }
];

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
  // The visitor's region (from the currency in the address, lib/site/region.ts): guides about it first, and outside
  // Asia the copy leads with online booking, agreements and transfer/Wise/Revolut payments instead of QR codes and slips.
  const region = regionForCurrency(currency);
  const qr = paysByQr(region);
  const g = (key: string) => (!qr && GLOBAL_VARIANTS.has(key) ? `${key}Global` : key);
  const ownGuides = listGuidesFor(locale, region);
  const guidesLocale = ownGuides.length ? undefined : "en";
  const latest = (ownGuides.length ? ownGuides : listGuidesFor("en", region)).slice(0, 3);
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
    { label: t("mockGoingOut", { count: 1 }), colour: "#4a9ad8" }
  ];

  // Structured data: the product with its plans in US dollars (lib/site/schema.ts), and the questions below.
  // Organization and WebSite come from the layout.
  // How customers pay, answered for the visitor's region, after "Do my customers need an app?".
  const homeFaq = [1, 2, 3, 4, 5].map((n) => ({ q: m(`faq${n}Q`), a: m(`faq${n}A`) }));
  homeFaq.splice(2, 0, { q: m("faqPayQ"), a: m(qr ? "faqPayAAsia" : "faqPayA") });
  const jsonLd = [softwareApplicationLd({ description: m("metaDescription"), locale }), faqLd(homeFaq)];
  // The page's one H1 says what RoveHQ is (SEO, 7 Nov 2026), set small above the headline, which stays the brand line.
  // Until a language has the new words, it uses its translated "For car, scooter and bike rental businesses".
  const heading = (await hasOwnTranslation(locale, "marketing.heroH1")) ? m("heroH1") : m("heroEyebrow");

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* 1. Hero: the promise in a headline and one line, then the product, running onto the white below */}
      <section className={`${s.dark} ${s.hero} ${h.heroTight}`}>
        <Container>
          <div className={`${s.rise} ${h.heroCentre}`}>
            <h1 className={s.eyebrow}>{heading}</h1>
            <p className={`${s.h1} mt-6`}>{m.rich("heroTitle", RICH_SERIF)}</p>
            <p className={h.heroLine}>{m("heroLine")}</p>
            <div className={s.heroActions}>
              <SiteLink className={`${s.btn} ${h.cta}`} href={SITE_LINKS.signUp}>
                {m("heroCta")} <Arrow />
              </SiteLink>
              <SiteLink className={s.link} href="#how">
                {m("heroSecondary")} <Arrow />
              </SiteLink>
            </div>
            <ul className={h.proof}>
              {[m("fact1Title"), m("heroChipCard"), m("fact3Title"), m("fact2Title")].map((chip) => (
                <li key={chip}>
                  <CircleCheck size={16} />
                  {chip}
                </li>
              ))}
            </ul>
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

      {/* 2. The problem and the answer, side by side: the old jobs struck through, and what RoveHQ did this morning */}
      <section aria-label={t("proofLabel")} className={`${s.sectionBottom} ${h.afterHero}`}>
        <Container>
          <div className={`${s.head} ${h.centre}`}>
            <h2 className={s.h2}>{m.rich("vsTitle", RICH)}</h2>
            <p className={s.lede}>{m("vsLede")}</p>
          </div>
          <div className={h.vs}>
            <div className={`${h.vsCard} ${h.vsBefore}`}>
              <span className={h.vsLabel}>{m("neverEyebrow")}</span>
              <p className={h.vsTitle}>{m("vsBeforeTitle")}</p>
              <ul className={h.vsList}>
                {[1, 2, 3, 4, 5].map((n) => {
                  const Icon = NEVER_ICONS[n - 1];
                  return (
                    <li key={n}>
                      <span aria-hidden="true" className={h.vsIcon}>
                        <Icon size={20} />
                      </span>
                      <s>{m(g(`never${n}`))}</s>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div aria-hidden="true" className={h.vsArrow}>
              <span>
                <ArrowRight size={24} />
              </span>
            </div>
            <div className={`${h.vsCard} ${h.vsAfter}`}>
              <span className={h.vsLabel}>
                <span aria-hidden="true" className={h.vsLive} />
                {m("vsAfterLabel")}
              </span>
              <p className={h.vsTitle}>{m("autoTitle")}</p>
              <ol className={h.vsList}>
                {[1, 2, 3, 4, 5, 6].map((n) => (
                  <li key={n}>
                    <span aria-hidden="true" className={h.vsIcon}>
                      <CircleCheck size={20} />
                    </span>
                    <span>{m(g(`auto${n}`))}</span>
                    <time className={h.vsTime}>{m(`auto${n}Time`)}</time>
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <ul className={h.facts}>
            {[1, 2, 3, 4].map((n) => {
              const Icon = FACT_ICONS[n - 1];
              return (
                <li className={h.fact} key={n}>
                  <span aria-hidden="true" className={h.factIcon}>
                    <Icon size={22} />
                  </span>
                  <strong>{m(`fact${n}Title`)}</strong>
                  <span>{m(`fact${n}Body`)}</span>
                </li>
              );
            })}
          </ul>
        </Container>
      </section>

      {/* 3. How it works: three steps you press through, one on screen at a time */}
      <section className={`${s.mist} ${s.section}`} id="how">
        <Container>
          <div className={s.head}>
            <Eyebrow>{m("howEyebrow")}</Eyebrow>
            <h2 className={s.h2}>{m.rich("howTitle", RICH)}</h2>
          </div>
          <HowTabs
            steps={steps.map((step) => ({
              key: step.key,
              title: m(g(`${step.key}Title`)),
              body: m(g(`${step.key}Body`)),
              bullets: [1, 2, 3].map((b) => m(g(`${step.key}b${b}`))),
              visual: (
                <>
                  <div>{step.phone}</div>
                  <div>{step.card}</div>
                </>
              )
            }))}
          />
          <ul className={h.who}>
            {WHO.map((item) => (
              <li key={item.key}>
                <SiteLink href={item.href}>
                  <span aria-hidden="true" className={h.whoIcon}>
                    <item.Icon size={22} />
                  </span>
                  {m(item.key)}
                  <ArrowRight size={18} />
                </SiteLink>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      {/* 4. The sum: the visitor's own numbers, and the hours they add up to */}
      <section className={s.section}>
        <Container>
          <TimeCalc
            action={
              <SiteLink className={`${s.btn} ${h.cta}`} href={SITE_LINKS.signUp}>
                {m("heroCta")} <Arrow />
              </SiteLink>
            }
            words={{ title: m("calcTitle"), lede: m("calcLede"), bookings: m("calcBookings"), minutes: m("calcMinutes"), hours: m("calcHours"), days: m("calcDays"), note: m("calcNote") }}
          />
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
              <p className={s.body}>{m("importShort")}</p>
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

      {/* 7. The rest of the job: eight tiles, a picture and a line each */}
      <section className={s.section}>
        <Container>
          <div className={`${s.head} ${h.centre}`}>
            <h2 className={s.h2}>{m("restTitle")}</h2>
            <p className={s.lede}>{m("restBody")}</p>
          </div>
          <ul className={h.rest}>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => {
              const Icon = REST_ICONS[n - 1];
              return (
                <li className={h.restItem} key={n}>
                  <span aria-hidden="true" className={h.restIcon}>
                    <Icon size={24} />
                  </span>
                  <h3>{m(`rest${n}Title`)}</h3>
                  <p>{m(`rest${n}Body`)}</p>
                </li>
              );
            })}
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
          <div className={h.why}>
            <div>
              <p className={h.whyEyebrow}>{m("whyEyebrow")}</p>
              <h2 className={h.whyTitle}>{m.rich("whyTitle", RICH)}</h2>
              <p className={h.whyBody}>{m("whyBody")}</p>
            </div>
            <ul className={h.whyPoints}>
              {[1, 2, 3, 4].map((n) => (
                <li key={n}>
                  <CircleCheck size={22} />
                  {m(`whyPoint${n}`)}
                </li>
              ))}
            </ul>
          </div>
          <div className={`${s.twoCol} mt-[var(--section)]`}>
            <h2 className={s.h2}>{m("faqTitle")}</h2>
            <div>
              <div className={s.faq}>
                {homeFaq.map((item) => (
                  <details className={s.faqItem} key={item.q}>
                    <summary>
                      {item.q}
                      <Plus />
                    </summary>
                    <p>{item.a}</p>
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
