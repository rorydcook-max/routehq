import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { BUSINESS_INCLUDED, PLANS, TRIAL_DAYS, YEARLY_MONTHS, fleetText, type Plan } from "@/lib/plans";
import { formatPlanPrice, planCurrency, planPrices, yearlyOf } from "@/lib/plan-currency";
import { notFound } from "next/navigation";
import { isSiteCurrency, pricingCurrenciesFor } from "@/lib/site-currency";
import { parsePricingView, pricingView } from "@/lib/site/internal-path";
import { paysByQr, regionForCurrency } from "@/lib/site/region";
import { siteLocale } from "@/lib/site/static-page";
import { localizeSitePath } from "@/lib/site/locale-path";
import { SITE_OG, siteMetadata } from "@/lib/site/seo";
import { breadcrumbLd, faqLd, softwareApplicationLd } from "@/lib/site/schema";
import { JsonLd } from "../../_components/content-ui";
import { FinalCta } from "../../_components/final-cta";
import { Check, Container, Eyebrow, Plus, RICH, SITE_LINKS, SiteLink, r } from "../../_components/site-ui";
import s from "../../site.module.css";

/** Lines shown on a card; the rest go in "Compare everything". */
const CARD_LINES = 6;

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * The pricing page in a language, for a visitor's currency, with their choice of currency and monthly or yearly:
 * proxy.ts puts all three in the address's last part ("THB_EUR_y", lib/site/internal-path.ts) from the visitor's
 * country and ?currency= / ?billing=, so each combination is drawn once and then served from the cache.
 */
type Props = { params: Promise<{ locale: string; view: string }> };

// Drawn ahead of time, monthly, in US dollars and baht for every language; other combinations when first asked for.
export function generateStaticParams() {
  return [{ view: pricingView("USD", "USD", false) }, { view: pricingView("THB", "THB", false) }];
}

async function pricingParams(params: Props["params"]) {
  const locale = await siteLocale(params);
  const view = parsePricingView((await params).view);
  if (!view) notFound();
  return { locale, ...view };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { detected: currency } = await pricingParams(params);
  const [t, locale] = await Promise.all([getTranslations("site"), getLocale()]);
  const cheapestPaid = PLANS.filter((plan) => plan.monthly > 0).sort((a, b) => a.monthly - b.monthly)[0];
  const title = t("metaPricingTitle");
  const description = t("metaPricingDescription", { price: formatPlanPrice(planPrices(cheapestPaid, currency).monthly, currency, numberLocale(locale)), days: TRIAL_DAYS });
  return siteMetadata({ path: "/pricing", locale, title, description, image: SITE_OG.pricing });
}

/** What a plan has: the same lines as the plan cards in Settings → Plan, worded by the same (already translated) keys. */
function differences(plan: Plan, say: Say, number: (value: number) => string, logoLine = say("pl_whiteLabel")): string[] {
  const lines: string[] = [];
  lines.push(plan.team === null ? say("pl_teamUnlimited") : say("pl_team", { count: plan.team }));
  lines.push(say("pl_reads", { count: number(plan.documentReads) }));
  if (plan.accountingExport) lines.push(say("pl_export"));
  if (plan.severalLocations) lines.push(say("pl_locations"));
  if (plan.whiteLabel) lines.push(logoLine);
  if (plan.customDomain) lines.push(say("pl_ownDomain"));
  if (plan.prioritySupport) lines.push(say("pl_support"));
  return lines;
}

