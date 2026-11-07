"use client";

import { useState, type FormEvent } from "react";
import { MapPin, MessageCircle, Star } from "lucide-react";
import { kindsOffered, socialHref } from "@/lib/sites/format";
import type { ResolvedImage } from "@/lib/sites/images";
import { fitLongestWord, Txt, useSite, useSiteTime } from "../site-context";
import { SiteImage } from "../site-image";
import { imageTreatment } from "./parts";
import s from "../site.module.css";

/** The lowest day price on the page, else the lowest month price, in the business's currency ("€35", "Rp 75,000"). */
function useFrom(): { per: "day" | "month"; amount: string } | null {
  const { data, money } = useSite();
  const lowest = (values: number[]) => (values.length ? Math.min(...values) : null);
  const day = lowest(data.vehicles.map((vehicle) => vehicle.dailyRate).filter((rate) => rate > 0));
  const month = lowest(data.vehicles.map((vehicle) => vehicle.monthlyRate).filter((rate) => rate > 0));
  if (data.catalog.offer !== "monthly" && day) return { per: "day", amount: money(day) };
  if (month) return { per: "month", amount: money(month) };
  return day ? { per: "day", amount: money(day) } : null;
}

/** The lowest price as a line: "From €35 a day". */
export function useFromLine() {
  const { t } = useSite();
  const from = useFrom();
  return from ? t(from.per === "day" ? "from_day" : "from_month", { amount: from.amount }) : null;
}

/** Today's opening hours, when set (on the business's week: Monday first). */
function useToday() {
  const { config, t } = useSite();
  const time = useSiteTime();
  if (!config.hours) return null;
  const day = config.hours[(new Date().getDay() + 6) % 7];
  return day ? t("open_today", { from: time(day.open), until: time(day.close) }) : t("closed_today");
}

export type Fact = { value: string; label: string; star?: boolean };

/** Real figures from the business (never made up): vehicles, lowest price, rating, delivery radius. */
export function useFacts(all = false): Fact[] {
  const { data, t } = useSite();
  // "From €35 a day" without its lead-in ("€35 a day"), whatever the language and currency symbol ("kr 690", "AED 99").
  const from = useFrom();
  const fromValue = from ? `${from.amount}${t(from.per === "day" ? "from_day" : "from_month", { amount: "\u0001" }).split("\u0001")[1] || ""}`.trim() : null;
  const delivery = data.areas.find((area) => area.radiusKm && area.radiusKm > 0);
  return [
    { value: String(data.vehicles.length), label: t("fact_vehicles", { count: data.vehicles.length }) },
    fromValue ? { value: fromValue, label: t("fact_from") } : null,
    data.reviewStats.count > 0 ? { value: data.reviewStats.average.toFixed(1), label: t("fact_rating", { count: data.reviewStats.count }), star: true } : null,
    (all || !data.reviewStats.count) && delivery ? { value: `${delivery.radiusKm} km`, label: t("fact_delivery") } : null
  ].filter(Boolean) as Fact[];
}

export function Hero() {
  const { template } = useSite();
  switch (template.layout.hero) {
    case "poster":
      return <PosterHero />;
    case "split":
      return <SplitHero />;
    case "fullbleed":
      return <FullbleedHero />;
    case "bigtype":
      return <BigtypeHero />;
    case "collage":
      return <CollageHero />;
    case "frame":
      return <FrameHero />;
    case "cover":
      return <CoverHero />;
    case "search":
      return <SearchHero />;
    default:
      return <PostcardHero />;
  }
}

