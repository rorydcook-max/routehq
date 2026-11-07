"use client";

import { MapPin, MessageCircle, Star } from "lucide-react";
import { socialHref } from "@/lib/sites/format";
import { Txt, useSite } from "../site-context";
import { SiteImage } from "../site-image";
import s from "../site.module.css";

/** The lowest day price on the page, else the lowest month price, as "From ฿250 a day". */
export function useFromLine() {
  const { data, money, t } = useSite();
  const lowest = (values: number[]) => (values.length ? Math.min(...values) : null);
  const day = lowest(data.vehicles.map((vehicle) => vehicle.dailyRate).filter((rate) => rate > 0));
  const month = lowest(data.vehicles.map((vehicle) => vehicle.monthlyRate).filter((rate) => rate > 0));
  if (data.catalog.offer !== "monthly" && day) return t("from_day", { amount: money(day) });
  if (month) return t("from_month", { amount: money(month) });
  return day ? t("from_day", { amount: money(day) }) : null;
}

/** Today's opening hours, when set (on the business's week: Monday first). */
function useToday() {
  const { config, t } = useSite();
  if (!config.hours) return null;
  const day = config.hours[(new Date().getDay() + 6) % 7];
  return day ? t("open_today", { from: day.open, until: day.close }) : t("closed_today");
}

export function Hero() {
  const { template } = useSite();
  if (template.layout.hero === "poster") return <PosterHero />;
  if (template.layout.hero === "split") return <SplitHero />;
  return <PostcardHero />;
}

/** Coast: one big rounded photo with the headline on it, and a booking bar resting on its lower edge. */
function PostcardHero() {
  const { images, data, t } = useSite();
  const from = useFromLine();
  const photo = images.hero.type === "url";
  return (
    <section aria-labelledby="hero-title" className="pb-4 pt-2 sm:pt-4">
      <div className={s.wrap}>
        <div className={`${s.image} isolate ${photo ? "aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/8.2]" : "aspect-[2/3] sm:aspect-[16/11] lg:aspect-[16/9]"}`}>
          <SiteImage image={images.hero} priority settle />
          {photo ? <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.62),rgba(0,0,0,0.08)_58%,rgba(0,0,0,0.18))]" /> : null}
          <div className={`absolute inset-x-0 ${photo ? "bottom-0 p-6 pb-16 text-white sm:p-12 sm:pb-20 lg:p-16 lg:pb-24" : "top-0 p-6 pt-8 sm:p-12 lg:p-16"}`}>
            {data.business.place ? (
              <p className={`flex items-center gap-1.5 text-[15px] font-semibold ${photo ? "text-white/85" : s.soft}`}>
                <MapPin aria-hidden="true" size={16} />
                {data.business.place}
              </p>
            ) : null}
            <Txt as="h1" id="hero-title" className={`${s.display} mt-3 max-w-[13ch] text-[46px] sm:text-[72px] lg:text-[92px]`} slot="hero.headline" />
            <Txt as="p" className={`mt-4 max-w-[44ch] text-[18px] leading-relaxed sm:text-[20px] ${photo ? "text-white/88" : s.soft}`} slot="hero.subline" />
          </div>
        </div>
        <div className="relative z-10 mx-3 -mt-9 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-[calc(var(--s-r-card)*1.1)] bg-[var(--s-surface)] p-3 ps-5 shadow-[0_18px_50px_-24px_rgba(10,20,30,0.45)] sm:mx-auto sm:max-w-[640px] sm:rounded-full">
          <p className="min-w-0 text-[15px] leading-tight">
            <span className="block font-semibold">{t("vehicles_ready", { count: data.vehicles.length })}</span>
            {from ? <span className={`${s.muted} block`}>{from}</span> : null}
          </p>
          <a className={`${s.btn} max-sm:w-full`} href="#book">
            <Txt slot="hero.cta" />
          </a>
        </div>
      </div>
    </section>
  );
}

