import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, ChevronDown, Plus } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { BUSINESS_INCLUDED, FOUNDING_SLOTS, PLANS, TRIAL_DAYS, YEARLY_MONTHS, fleetText, type Plan } from "@/lib/plans";
import { formatPlanPrice, planCurrency, planPrices, yearlyOf } from "@/lib/plan-currency";
import { isSiteCurrency, visitorCurrency } from "@/lib/site-currency";
import { FinalCta } from "../_components/final-cta";
import { Container, Eyebrow, SITE_LINKS, SiteLink, r } from "../_components/site-ui";
import s from "../site.module.css";

/** Currencies offered in the switcher: US dollars and Thai baht first, then the region's and visitors' usual ones. All are in lib/plan-currency.ts. */
const CURRENCIES = ["USD", "THB", "EUR", "GBP", "AUD", "SGD", "MYR", "IDR", "VND", "PHP", "LAK", "KHR", "MMK", "INR", "CNY", "JPY", "KRW"];

type Say = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale, currency] = await Promise.all([getTranslations("site"), getLocale(), visitorCurrency()]);
  const cheapestPaid = PLANS.filter((plan) => plan.monthly > 0).sort((a, b) => a.monthly - b.monthly)[0];
  const title = t("metaPricingTitle");
  const description = t("metaPricingDescription", { price: formatPlanPrice(planPrices(cheapestPaid, currency).monthly, currency, numberLocale(locale)), days: TRIAL_DAYS });
  return {
    title,
    description,
    alternates: { canonical: "/pricing" },
    openGraph: { type: "website", url: "/pricing", siteName: "RouteHQ", title: `${title} | RouteHQ`, description }
  };
}

/** What a plan has: the same lines as the plan cards in Settings → Plan, worded by the same (already translated) keys. */
function differences(plan: Plan, say: Say, number: (value: number) => string): string[] {
  const lines: string[] = [];
  lines.push(plan.team === null ? say("pl_teamUnlimited") : say("pl_team", { count: plan.team }));
  lines.push(say("pl_reads", { count: number(plan.documentReads) }));
  lines.push(say("pl_lookups", { count: number(plan.comparisonLookups) }));
  if (plan.accountingExport) lines.push(say("pl_export"));
  if (plan.severalLocations) lines.push(say("pl_locations"));
  if (plan.whiteLabel) lines.push(say("pl_whiteLabel"));
  if (plan.customDomain) lines.push(say("pl_ownDomain"));
  if (plan.setupService) lines.push(say("pl_setup"));
  if (plan.prioritySupport) lines.push(say("pl_support"));
  return lines;
}