export default async function PricingPage({ params }: Props) {
  const { detected, chosen, yearly } = await pricingParams(params);
  const [m, t, settings, locale] = await Promise.all([getTranslations("marketing"), getTranslations("site"), getTranslations("settingsPage"), getLocale()]);
  const say = settings as unknown as Say;
  const nl = numberLocale(locale);
  // The visitor's own currency first, then the global list (lib/site-currency.ts).
  const currencies = pricingCurrenciesFor(detected);
  const asked = chosen;
  const currency = planCurrency(currencies.includes(asked) && isSiteCurrency(asked) ? asked : detected);
  const price = (amount: number) => formatPlanPrice(amount, currency, nl);
  const period = (monthly: number) => (yearly ? yearlyOf(monthly, currency) : monthly);
  /** A yearly price as "a month": whole units, or cents below 20 ($13.75), as Settings → Plan shows it. */
  const perMonthOfYear = (yearlyAmount: number) => {
    const value = yearlyAmount / 12;
    return value >= 20 ? Math.round(value) : Math.round(value * 100) / 100;
  };
  const href = (next: { billing?: boolean; currency?: string }) => {
    const query = new URLSearchParams();
    if (next.billing ?? yearly) query.set("billing", "yearly");
    const code = next.currency ?? currency;
    if (code !== detected) query.set("currency", code);
    const text = query.toString();
    return r(localizeSitePath(`/pricing${text ? `?${text}` : ""}`, locale));
  };
  let currencyName = (code: string) => code;
  try {
    const names = new Intl.DisplayNames([nl], { type: "currency" });
    currencyName = (code: string) => names.of(code) || code;
  } catch {
    // Older browsers and runtimes: codes alone.
  }
  const number = (value: number) => value.toLocaleString(nl);
  /** The full lines, for "Compare everything"; the cards say the logo line in short. */
  const lines = Object.fromEntries(PLANS.map((plan) => [plan.id, differences(plan, say, number)]));
  const cardLines = Object.fromEntries(PLANS.map((plan) => [plan.id, differences(plan, say, number, m("planLogoShort"))]));
  const moreLines = PLANS.some((plan) => lines[plan.id].length > CARD_LINES);

  // The visitor's region (from their currency, lib/site/region.ts): outside Asia, payments are transfer, Wise and
  // Revolut rather than QR codes, and the questions say how renters pay, with card payments as coming soon.
  const qr = paysByQr(regionForCurrency(detected));
  const included = ["Import", "Bookings", "Handover", qr ? "Payments" : "PaymentsGlobal", "Reminders", "Inbox", "Paperwork", "Reports", "Owners", "BookingPage", "Partners", "Languages"];
  const faqValues: Record<string, Record<string, string | number>> = {
    Yearly: { months: YEARLY_MONTHS },
    Trial: { days: TRIAL_DAYS }
  };
  const faqItems = ["Yearly", "Trial", "Bikes", "Currency", "Grow"].map((key) => ({ q: t(`pfaq${key}Q`), a: t(`pfaq${key}A`, faqValues[key] || {}) }));
  faqItems.splice(3, 0, { q: m("faqPayQ"), a: m(qr ? "faqPayAAsia" : "faqPayA") });

  // Structured data: the product with its plans in US dollars whatever the visitor's currency (search engines index
  // one page), the questions below, and where the page sits.
  const cheapestPaid = PLANS.filter((plan) => plan.monthly > 0).sort((a, b) => a.monthly - b.monthly)[0];
  const jsonLd = [
    softwareApplicationLd({ description: t("metaPricingDescription", { price: formatPlanPrice(planPrices(cheapestPaid, "USD").monthly, "USD", nl), days: TRIAL_DAYS }), locale }),
    faqLd(faqItems),
    breadcrumbLd(
      [
        { name: m("breadcrumbHome"), path: "/" },
        { name: m("navPricing"), path: "/pricing" }
      ],
      locale
    )
  ];

  return (
    <>
      <JsonLd data={jsonLd} />
      <section className={`${s.dark} ${s.hero} ${s.heroCards}`}>
        <Container>
          {/* Above the plan cards: both rise in with an animation (each its own layer), and the cards, coming later,
              painted over the open currency list. */}
          <div className={`${s.rise} relative z-30`}>
            <Eyebrow>{m("pricingEyebrow")}</Eyebrow>
            <h1 className={`${s.h1} mt-6`}>{m.rich("pricingTitle", RICH)}</h1>
            <p className={`${s.lede} ${s.heroBody}`}>{m("pricingBody")}</p>
            <div className={s.controls}>
              <div aria-label={t("pricingBilling")} className={s.segment} role="group">
                <Link aria-current={!yearly ? "true" : undefined} className={`${s.segItem} ${!yearly ? s.segOn : ""}`} href={href({ billing: false })} scroll={false}>
                  {say("pl_monthly")}
                </Link>
                <Link aria-current={yearly ? "true" : undefined} className={`${s.segItem} ${yearly ? s.segOn : ""}`} href={href({ billing: true })} scroll={false}>
                  {say("pl_yearly")}
                  <span className={s.segTag}>{say("pl_monthsFree", { count: 12 - YEARLY_MONTHS })}</span>
                </Link>
              </div>
              {/* Keyed by the choice, so the list closes once a currency is picked. */}
              <details className="relative" key={`${currency}-${yearly}`}>
                <summary aria-label={t("pricingCurrency")} className={s.select}>
                  {currency}
                  <span className="hidden text-[var(--muted-dark)] sm:inline">{currencyName(currency)}</span>
                  <ChevronDown aria-hidden="true" className={s.chevron} size={16} />
                </summary>
                <ul className={s.selectList}>
                  {currencies.map((code) => (
                    <li key={code}>
                      <Link aria-current={code === currency ? "true" : undefined} className={`${s.selectItem} ${code === currency ? s.selectItemOn : ""}`} href={href({ currency: code })} scroll={false}>
                        <span className="truncate">{currencyName(code)}</span>
                        <span className="shrink-0 text-[var(--muted)]">{code}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
            <p className={`${s.note} ${s.heroNote}`}>{m("pricingTrial")}</p>
          </div>

          <div className={`${s.planCards} ${s.rise}`}>
            {PLANS.map((plan) => {
              const popular = plan.id === "pro";
              const business = plan.id === "business";
              const prices = planPrices(plan, currency);
              return (
                <section aria-labelledby={`plan-${plan.id}`} className={`${s.planCard} ${popular ? s.planCardHot : ""}`} key={plan.id}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-[20px] font-semibold leading-tight" id={`plan-${plan.id}`}>
                      {say(`bl_${plan.id}`)}
                    </h2>
                    {popular ? <span className={s.pill}>{m("pricingPopular")}</span> : null}
                  </div>
                  <p className={`${s.planMeta} mt-1.5 min-h-10`}>{business ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}</p>
                  <p className={s.planCardPrice}>{plan.monthly === 0 ? say("pl_free") : price(period(prices.monthly))}</p>
                  <p className={`${s.planMeta} mt-2 min-h-6`}>{plan.monthly === 0 ? say("pl_forever") : yearly ? say("pl_perYear", { monthly: price(perMonthOfYear(period(prices.monthly))) }) : say("bl_perMonth")}</p>
                  <SiteLink className={`${s.btn} ${popular ? s.btnLight : s.btnInk} mt-6 w-full`} href={SITE_LINKS.signUp}>
                    {m("navStart")}
                  </SiteLink>
                  <ul className={s.planList}>
                    {cardLines[plan.id].slice(0, CARD_LINES).map((line) => (
                      <li key={line}>
                        <Check />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                      </li>
                    ))}
                  </ul>
                  {business ? (
                    <p className={`${s.planMeta} mt-4 border-t border-[var(--line)] pt-4`}>
                      {say("pl_businessIncludes", { fleet: fleetText(BUSINESS_INCLUDED, say) })} {say("pl_businessExtra", { car: price(period(prices.extraCar)), motorbike: price(period(prices.extraMotorbike)) })}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </Container>
      </section>

      <section className={s.sectionBottom}>
        <Container>
          {moreLines ? (
            <details className={s.compare}>
              <summary>
                {m("pricingCompare")}
                <Plus />
              </summary>
              <div className={s.compareGrid}>
                {PLANS.map((plan) => (
                  <div key={plan.id}>
                    <h3>{say(`bl_${plan.id}`)}</h3>
                    <ul>
                      {lines[plan.id].map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </details>
          ) : null}
          <p className={`${s.note} mt-8 max-w-[560px]`}>{m("pricingNote")}</p>
        </Container>
      </section>

      <section className={`${s.mist} ${s.section}`}>
        <Container className={s.twoCol}>
          <div className={s.head}>
            <h2 className={s.h2}>{say("pl_everyTitle")}</h2>
            <p className={s.body}>{say("pl_everyBody")}</p>
          </div>
          <ul className={s.inclList}>
            {included.map((key) => (
              <li key={key}>
                <Check />
                {t(`incl${key}`, { count: supportedLocaleCodes.length })}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className={s.section}>
        <Container className={s.twoCol}>
          <h2 className={s.h2}>{t("pricingFaqTitle")}</h2>
          <div className={s.faq}>
            {faqItems.map((item) => (
              <details className={s.faqItem} key={item.q}>
                <summary>
                  {item.q}
                  <Plus />
                </summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