/** Coast: one big rounded photo with the headline on it, and a booking bar resting on its lower edge. */
function PostcardHero() {
  const { images, data, template, t } = useSite();
  const from = useFromLine();
  const photo = images.hero.type === "url";
  // Villa's arch; Coast's photo stays as it was.
  const shape = template.image === "arch" ? `${s.arch} ` : "";
  return (
    <section aria-labelledby="hero-title" className="pb-4 pt-2 sm:pt-4">
      <div className={s.wrap}>
        <div className={`${s.image} ${shape}isolate ${photo ? "aspect-[4/5] sm:aspect-[16/10] lg:aspect-[16/8.2]" : "aspect-[2/3] sm:aspect-[16/11] lg:aspect-[16/9]"}`}>
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
  const { images, data, config, template, t } = useSite();
  const from = useFromLine();
  const whatsapp = socialHref("whatsapp", config.social.whatsapp || data.business.whatsapp);
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden pb-10 pt-4 sm:pb-16">
      <div className={`${s.wrap} grid items-center gap-8 lg:grid-cols-[1.05fr_1fr] lg:gap-6`}>
        <div className="relative z-10">
          <Txt as="h1" id="hero-title" className={`${s.display} ${template.id === "moto" ? "text-[68px] sm:text-[112px] lg:text-[132px]" : "text-[56px] sm:text-[88px] lg:text-[100px]"}`} slot="hero.headline" />
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
          <div className={`${s.image} ${imageTreatment(template)} aspect-[4/3] lg:aspect-[4/5]`}>
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
  const { images, data, template, t } = useSite();
  const today = useToday();
  const facts = useFacts();
  return (
    <section aria-labelledby="hero-title" className="pb-12 pt-6 sm:pb-20 sm:pt-12">
      <div className={`${s.wrap} grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-16`}>
        <div>
          {data.business.place ? (
            <p className="inline-flex items-center gap-1.5 rounded-full bg-[var(--s-accent-soft)] px-3.5 py-1.5 text-[14px] font-semibold text-[var(--s-ink)]">
              <MapPin aria-hidden="true" className="text-[var(--s-accent-text)]" size={15} />
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
                    {fact.star ? <Star aria-hidden="true" className="fill-[var(--s-accent-text)] text-[var(--s-accent-text)]" size={20} /> : null}
                  </dd>
                  <dd className={`${s.muted} mt-1 text-[14px] leading-snug`}>{fact.label}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
        <div className="relative">
          <div className={`${s.image} aspect-[5/4] shadow-[0_30px_80px_-40px_rgba(10,25,40,0.5)]${imageTreatment(template) ? ` ${imageTreatment(template)}` : ""}`}>
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

/* Phase 2 (sites2) heroes. */

function Place({ className = "" }: { className?: string }) {
  const { data } = useSite();
  if (!data.business.place) return null;
  return (
    <p className={`flex items-center gap-1.5 text-[15px] font-semibold ${className}`}>
      <MapPin aria-hidden="true" size={16} />
      {data.business.place}
    </p>
  );
}

/** The main button and the lowest price beside it. */
function CtaRow({ className = "", fromClass = "" }: { className?: string; fromClass?: string }) {
  const from = useFromLine();
  return (
    <div className={`flex flex-wrap items-center gap-x-6 gap-y-3 ${className}`}>
      <a className={s.btn} href="#book">
        <Txt slot="hero.cta" />
      </a>
      {from ? <p className={`text-[17px] font-semibold ${fromClass}`}>{from}</p> : null}
    </div>
  );
}

/** Riviera, Trail, Neon: the photo edge to edge, the headline low on it. */
function FullbleedHero() {
  const { images, template, palette } = useSite();
  const photo = images.hero.type === "url";
  const slant = template.image === "slant";
  // Light art gets a panel behind the words; dark art fades into the page under them.
  const panel = !photo && !palette.dark;
  return (
    <section aria-labelledby="hero-title" className="relative">
      <div
        className="relative isolate h-[calc(100svh-64px)] max-h-[880px] min-h-[540px] overflow-hidden"
        style={slant ? { clipPath: "polygon(0 0, 100% 0, 100% 94%, 0 100%)" } : undefined}
      >
        <SiteImage image={images.hero} priority settle />
        {panel ? null : (
          <div
            aria-hidden="true"
            className={`absolute inset-0 ${photo ? "bg-[linear-gradient(to_top,rgba(0,0,0,0.72),rgba(0,0,0,0.12)_55%,rgba(0,0,0,0.2))]" : "bg-[linear-gradient(to_top,var(--s-bg),color-mix(in_oklab,var(--s-bg)_50%,transparent)_45%,transparent_75%)]"}`}
          />
        )}
        <div className={`${s.wrap} absolute inset-x-0 bottom-0 pb-14 sm:pb-20 ${photo ? "text-white" : ""}`}>
          <div className={panel ? `${s.card} max-w-[760px] p-6 shadow-[0_24px_60px_-30px_rgba(10,20,30,0.45)] sm:p-10` : ""}>
            <Place className={photo ? "text-white/85" : s.soft} />
            <Txt as="h1" className={`${s.display} mt-4 max-w-[14ch] ${panel ? "text-[44px] sm:text-[68px] lg:text-[80px]" : "text-[50px] sm:text-[84px] lg:text-[108px]"}`} id="hero-title" slot="hero.headline" />
            <Txt as="p" className={`mt-5 max-w-[44ch] text-[18px] sm:text-[20px] ${photo ? "text-white/88" : s.soft}`} slot="hero.subline" />
            <CtaRow className="mt-8" fromClass={photo ? "text-white" : ""} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Reef, Washi, Block, Nomad: the headline is the picture; a wide photo strip under it. */
function BigtypeHero() {
  const { images, template } = useSite();
  const centered = template.header === "center";
  return (
    <section aria-labelledby="hero-title" className="relative pb-10 pt-10 sm:pb-16 sm:pt-16">
      <div className={`${s.wrap} relative`}>
        <div className={centered ? "mx-auto flex max-w-[980px] flex-col items-center text-center" : ""}>
          <Place className={s.soft} />
          <Txt as="h1" className={`${s.display} mt-5 text-[52px] sm:text-[96px] lg:text-[136px] ${centered ? "max-w-[16ch] lg:text-[96px]" : "max-w-[12ch]"}`} id="hero-title" slot="hero.headline" />
          <div className={`mt-8 flex flex-col gap-6 ${centered ? "items-center" : "lg:flex-row lg:items-end lg:justify-between"}`}>
            <Txt as="p" className={`${s.soft} max-w-[42ch] text-[18px] sm:text-[21px]`} slot="hero.subline" />
            <CtaRow className={centered ? "justify-center" : ""} fromClass="sm:text-[19px]" />
          </div>
        </div>
        <div className={`${s.image} ${imageTreatment(template)} mt-10 aspect-[4/3] sm:mt-14 sm:aspect-[21/9]`}>
          <SiteImage image={images.hero} priority settle />
        </div>
      </div>
    </section>
  );
}

/** A second and third picture for the collage: the About picture, then a vehicle photo not already shown. */
function useCollage(): [ResolvedImage, ResolvedImage] {
  const { images, data, template } = useSite();
  const used = [images.hero, images.about].map((image) => (image.type === "url" ? image.url : ""));
  const spare = data.vehicles.find((vehicle) => vehicle.photoUrl && !used.includes(vehicle.photoUrl));
  const second = images.about.type === "url" && images.about.url === used[0] ? ({ type: "art", id: template.art } as ResolvedImage) : images.about;
  const third: ResolvedImage = spare ? { type: "url", url: spare.photoUrl as string, alt: spare.name } : { type: "art", id: images.hero.type === "art" ? "bloom" : template.art };
  return [second, third];
}

/** Lagoon, Pier, Amber: words on one side, three pictures arranged on the other. */
function CollageHero() {
  const { images, template } = useSite();
  const [second, third] = useCollage();
  const treat = imageTreatment(template);
  return (
    <section aria-labelledby="hero-title" className="pb-12 pt-8 sm:pb-20 sm:pt-14">
      <div className={`${s.wrap} grid items-center gap-10 lg:grid-cols-[1fr_1.15fr] lg:gap-14`}>
        <div>
          <Place className={s.soft} />
          <Txt as="h1" className={`${s.display} mt-4 max-w-[13ch] text-[46px] sm:text-[68px] lg:text-[80px]`} id="hero-title" slot="hero.headline" />
          <Txt as="p" className={`${s.soft} mt-5 max-w-[42ch] text-[18px] sm:text-[20px]`} slot="hero.subline" />
          <CtaRow className="mt-8" />
        </div>
        <div className="grid aspect-[5/4] grid-cols-[1.3fr_1fr] grid-rows-2 gap-3 sm:gap-4">
          <div className={`${s.image} ${treat} row-span-2`}>
            <SiteImage image={images.hero} priority settle />
          </div>
          <div className={`${s.image} ${template.image === "arch" ? "" : treat}`}>
            <SiteImage image={second} />
          </div>
          <div className={`${s.image} ${template.image === "arch" ? "" : treat}`}>
            <SiteImage image={third} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Noir, Roam: a letterboxed, film-shaped picture, the headline under it. */
function FrameHero() {
  const { images, template, data, t } = useSite();
  return (
    <section aria-labelledby="hero-title" className="pb-12 pt-6 sm:pb-20 sm:pt-10">
      <div className={s.wrap}>
        <div className={`flex flex-wrap items-center justify-between gap-3 border-b pb-4 ${s.line}`}>
          <Place className={s.soft} />
          <p className={`${s.muted} text-[15px] font-semibold`}>{t("vehicles_ready", { count: data.vehicles.length })}</p>
        </div>
        <div className={`${s.image} ${imageTreatment(template)} mt-6 aspect-[4/5] sm:aspect-[2.39/1] lg:aspect-[2.8/1]`}>
          <SiteImage image={images.hero} priority settle />
        </div>
        <div className="mt-8 grid items-end gap-8 lg:mt-10 lg:grid-cols-[1.7fr_1fr] lg:gap-16">
          <Txt as="h1" className={`${s.display} max-w-[20ch] text-[44px] sm:text-[64px] lg:text-[76px]`} id="hero-title" slot="hero.headline" />
          <div>
            <Txt as="p" className={`${s.soft} max-w-[42ch] text-[18px]`} slot="hero.subline" />
            <CtaRow className="mt-7" />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Folio, Fjord: a magazine cover. The business name as the masthead, the picture, the headline as the cover line. */
function CoverHero() {
  const { images, template, data } = useSite();
  const from = useFromLine();
  return (
    <section aria-labelledby="hero-title" className="pb-12 pt-6 sm:pb-20 sm:pt-10">
      <div className={s.wrap}>
        <p className={`${s.display} ${s.masthead}`}>
          <span style={fitLongestWord(data.business.name)}>{data.business.name}</span>
        </p>
        <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 border-y py-3 text-[15px] font-semibold ${s.line}`}>
          <Place className={s.soft} />
          {from ? <span>{from}</span> : null}
        </div>
        <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:gap-12">
          <div className={`${s.image} ${imageTreatment(template)} aspect-[4/5] sm:aspect-[16/10]`}>
            <SiteImage image={images.hero} priority settle />
          </div>
          <div className="flex flex-col justify-end">
            <Txt as="h1" className={`${s.display} text-[40px] sm:text-[56px] lg:text-[60px]`} id="hero-title" slot="hero.headline" />
            <Txt as="p" className={`${s.soft} mt-5 max-w-[40ch] text-[18px]`} slot="hero.subline" />
            <a className={`${s.btn} mt-8 self-start`} href="#book">
              <Txt slot="hero.cta" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Adds days to a yyyy-mm-dd date. */
function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

/** Metro, Runway, Haven: a photo band with a search bar on its lower edge; searching opens the booking on those dates. */
function SearchHero() {
  const { images, data, t, searchDates } = useSite();
  const photo = images.hero.type === "url";
  const today = data.catalog.today;
  const kinds = kindsOffered(data.vehicles.map((vehicle) => vehicle.kind));
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(addDays(today, 3));
  const [kind, setKind] = useState("all");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    searchDates(start, end > start ? end : addDays(start, 1), kind);
  };
  const cell = `${s.searchCell} flex flex-col justify-center gap-1 px-5 py-3.5`;
  // The app's own field styles are switched off here: the cell is the field.
  const field = `${s.searchField} !h-auto !min-h-[30px] !w-full !rounded-none !border-0 !bg-transparent !p-0 !text-[16px] !font-semibold !text-[var(--s-ink)] !shadow-none !outline-none`;
  const label = `${s.muted} text-[13px] font-semibold`;
  return (
    <section aria-labelledby="hero-title" className="pb-10 pt-2 sm:pb-16 sm:pt-4">
      <div className={s.wrap}>
        <div className={`${s.image} isolate aspect-[4/5] sm:aspect-[16/9] lg:aspect-[16/7]`}>
          <SiteImage image={images.hero} priority settle />
          <div
            aria-hidden="true"
            className={`absolute inset-0 ${photo ? "bg-[linear-gradient(to_bottom,rgba(0,0,0,0.68),rgba(0,0,0,0.3)_45%,rgba(0,0,0,0.1)_70%,rgba(0,0,0,0.25))]" : "bg-[linear-gradient(to_bottom,var(--s-bg),color-mix(in_oklab,var(--s-bg)_75%,transparent)_40%,transparent_70%)]"}`}
          />
          <div className={`absolute inset-x-0 top-0 p-6 sm:p-12 lg:p-14 ${photo ? "text-white" : ""}`}>
            <Place className={photo ? "text-white/85" : s.soft} />
            <Txt as="h1" className={`${s.display} mt-3 max-w-[15ch] text-[44px] sm:text-[68px] lg:text-[84px]`} id="hero-title" slot="hero.headline" />
            <Txt as="p" className={`mt-4 max-w-[44ch] text-[18px] sm:text-[20px] ${photo ? "text-white/88" : s.soft}`} slot="hero.subline" />
          </div>
        </div>
        <form
          className={`${s.card} relative z-10 mx-2 -mt-16 grid overflow-hidden shadow-[0_24px_60px_-28px_rgba(10,20,30,0.5)] sm:mx-8 ${kinds.length > 1 ? "sm:grid-cols-[1fr_1fr_1fr_auto]" : "sm:grid-cols-[1fr_1fr_auto]"} divide-y sm:divide-x sm:divide-y-0 [&>*]:border-[var(--s-line)]`}
          onSubmit={submit}
        >
          <label className={cell}>
            <span className={label}>{t("search_pickup")}</span>
            <input className={field} min={today} onChange={(event) => setStart(event.target.value)} required type="date" value={start} />
          </label>
          <label className={cell}>
            <span className={label}>{t("search_return")}</span>
            <input className={field} min={addDays(start, 1)} onChange={(event) => setEnd(event.target.value)} required type="date" value={end} />
          </label>
          {kinds.length > 1 ? (
            <label className={cell}>
              <span className={label}>{t("search_kind")}</span>
              <select className={`${field} cursor-pointer`} onChange={(event) => setKind(event.target.value)} value={kind}>
                <option value="all">{t("filter_all")}</option>
                {kinds.map((value) => (
                  <option key={value} value={value}>
                    {t(`kind_${value}`)}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="p-3">
            <button className={`${s.btn} h-full w-full`} type="submit">
              <Txt slot="hero.cta" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
