import type { Metadata } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Check, ChevronDown, Sparkles } from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { BUSINESS_INCLUDED, FOUNDING_SLOTS, PLANS, TRIAL_DAYS, YEARLY_MONTHS, fleetText, type Plan } from "@/lib/plans";
import { formatPlanPrice, planCurrency, planPrices, yearlyOf } from "@/lib/plan-currency";
import { FinalCta } from "../_components/final-cta";
import { Container, SITE_LINKS, SectionHeading, SiteLink, r } from "../_components/site-ui";
import s from "../site.module.css";

/** Currencies offered in the switcher: Thai baht first, then the region's and visitors' usual ones. All are in lib/plan-currency.ts. */
const CURRENCIES = ["THB", "USD", "EUR", "GBP", "AUD", "SGD", "MYR", "IDR", "VND", "PHP", "LAK", "KHR", "MMK", "INR", "CNY", "JPY", "KRW"];

type Say = (key: string, values?: Record<string, string | number>) => string;

export async function generateMetadata(): Promise<Metadata> {
  const [t, locale] = await Promise.all([getTranslations("site"), getLocale()]);
  const cheapestPaid = PLANS.filter((plan) => plan.monthly > 0).sort((a, b) => a.monthly - b.monthly)[0];
  const title = t("metaPricingTitle");
  const description = t("metaPricingDescription", { price: formatPlanPrice(cheapestPaid.monthly, "THB", numberLocale(locale)), days: TRIAL_DAYS });
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
  const [t, settings, locale] = await Promise.all([getTranslations("site"), getTranslations("settingsPage"), getLocale()]);
  const say = settings as unknown as Say;
  const nl = numberLocale(locale);
  const yearly = params.billing === "yearly";
  const currency = planCurrency(CURRENCIES.includes(String(params.currency || "").toUpperCase()) ? String(params.currency).toUpperCase() : "THB");
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
    if (code !== "THB") query.set("currency", code);
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
  const toggle = (active: boolean) =>
    `inline-flex min-h-10 items-center rounded-full px-4 text-[15px] font-bold transition-colors ${active ? "bg-[var(--primary)] text-white" : "text-[var(--foreground-secondary)] hover:text-[var(--foreground)]"}`;

  return (
    <>
      <section className="relative isolate overflow-hidden">
        <div className={s.heroGlow} />
        <Container className="relative pb-10 pt-14 text-center sm:pt-20">
          <h1 className={`${s.display} mx-auto max-w-[760px] text-[2.5rem] sm:text-[3.4rem]`}>{t("pricingTitle")}</h1>
          <p className={`${s.lede} mx-auto mt-5 max-w-[620px] text-[1.125rem] leading-relaxed text-[var(--muted)]`}>{say("pl_subtitle")}</p>
          <p className="mx-auto mt-3 max-w-[620px] text-[16px] font-semibold text-[var(--foreground-secondary)]">{t("pricingTrial", { days: TRIAL_DAYS })}</p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <div aria-label={t("pricingBilling")} className="inline-flex rounded-full border border-[var(--border)] bg-white p-1" role="group">
              <Link aria-current={!yearly ? "true" : undefined} className={toggle(!yearly)} href={href({ billing: false })} scroll={false}>
                {say("pl_monthly")}
              </Link>
              <Link aria-current={yearly ? "true" : undefined} className={toggle(yearly)} href={href({ billing: true })} scroll={false}>
                {say("pl_yearly")}
                <span className={`ms-1.5 ${yearly ? "opacity-90" : "text-[var(--success)]"}`}>· {say("pl_monthsFree", { count: 12 - YEARLY_MONTHS })}</span>
              </Link>
            </div>
            {/* Keyed by the choice, so the list closes once a currency is picked. */}
            <details className={`${s.details} relative`} key={`${currency}-${yearly}`}>
              <summary aria-label={t("pricingCurrency")} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--border)] bg-white px-4 text-[15px] font-bold text-[var(--foreground-secondary)]">
                {currency} · {currencyName(currency)}
                <ChevronDown aria-hidden="true" className={s.chevron} size={16} />
              </summary>
              <ul className="absolute start-1/2 z-20 mt-2 max-h-[320px] w-[260px] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[var(--border)] bg-white p-1.5 text-start shadow-[0_24px_48px_-20px_rgba(19,38,43,0.35)] rtl:translate-x-1/2">
                {CURRENCIES.map((code) => (
                  <li key={code}>
                    <Link
                      aria-current={code === currency ? "true" : undefined}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[15px] ${code === currency ? "bg-[var(--primary-light)] font-bold text-[var(--primary)]" : "text-[var(--foreground)] hover:bg-[var(--panel-secondary)]"}`}
                      href={href({ currency: code })}
                      scroll={false}
                    >
                      <span className="truncate">{currencyName(code)}</span>
                      <span className="shrink-0 font-semibold text-[var(--muted)]">{code}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </details>
          </div>
        </Container>
      </section>

      <section className="pb-20">
        <Container>
          <p className="mx-auto flex max-w-[760px] items-center justify-center gap-2.5 rounded-2xl bg-[var(--success-light)] px-4 py-3 text-center text-[15px] font-semibold text-[var(--foreground)]">
            <Sparkles aria-hidden="true" className="shrink-0 text-[var(--success)]" size={18} />
            {t("foundingOffer", { count: FOUNDING_SLOTS })}
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {PLANS.map((plan) => {
              const popular = plan.id === "pro";
              const business = plan.id === "business";
              const prices = planPrices(plan, currency);
              return (
                <section
                  aria-labelledby={`plan-${plan.id}`}
                  className={`${s.surface} relative flex min-w-0 flex-col p-6 ${popular ? "!border-[var(--primary)] ring-1 ring-[var(--primary)]" : ""}`}
                  key={plan.id}
                >
                  <div className="flex min-h-7 items-center">
                    {popular ? <span className="rounded-full bg-[var(--primary)] px-3 py-1 text-[14px] font-bold text-white">{say("pl_popular")}</span> : null}
                  </div>
                  <h2 className="mt-3 text-[22px] font-semibold leading-tight text-[var(--foreground)]" id={`plan-${plan.id}`}>
                    {say(`bl_${plan.id}`)}
                  </h2>
                  <p className="mt-1 min-h-12 text-[15px] font-semibold text-[var(--foreground-secondary)]">
                    {business ? say("pl_anySize") : say("pl_upTo", { fleet: fleetText({ cars: plan.cars!, motorbikes: plan.motorbikes! }, say) })}
                  </p>
                  <p className={`${s.display} mt-5 text-[2.6rem] text-[var(--foreground)]`}>{plan.monthly === 0 ? say("pl_free") : price(period(prices.monthly))}</p>
                  <p className="mt-1 min-h-6 text-[15px] font-medium text-[var(--muted)]">
                    {plan.monthly === 0 ? say("pl_forever") : yearly ? say("pl_perYear", { monthly: price(perMonthOfYear(period(prices.monthly))) }) : say("bl_perMonth")}
                  </p>
                  <SiteLink className={`${popular ? s.btnPrimary : s.btnSecondary} mt-6 w-full`} href={SITE_LINKS.signUp}>
                    {plan.monthly === 0 ? t("pricingStartFree") : t("ctaTrial")}
                  </SiteLink>
                  <ul className="mt-6 space-y-2.5 border-t border-[var(--border)] pt-5 text-[15px] text-[var(--foreground)]">
                    {differences(plan, say, (value) => value.toLocaleString(nl)).map((line) => (
                      <li className="flex items-start gap-2.5" key={line}>
                        <Check aria-hidden="true" className="mt-1 shrink-0 text-[var(--success)]" size={16} strokeWidth={2.5} />
                        <span className="min-w-0 [overflow-wrap:anywhere]">{line}</span>
                      </li>
                    ))}
                  </ul>
                  {business ? (
                    <p className="mt-4 rounded-xl bg-[var(--panel-secondary)] px-3 py-2.5 text-[15px] text-[var(--foreground-secondary)]">
                      {say("pl_businessIncludes", { fleet: fleetText(BUSINESS_INCLUDED, say) })}{" "}
                      {say("pl_businessExtra", { car: price(period(prices.extraCar)), motorbike: price(period(prices.extraMotorbike)) })}
                    </p>
                  ) : null}
                </section>
              );
            })}
          </div>
          <p className="mx-auto mt-6 max-w-[760px] text-center text-[15px] text-[var(--muted)]">
            {say("pl_bikesNote")} {currency !== "THB" ? t("pricingCurrencyNote", { currency }) : ""}
          </p>
        </Container>
      </section>

      <section className={`${s.tint} py-20 sm:py-24`}>
        <Container>
          <SectionHeading body={say("pl_everyBody")} title={say("pl_everyTitle")} />
          <ul className="mx-auto mt-10 grid max-w-[960px] gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            {included.map((key) => (
              <li className="flex items-start gap-3 text-[16px] font-semibold text-[var(--foreground)]" key={key}>
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-[0_1px_2px_rgba(19,38,43,0.08)]">
                  <Check aria-hidden="true" size={14} strokeWidth={3} />
                </span>
                {t(`incl${key}`, { count: supportedLocaleCodes.length })}
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section className="py-20 sm:py-24">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <SectionHeading align="start" title={t("pricingFaqTitle")} />
          <div className="divide-y divide-[var(--border)] rounded-[24px] border border-[var(--border)] bg-white">
            {faqs.map((key) => (
              <details className={`${s.details} px-5 sm:px-7`} key={key}>
                <summary className="flex min-h-[64px] items-center justify-between gap-4 py-4 text-[17px] font-semibold text-[var(--foreground)]">
                  {t(`pfaq${key}Q`)}
                  <ChevronDown aria-hidden="true" className={`${s.chevron} shrink-0 text-[var(--muted)]`} size={20} />
                </summary>
                <p className="pb-5 pe-8 text-[16px] leading-relaxed text-[var(--muted)]">{t(`pfaq${key}A`, faqValues[key] || {})}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta showPricing={false} />
    </>
  );
}