/** Moto: a poster. Huge condensed headline, the photo cut on a slant, the price as a sticker. */
function PosterHero() {
  const { images, data, config, t } = useSite();
  const from = useFromLine();
  const whatsapp = socialHref("whatsapp", config.social.whatsapp || data.business.whatsapp);
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pb-10 pt-4 sm:pb-16">
      <div className={`${s.wrap} grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6`}>
        <div className="relative z-10">
          <Txt as="h1" id="hero-title" className={`${s.display} text-[68px] sm:text-[112px] lg:text-[132px]`} slot="hero.headline" />
          <Txt as="p" className={`${s.soft} mt-5 max-w-[38ch] text-[18px] sm:text-[20px]`} slot="hero.subline" />
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a className={s.btn} href="#book">
              <Txt slot="hero.cta" />
            </a>
            {whatsapp ? (
              <a className={`${s.btn} ${s.btnGhost}`} href={whatsapp} rel="noopener noreferrer" target="_blank">
                <MessageCircle aria-hidden="true" size={18} />
                WhatsApp
              </a>
            ) : null}
          </div>
        </div>
        <div className="relative">
          <div className={`${s.image} ${s.slant} aspect-[4/3] lg:aspect-[4/5]`}>
            <SiteImage image={images.hero} priority settle />
          </div>
          {from ? (
            <p className="absolute -bottom-4 start-4 rotate-[-4deg] rounded-[var(--s-r-button)] bg-[var(--s-accent)] px-5 py-3 text-[20px] font-bold leading-none text-[var(--s-accent-ink)] shadow-[0_12px_30px_-12px_rgba(0,0,0,0.6)] sm:start-8 sm:text-[24px]">
              {from}
            </p>
          ) : null}
        </div>
      </div>
      <p className="sr-only">{t("vehicles_ready", { count: data.vehicles.length })}</p>
    </section>
  );
}

/** Summit: words on the left with real figures under them, the photo on the right. */
function SplitHero() {
  const { images, data, t } = useSite();
  const from = useFromLine();
  const today = useToday();
  const delivery = data.areas.find((area) => area.radiusKm && area.radiusKm > 0);
  const facts = [
    { value: String(data.vehicles.length), label: t("fact_vehicles", { count: data.vehicles.length }) },
    from ? { value: from.replace(/^[^\d฿$€£]*/, ""), label: t("fact_from") } : null,
    data.reviewStats.count > 0 ? { value: data.reviewStats.average.toFixed(1), label: t("fact_rating", { count: data.reviewStats.count }), star: true } : null,
    !data.reviewStats.count && delivery ? { value: `${delivery.radiusKm} km`, label: t("fact_delivery") } : null
  ].filter(Boolean) as Array<{ value: string; label: string; star?: boolean }>;
  return (
    <section aria-labelledby="hero-title" className="pb-12 pt-6 sm:pb-20 sm:pt-12">
      <div className={`${s.wrap} grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16`}>
        <div>
          {data.business.place ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--s-accent-soft)] px-3.5 py-1.5 text-[14px] font-semibold text-[var(--s-ink)]">
              <MapPin aria-hidden="true" className="text-[var(--s-accent)]" size={15} />
              {data.business.place}
            </p>
          ) : null}
          <Txt as="h1" id="hero-title" className={`${s.display} mt-5 text-[44px] sm:text-[60px] lg:text-[68px]`} slot="hero.headline" />
          <Txt as="p" className={`${s.soft} mt-5 max-w-[46ch] text-[18px]`} slot="hero.subline" />
          <div className="mt-8 flex flex-wrap gap-3">
            <a className={s.btn} href="#book">
              <Txt slot="hero.cta" />
            </a>
            <a className={`${s.btn} ${s.btnGhost}`} href="#fleet">
              {t("see_fleet")}
            </a>
          </div>
          {facts.length ? (
            <dl className={`mt-10 grid max-w-[520px] grid-cols-3 gap-4 border-t pt-6 ${s.line}`}>
              {facts.slice(0, 3).map((fact) => (
                <div key={fact.label}>
                  <dt className="sr-only">{fact.label}</dt>
                  <dd className={`${s.display} flex items-center gap-1 text-[26px] sm:text-[30px]`}>
                    {fact.value}
                    {fact.star ? <Star aria-hidden="true" className="fill-[var(--s-accent)] text-[var(--s-accent)]" size={20} /> : null}
                  </dd>
                  <dd className={`${s.muted} mt-1 text-[14px] leading-snug`}>{fact.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="relative">
          <div className={`${s.image} aspect-[5/4] shadow-[0_30px_80px_-40px_rgba(10,25,40,0.5)]`}>
            <SiteImage image={images.hero} priority settle />
          </div>
          {today ? (
            <p className="absolute -bottom-5 start-5 flex items-center gap-2 rounded-[var(--s-r-card)] bg-[var(--s-surface)] px-4 py-3 text-[15px] font-semibold shadow-[0_16px_40px_-20px_rgba(10,25,40,0.45)]">
              <span aria-hidden="true" className="h-2.5 w-2.5 rounded-full bg-[var(--s-accent)]" />
              {today}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