export default async function PricingPage({ searchParams }: { searchParams: Promise<{ billing?: string; currency?: string }> }) {
  const params = await searchParams;
  const [t, settings, locale, detected] = await Promise.all([getTranslations("site"), getTranslations("settingsPage"), getLocale(), visitorCurrency()]);
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
    return r(`/pricing${text ? `?${text}` : ""}`);
  };
  let currencyName = (code: string) => code;
  try {
    const names = new Intl.DisplayNames([nl], { type: "currency" });
    currencyName = (code: string) => names.of(code) || code;
  } catch {
    // Older browsers and runtimes: codes alone.
  }

  const included = ["Bookings", "Handover", "Payments", "Reminders", "Inbox", "Paperwork", "Reports", "Owners", "BookingPage", "Partners", "Languages"];
  const faqs = ["Founding", "Yearly", "Trial", "Bikes", "Currency", "Grow"];
  const faqValues: Record<string, Record<string, string | number>> = {
    Founding: { count: FOUNDING_SLOTS },
    Yearly: { months: YEARLY_MONTHS },
    Trial: { days: TRIAL_DAYS }
  };

  return (
    <>
      <section className={`${s.hero} ${s.heroSpillTall}`}>
        <Container className={s.heroTop}>
          <Eyebrow dark>{t("navPricing")}</Eyebrow>
          <h1 className={`${s.heroTitle} mt-6 !max-w-[12ch]`}>{t("pricingTitle")}</h1>
          <div className={s.heroRow}>
            <div>
              <p className={s.heroSub}>{say("pl_subtitle")}</p>
              <p className="mt-3 text-[15px] font-medium text-white">{t("pricingTrial", { days: TRIAL_DAYS })}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div aria-label={t("pricingBilling")} className={s.seg} role="group">
                <Link aria-current={!yearly ? "true" : undefined} className={`${s.segItem} ${!yearly ? s.segOn : ""}`} href={href({ billing: false })} scroll={false}>
                  {say("pl_monthly")}
                </Link>
                <Link aria-current={yearly ? "true" : undefined} className={`${s.segItem} ${yearly ? s.segOn : ""}`} href={href({ billing: true })} scroll={false}>
                  {say("pl_yearly")}
                  <span className={`ms-2 rounded-full px-2 py-0.5 text-[12px] font-bold ${yearly ? "bg-[var(--ink)] text-white" : "bg-[rgba(246,169,67,0.16)] text-[var(--signal)]"}`}>{say("pl_monthsFree", { count: 12 - YEARLY_MONTHS })}</span>
                </Link>
              </div>
              {/* Keyed by the choice, so the list closes once a currency is picked. */}
              <details className={`${s.details} relative`} key={`${currency}-${yearly}`}>
                <summary aria-label={t("pricingCurrency")} className={s.segSelect}>
                  {currency}
                  <span className="hidden text-[var(--ink-muted)] sm:inline">{currencyName(currency)}</span>
                  <ChevronDown aria-hidden="true" className={s.chevron} size={16} />
                </summary>
                <ul className="absolute end-0 z-20 mt-2 max-h-[340px] w-[min(280px,calc(100vw-32px))] overflow-y-auto rounded-2xl border border-[var(--line)] bg-white p-1.5 text-start text-[var(--text)] shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)]">
                  {currencies.map((code) => (
                    <li key={code}>
                      <Link
                        aria-current={code === currency ? "true" : undefined}
                        className={`flex min-h-11 items-center justify-between gap-3 rounded-xl px-3 text-[15px] ${code === currency ? "bg-[var(--paper)] font-semibold" : "hover:bg-[var(--paper)]"}`}
                        href={href({ currency: code })}
                        scroll={false}
                      >
                        <span className="truncate">{currencyName(code)}</span>
                        <span className="shrink-0 font-semibold text-[var(--text-muted)]">{code}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </div>

          <p className="mt-10 flex items-start gap-3 text-[15px] font-medium text-white">
            <span aria-hidden="true" className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[var(--signal)]" />
            {t("foundingOffer", { count: FOUNDING_SLOTS })}
          </p>

          <div className={`${s.planCards} mt-6`}>
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
                    {popular ? <span className={s.planBadge}>{say("pl_popular")}</span> : null}
                  </div>
                  <p className={`${s.planMeta} mt-1.5 min-h-10`}>
                    {business ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}
                  </p>
                  <p className={`${s.planPrice} mt-8 !text-start [overflow-wrap:anywhere]`}>{plan.monthly === 0 ? say("pl_free") : price(period(prices.monthly))}</p>
                  <p className={`${s.planMeta} mt-2 min-h-6`}>
                    {plan.monthly === 0 ? say("pl_forever") : yearly ? say("pl_perYear", { monthly: price(perMonthOfYear(period(prices.monthly))) }) : say("bl_perMonth")}
                  </p>
                  <SiteLink className={`${s.btn} ${popular ? s.btnSignal : s.btnInk} mt-6 w-full`} href={SITE_LINKS.signUp}>
                    {plan.monthly === 0 ? t("pricingStartFree") : t("ctaTrial")}
                  </SiteLink>
                  <ul className={`${s.planList} mt-6`}>
                    {differences(plan, say, (value) => value.toLocaleString(nl)).map((line) => (
                      <li key={line}>
                        <Check aria-hidden="true" size={16} strokeWidth={2.5} />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                      </li>
                    ))}
                  </ul>
                  {business ? (
                    <p className={`${s.planMeta} mt-4 border-t border-[var(--line)] pt-4`}>
                      {say("pl_businessIncludes", { fleet: fleetText(BUSINESS_INCLUDED, say) })}{" "}
                      {say("pl_businessExtra", { car: price(period(prices.extraCar)), motorbike: price(period(prices.extraMotorbike)) })}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
        </Container>
      </section>

      <Container>
        <p className="mt-6 max-w-[760px] text-[14.5px] text-[var(--text-muted)]">
          {say("pl_bikesNote")} {currency !== "THB" ? t("pricingCurrencyNote", { currency }) : ""}
        </p>
      </Container>

      <section className={s.section}>
        <Container className={s.split}>
          <div className={s.splitSticky}>
            <h2 className={s.h2}>{say("pl_everyTitle")}</h2>
            <p className={`${s.lede} mt-5`}>{say("pl_everyBody")}</p>
          </div>
          <ul className={s.index}>
            {included.map((key) => (
              <li className={`${s.indexItem} flex items-start gap-3 !pb-5 text-[17px] font-semibold`} key={key}>
                <Check aria-hidden="true" className="mt-1 shrink-0 text-[var(--primary)]" size={18} strokeWidth={2.5} />
                {t(`incl${key}`, { count: supportedLocaleCodes.length })}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="pb-[clamp(88px,11vw,168px)]">
        <Container className={s.split}>
          <div className={s.splitSticky}>
            <h2 className={s.h2}>{t("pricingFaqTitle")}</h2>
          </div>
          <div className={s.faq}>
            {faqs.map((key) => (
              <details className={s.faqItem} key={key}>
                <summary>
                  {t(`pfaq${key}Q`)}
                  <Plus aria-hidden="true" size={20} />
                </summary>
                <p>{t(`pfaq${key}A`, faqValues[key] || {})}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta showPricing={false} />
    </>
  );
}
