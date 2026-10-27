import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  Calculator,
  ChevronDown,
  Code2,
  FileCheck2,
  FileSpreadsheet,
  Globe,
  Handshake,
  Languages,
  MessagesSquare,
  QrCode,
  ScanLine,
  Search,
  ShieldCheck,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  Camera,
  Check,
  Link2,
  ReceiptText
} from "lucide-react";
import { numberLocale } from "@/lib/i18n/dates";
import { supportedLocaleCodes } from "@/lib/i18n/locales";
import { FINDERS_FEE_PCT, FOUNDING_SLOTS, PLANS, TRIAL_DAYS, fleetText } from "@/lib/plans";
import { formatPlanPrice } from "@/lib/plan-currency";
import { BookingPhoneMock, DashboardLaptopMock, HandoverPhoneMock, PaidToast, PaymentPhoneMock, TodayPhoneMock } from "../_components/mockups";
import { Container, SITE_LINKS, SectionHeading, SiteLink } from "../_components/site-ui";
import { FinalCta } from "../_components/final-cta";
import s from "../site.module.css";

const LANGUAGE_COUNT = supportedLocaleCodes.length;

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
  const [t, settings, locale] = await Promise.all([getTranslations("site"), getTranslations("settingsPage"), getLocale()]);
  const say = settings as unknown as (key: string, values?: Record<string, string | number>) => string;
  const nl = numberLocale(locale);
  const free = PLANS.find((plan) => plan.monthly === 0)!;
  const cheapestPaid = PLANS.filter((plan) => plan.monthly > 0).sort((a, b) => a.monthly - b.monthly)[0];
  const fromPrice = formatPlanPrice(cheapestPaid.monthly, "THB", nl);

  const rows = [
    {
      key: "f1",
      icon: Link2,
      points: [ScanLine, FileCheck2, Wallet],
      visual: <BookingPhoneMock />
    },
    {
      key: "f2",
      icon: Camera,
      points: [Camera, Check, FileCheck2],
      visual: <HandoverPhoneMock />
    },
    {
      key: "f3",
      icon: QrCode,
      points: [QrCode, ReceiptText, ShieldCheck],
      visual: <PaymentPhoneMock />
    }
  ];

  const grid = [
    { icon: Bell, key: "Reminders" },
    { icon: MessagesSquare, key: "Inbox" },
    { icon: CalendarDays, key: "Calendar" },
    { icon: FileCheck2, key: "Paperwork" },
    { icon: TrendingUp, key: "Reports" },
    { icon: Handshake, key: "Owners" },
    { icon: Users, key: "Team" },
    { icon: Languages, key: "Languages" },
    { icon: FileSpreadsheet, key: "Importer" },
    { icon: Calculator, key: "Calculator" }
  ];

  const grow = [
    { icon: Globe, key: "BookingPage" },
    { icon: Search, key: "Directory" },
    { icon: Code2, key: "Widget" },
    { icon: Handshake, key: "Partners" }
  ];

  const steps = [
    { icon: Upload, key: "step1" },
    { icon: Link2, key: "step2" },
    { icon: Wallet, key: "step3" }
  ];

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

      {/* ── Hero ── */}
      <section className="relative isolate overflow-hidden">
        <div className={s.heroGlow} />
        <div className={s.heroGrid} />
        <Container className="relative grid items-center gap-12 pb-16 pt-12 sm:pt-16 lg:grid-cols-[1fr_1.15fr] lg:gap-10 lg:pb-24 lg:pt-20">
          <div className="max-w-[600px]">
            <p className={s.eyebrow}>
              <span className="inline-block h-2 w-2 rounded-full bg-[var(--accent)]" />
              {t("heroEyebrow")}
            </p>
            <h1 className={`${s.display} mt-4 text-[2.6rem] text-[var(--foreground)] sm:text-[3.4rem] lg:text-[4rem]`}>{t("heroTitle")}</h1>
            <p className={`${s.lede} mt-5 max-w-[540px] text-[1.125rem] leading-relaxed text-[var(--muted)] sm:text-[1.2rem]`}>{t("heroBody")}</p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <SiteLink className={s.btnPrimary} href={SITE_LINKS.signUp}>
                {t("ctaTrial")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
              </SiteLink>
              <SiteLink className={s.btnSecondary} href={SITE_LINKS.pricing}>
                {t("heroSecondary")}
              </SiteLink>
            </div>
            <p className="mt-4 text-[15px] text-[var(--muted)]">{t("heroNote", { days: TRIAL_DAYS })}</p>
          </div>

          {/* Phones: the operator's day on a phone. Larger screens: the dashboard, with a customer's booking link in front. */}
          <div className="relative">
            <div className="mx-auto w-[78%] max-w-[300px] sm:hidden">
              <TodayPhoneMock />
              <PaidToast className="relative mx-auto -mt-14 w-max max-w-full" />
            </div>
            <div className="relative hidden sm:block sm:pb-10 sm:ps-[12%] lg:ps-[14%]">
              <DashboardLaptopMock />
              <div className="absolute bottom-0 start-0 w-[30%] max-w-[230px]">
                <BookingPhoneMock />
              </div>
              <PaidToast className="absolute -top-5 end-2 hidden md:flex" />
            </div>
          </div>
        </Container>
      </section>

      {/* ── What we can honestly say ── */}
      <section aria-label={t("proofLabel")} className="border-y border-[var(--border)] bg-white">
        <Container className="grid grid-cols-2 gap-x-6 gap-y-4 py-6 md:grid-cols-4">
          {[
            { icon: Handshake, text: t("proofBuilt") },
            { icon: Languages, text: t("proofLanguages", { count: LANGUAGE_COUNT }) },
            { icon: MessagesSquare, text: t("proofChat") },
            { icon: QrCode, text: t("proofPromptPay") }
          ].map(({ icon: Icon, text }) => (
            <p className="flex items-center gap-2.5 text-[15px] font-semibold text-[var(--foreground-secondary)]" key={text}>
              <Icon aria-hidden="true" className="shrink-0 text-[var(--primary)]" size={18} />
              {text}
            </p>
          ))}
        </Container>
      </section>

      {/* ── The problem, in one breath ── */}
      <section className="py-20 sm:py-28">
        <Container>
          <SectionHeading body={t("introBody")} title={t("introTitle")} />
        </Container>
      </section>

      {/* ── Three things it does best ── */}
      <section className="pb-8" id="features">
        <Container className="space-y-20 sm:space-y-28">
          {rows.map((row, index) => {
            const Icon = row.icon;
            return (
              <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16" key={row.key}>
                <div className={index % 2 ? "lg:order-2" : ""}>
                  <div className="flex items-center gap-3">
                    <span className={s.iconTile}>
                      <Icon aria-hidden="true" size={22} />
                    </span>
                    <p className={s.eyebrow}>{t(`${row.key}Eyebrow`)}</p>
                  </div>
                  <h2 className={`${s.display} mt-4 text-[2rem] sm:text-[2.5rem]`}>{t(`${row.key}Title`)}</h2>
                  <p className={`${s.lede} mt-4 text-[1.0625rem] leading-relaxed text-[var(--muted)]`}>{t(`${row.key}Body`)}</p>
                  <ul className="mt-6 space-y-3">
                    {row.points.map((PointIcon, point) => (
                      <li className="flex items-start gap-3 text-[16px] font-semibold text-[var(--foreground)]" key={point}>
                        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
                          <PointIcon aria-hidden="true" size={14} strokeWidth={2.5} />
                        </span>
                        {t(`${row.key}Point${point + 1}`)}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${s.tint} relative flex justify-center overflow-hidden rounded-[32px] px-6 py-8 sm:py-14 ${index % 2 ? "lg:order-1" : ""}`}>
                  <div className="w-[58%] max-w-[270px] sm:w-[72%]">{row.visual}</div>
                </div>
              </div>
            );
          })}
        </Container>
      </section>

      {/* ── Everything else ── */}
      <section className="py-20 sm:py-28">
        <Container>
          <SectionHeading body={t("gridBody")} title={t("gridTitle")} />
          {/* Phones: one grouped list (icon beside the text). Larger screens: separate tiles. */}
          <div className={`${s.featList} mt-10 sm:mt-12`}>
            {grid.map(({ icon: Icon, key }) => (
              <div className={s.featItem} key={key}>
                <span className={s.iconTile}>
                  <Icon aria-hidden="true" size={20} />
                </span>
                <div className="min-w-0">
                  <h3 className="text-[16px] font-semibold leading-snug text-[var(--foreground)] sm:mt-4 sm:text-[17px]">{t(`grid${key}Title`, { count: LANGUAGE_COUNT })}</h3>
                  <p className="mt-1 text-[15px] leading-relaxed text-[var(--muted)] sm:mt-1.5">{t(`grid${key}Body`)}</p>
                </div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Bookings coming in ── */}
      <section className="relative overflow-hidden bg-[var(--primary)] py-20 text-white sm:py-28">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_85%_-10%,rgba(255,255,255,0.14),transparent_60%),radial-gradient(700px_380px_at_0%_110%,rgba(0,0,0,0.18),transparent_60%)]" />
        <Container className="relative">
          <div className="max-w-[680px]">
            <p className="font-semibold text-[#9fd6cd]">{t("growEyebrow")}</p>
            <h2 className={`${s.display} mt-3 text-[2rem] text-white sm:text-[2.6rem]`}>{t("growTitle")}</h2>
            <p className={`${s.lede} mt-4 text-[1.0625rem] leading-relaxed text-white/80 sm:text-[1.125rem]`}>{t("growBody")}</p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {grow.map(({ icon: Icon, key }) => (
              <div className="rounded-[24px] border border-white/12 bg-white/[0.07] p-5 backdrop-blur-sm" key={key}>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-white/12 text-white">
                  <Icon aria-hidden="true" size={20} />
                </span>
                <h3 className="mt-4 text-[17px] font-semibold text-white">{t(`grow${key}Title`)}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-white/80">{t(`grow${key}Body`, { pct: FINDERS_FEE_PCT })}</p>
              </div>
            ))}
          </div>
          <SiteLink className="mt-10 inline-flex items-center gap-2 font-semibold text-white underline-offset-4 hover:underline" href={SITE_LINKS.directory}>
            {t("growDirectoryLink")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
          </SiteLink>
        </Container>
      </section>

      {/* ── How it works ── */}
      <section className="py-20 sm:py-28">
        <Container>
          <SectionHeading eyebrow={t("howEyebrow")} title={t("howTitle")} />
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <span aria-hidden="true" className="absolute start-[16%] end-[16%] top-7 hidden h-px bg-[linear-gradient(90deg,transparent,var(--border-strong)_15%,var(--border-strong)_85%,transparent)] md:block" />
            {steps.map(({ icon: Icon, key }, index) => (
              <li className="relative text-center" key={key}>
                <span className="relative mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-[var(--border)] bg-white text-[var(--primary)] shadow-[0_8px_24px_-12px_rgba(14,94,111,0.45)]">
                  <Icon aria-hidden="true" size={22} />
                  <span className="absolute -end-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--primary)] text-[13px] font-bold text-white">{index + 1}</span>
                </span>
                <h3 className="mt-5 text-[19px] font-semibold text-[var(--foreground)]">{t(`${key}Title`)}</h3>
                <p className="mx-auto mt-2 max-w-[320px] text-[15px] leading-relaxed text-[var(--muted)]">{t(`${key}Body`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      {/* ── Pricing and owners, side by side ── */}
      <section className="pb-20 sm:pb-28">
        <Container className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className={`${s.surface} flex flex-col p-7 sm:p-9`}>
            <p className={s.eyebrow}>{t("navPricing")}</p>
            <h2 className={`${s.display} mt-2 text-[1.9rem] sm:text-[2.2rem]`}>{t("priceTeaserTitle")}</h2>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-[var(--muted)]">
              {t("priceTeaserBody", { fleet: fleetText({ cars: free.cars!, motorbikes: free.motorbikes! }, say), price: fromPrice })}
            </p>
            <p className="mt-5 rounded-2xl bg-[var(--success-light)] px-4 py-3 text-[15px] font-semibold text-[var(--foreground)]">{t("foundingOffer", { count: FOUNDING_SLOTS })}</p>
            <div className="mt-auto pt-7">
              <SiteLink className={s.btnSecondary} href={SITE_LINKS.pricing}>
                {t("priceTeaserLink")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
              </SiteLink>
            </div>
          </div>
          <div className={`${s.surface} flex flex-col p-7 sm:p-9`}>
            <p className={s.eyebrow}>{t("navOwners")}</p>
            <h2 className={`${s.display} mt-2 text-[1.9rem] sm:text-[2.2rem]`}>{t("ownersTeaserTitle")}</h2>
            <p className="mt-3 text-[1.0625rem] leading-relaxed text-[var(--muted)]">{t("ownersTeaserBody")}</p>
            <div className="mt-auto pt-7">
              <SiteLink className={s.btnSecondary} href={SITE_LINKS.owners}>
                {t("ownersTeaserLink")} <ArrowRight aria-hidden="true" className="rtl:rotate-180" size={18} />
              </SiteLink>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Questions ── */}
      <section className={`${s.tint} py-20 sm:py-28`}>
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.6fr] lg:gap-16">
          <SectionHeading align="start" body={t("faqBody")} title={t("faqTitle")} />
          <div className="divide-y divide-[var(--border)] rounded-[24px] border border-[var(--border)] bg-white">
            {faqs.map((key) => (
              <details className={`${s.details} group px-5 sm:px-7`} key={key}>
                <summary className="flex min-h-[64px] items-center justify-between gap-4 py-4 text-[17px] font-semibold text-[var(--foreground)]">
                  {t(`faq${key}Q`)}
                  <ChevronDown aria-hidden="true" className={`${s.chevron} shrink-0 text-[var(--muted)]`} size={20} />
                </summary>
                <p className="pb-5 pe-8 text-[16px] leading-relaxed text-[var(--muted)]">{t(`faq${key}A`, faqValues[key] || {})}</p>
              </details>
            ))}
          </div>
        </Container>
      </section>

      <FinalCta />
    </>
  );
}
