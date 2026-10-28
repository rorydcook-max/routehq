import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronDown } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { BUSINESS_INCLUDED, PLANS, TRIAL_DAYS, YEARLY_MONTHS, fleetText, type Plan } from "@/lib/plans";
import { formatPlanPrice, planCurrency, planPrices, yearlyOf } from "@/lib/plan-currency";
import { isSiteCurrency, visitorCurrency } from "@/lib/site-currency";
import { localizeSitePath } from "@/lib/site/locale-path";
import { siteMetadata } from "@/lib/site/seo";
import { FinalCta } from "../_components/final-cta";
import { Check, Container, Eyebrow, Plus, RICH, SITE_LINKS, SiteLink, r } from "../_components/site-ui";
import s from "../site.module.css";

/** Currencies offered in the switcher: US dollars and Thai baht first, then the region's and visitors' usual ones. All are in lib/plan-currency.ts. */
const CURRENCIES = ["USD", "THB", "EUR", "GBP", "AUD", "SGD", "MYR", "IDR", "VND", "PHP", "LAK", "KHR", "MMK", "INR", "CNY", "JPY", "KRW"];

/** Lines shown on a card; the rest go in "Compare everything". */
const CARD_LINES = 6;

type Say = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, currency] = await Promise.all([getTranslations("site"), getLocale(), visitorCurrency()]);
  const cheapestPaid = PLANS.filter((plan) => plan.monthly > 0).sort((a, b) => a.monthly - b.monthly)[0];
  const title = t("metaPricingTitle");
  const description = t("metaPricingDescription", { price: formatPlanPrice(planPrices(cheapestPaid, currency).monthly, currency, numberLocale(locale)), days: TRIAL_DAYS });
  return siteMetadata({ path: "/pricing", locale, title, description });
}

/** What a plan has: the same lines as the plan cards in Settings → Plan, worded by the same (already translated) keys. */
function differences(plan: Plan, say: Say, number: (value: number) => string, logoLine = say("pl_whiteLabel")): string[] {
  const lines: string[] = [];
  lines.push(plan.team === null ? say("pl_teamUnlimited") : say("pl_team", { count: plan.team }));
  lines.push(say("pl_reads", { count: number(plan.documentReads) }));
  lines.push(say("pl_lookups", { count: number(plan.comparisonLookups) }));
  if (plan.accountingExport) lines.push(say("pl_export"));
  if (plan.severalLocations) lines.push(say("pl_locations"));
  if (plan.whiteLabel) lines.push(logoLine);
  if (plan.customDomain) lines.push(say("pl_ownDomain"));
  if (plan.prioritySupport) lines.push(say("pl_support"));
  return lines;
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string; currency?: string }> }) {
  const params = await searchParams;
  const [m, t, settings, locale, detected] = await Promise.all([getTranslations("marketing"), getTranslations("site"), getTranslations("settingsPage"), getLocale(), visitorCurrency()]);
  const say = settings as unknown as Say;
  const nl = numberLocale(locale);
  const yearly = params.billing === "yearly";
  const currencies = CURRENCIES.includes(detected) ? CURRENCIES : [detected, ...CURRENCIES];
  const asked = String(params.currency || "").toUpperCase();
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

  const included = ["Import", "Bookings", "Handover", "Payments", "Reminders", "Inbox", "Paperwork", "Reports", "Owners", "BookingPage", "Partners", "Languages"];
  const faqs = ["Yearly", "Trial", "Bikes", "Currency", "Grow"];
  const faqValues: Record<string, Record<string, string | number>> = {
    Yearly: { months: YEARLY_MONTHS },
    Trial: { days: TRIAL_DAYS }
  };

  return (
    <>
      <section className={`${s.dark} ${s.hero} ${s.heroCards}`}>
        <Container>
          <div className={s.rise}>
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
            {faqs.map((key) => (
              <details className={s.faqItem} key={key}>
                <summary>
                  {t(`pfaq${key}Q`)}
                  <Plus />
                </summary>
                <p>{t(`pfaq${key}A`, faqValues[key] || {})}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
