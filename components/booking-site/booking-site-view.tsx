"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, Clock, MapPin } from "lucide-react";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";
import { mapLinks, sitePrice, socialHref, SOCIAL_KEYS, type BookingSite, type SiteSection, type SiteSocial } from "@/lib/booking-site";

/**
 * A business's booking page in one of the templates (lib/booking-site.ts). The booking part (the Catalog, passed in
 * as children) is the same in every template; around it each template has its own top, layout and sections.
 * Phones first: most renters book on a phone.
 */

export type SiteBusiness = {
  name: string;
  logoUrl: string | null;
  location: string;
  address: string;
  currency: string;
  /** How customers reach the business, from Settings > Business (the social section starts from these). */
  contacts: { whatsapp: string; line: string; instagram: string; facebook: string };
};

type Props = {
  site: BookingSite;
  business: SiteBusiness;
  /** The big photo: their own, else their first vehicle photo, else none (a colour block instead). */
  heroUrl: string | null;
  /** Lowest monthly and daily prices on the page (for "From ... a month"), when any. */
  fromMonthly: number | null;
  fromDaily: number | null;
  vehicleCount: number;
  /** An example business on rovehq.io: says so at the top. */
  demo?: boolean;
  /** A small, still picture (settings and the website's examples): no language pill, no sticky bar. */
  preview?: boolean;
  children: ReactNode;
};

type Say = (key: string, values?: Record<string, string | number>) => string;

const ICONS: Record<keyof SiteSocial, string> = {
  facebook: "ti-brand-facebook",
  instagram: "ti-brand-instagram",
  line: "ti-brand-line",
  tiktok: "ti-brand-tiktok",
  whatsapp: "ti-brand-whatsapp"
};
const LABELS: Record<keyof SiteSocial, string> = { facebook: "Facebook", instagram: "Instagram", line: "LINE", tiktok: "TikTok", whatsapp: "WhatsApp" };

/** Each template's few styling choices for the shared sections. */
const LOOK = {
  photo: { title: "text-[24px] font-bold tracking-[-0.01em] sm:text-[28px]", card: "rounded-[22px] bg-white p-5 shadow-[var(--shadow-card)]", gap: "space-y-10 sm:space-y-14" },
  compact: { title: "text-[18px] font-bold", card: "rounded-xl border border-[var(--border)] bg-white p-4", gap: "space-y-5" },
  monthly: { title: "text-[24px] font-semibold tracking-[-0.015em] sm:text-[30px]", card: "rounded-[20px] border border-[var(--border)] bg-white p-5 sm:p-6", gap: "space-y-10 sm:space-y-14" },
  scooter: { title: "text-[26px] font-black tracking-[-0.03em] sm:text-[32px]", card: "rounded-[26px] bg-white p-5 shadow-[0_2px_0_rgba(19,38,43,0.08)] ring-2 ring-[var(--primary)]/10", gap: "space-y-8 sm:space-y-12" }
} as const;
type Look = (typeof LOOK)[keyof typeof LOOK];

function socialLinks(site: BookingSite, business: SiteBusiness) {
  const fallback: Partial<SiteSocial> = { whatsapp: business.contacts.whatsapp, line: business.contacts.line, instagram: business.contacts.instagram, facebook: business.contacts.facebook };
  return SOCIAL_KEYS.map((key) => {
    const value = site.social[key] || fallback[key] || "";
    const href = value ? socialHref(key, value) : null;
    return href ? { key, href } : null;
  }).filter(Boolean) as Array<{ key: keyof SiteSocial; href: string }>;
}

/** Opening hours, Monday first, with the day names in the renter's language. */
function HoursList({ hours, closed, className = "" }: { hours: NonNullable<BookingSite["hours"]>; closed: string; className?: string }) {
  const locale = useLocale();
  const dayName = (index: number) => new Intl.DateTimeFormat(locale, { weekday: "long", timeZone: "UTC" }).format(new Date(Date.UTC(2024, 0, 1 + index)));
  return (
    <dl className={`divide-y divide-[var(--border)] ${className}`}>
      {hours.map((day, index) => (
        <div className="flex items-center justify-between gap-4 py-2.5 text-[15px]" key={index}>
          <dt className="font-semibold text-[var(--foreground)]">{dayName(index)}</dt>
          <dd className={day ? "tabular-nums text-[var(--foreground-secondary)]" : "text-[var(--muted)]"}>{day ? `${day.open} – ${day.close}` : closed}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A section with its title; in the compact template, folded so the vehicles stay near the top. */
function Section({ id, title, look, folded, children }: { id: string; title: string; look: Look; folded?: boolean; children: ReactNode }) {
  if (folded) {
    return (
      <details className={`${look.card} group`} id={id}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
          <h2 className={look.title}>{title}</h2>
          <ChevronDown aria-hidden="true" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" size={20} />
        </summary>
        <div className="mt-3">{children}</div>
      </details>
    );
  }
  return (
    <section aria-labelledby={`${id}-title`} id={id}>
      <h2 className={`${look.title} text-[var(--foreground)]`} id={`${id}-title`}>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** The sections in the owner's order, each only when it is on and has something real to show. */
function useSections({ site, business, look, folded, skip = [] }: { site: BookingSite; business: SiteBusiness; look: Look; folded?: boolean; skip?: SiteSection[] }) {
  const t = useTranslations("customer") as unknown as Say;
  const on = (id: Exclude<SiteSection, "vehicles">) => !site.off.includes(id) && !skip.includes(id);
  const social = socialLinks(site, business);
  const mapQuery = site.mapQuery || business.address || business.location;

  const render = (id: SiteSection): ReactNode => {
    switch (id) {
      case "about":
        return on("about") && site.about ? (
          <Section folded={folded} id="about" key={id} look={look} title={t("bs_about")}>
            <p className="max-w-[68ch] whitespace-pre-line text-[16px] leading-7 text-[var(--foreground-secondary)]">{site.about}</p>
          </Section>
        ) : null;
      case "why":
        return on("why") && site.why.length ? (
          <Section folded={folded} id="why" key={id} look={look} title={t("bs_why")}>
            <ul className="grid gap-3 sm:grid-cols-2">
              {site.why.map((line) => (
                <li className="flex items-start gap-3 text-[16px] font-semibold leading-6 text-[var(--foreground)]" key={line}>
                  <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white">
                    <i className="ti ti-check text-[14px]" />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </Section>
        ) : null;
      case "faqs":
        return on("faqs") && site.faqs.length ? (
          <Section folded={folded} id="faqs" key={id} look={look} title={t("bs_faqs")}>
            <div className="divide-y divide-[var(--border)] border-y border-[var(--border)]">
              {site.faqs.map((faq) => (
                <details className="group py-1" key={faq.q}>
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 text-[16px] font-semibold text-[var(--foreground)] [&::-webkit-details-marker]:hidden">
                    {faq.q}
                    <ChevronDown aria-hidden="true" className="shrink-0 text-[var(--muted)] transition-transform group-open:rotate-180" size={18} />
                  </summary>
                  <p className="pb-3 whitespace-pre-line text-[15px] leading-6 text-[var(--foreground-secondary)]">{faq.a}</p>
                </details>
              ))}
            </div>
          </Section>
        ) : null;
      case "reviews":
        // Only a link to their real reviews: RoveHQ never shows reviews it made up.
        return on("reviews") && site.reviewsUrl ? (
          <Section folded={folded} id="reviews" key={id} look={look} title={t("bs_reviews")}>
            <div className={`${look.card} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}>
              <p className="text-[15px] leading-6 text-[var(--foreground-secondary)]">{t("bs_reviewsBody")}</p>
              <a className="pressable inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-full border-2 border-[var(--primary)] px-5 text-[15px] font-bold text-[var(--primary)]" href={site.reviewsUrl} rel="noopener noreferrer" target="_blank">
                <i aria-hidden="true" className="ti ti-brand-google text-[18px]" />
                {t("bs_reviewsOpen")}
              </a>
            </div>
          </Section>
        ) : null;
      case "map": {
        if (!on("map") || !mapQuery) return null;
        const links = mapLinks(mapQuery);
        return (
          <Section folded={folded} id="map" key={id} look={look} title={t("bs_map")}>
            <div className="overflow-hidden rounded-[18px] border border-[var(--border)] bg-white">
              <iframe className="block h-[240px] w-full border-0 sm:h-[300px]" loading="lazy" referrerPolicy="no-referrer-when-downgrade" src={links.embed} title={t("bs_map")} />
              <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                <p className="flex min-w-0 items-start gap-2 text-[15px] text-[var(--foreground-secondary)]">
                  <MapPin aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary)]" size={18} />
                  <span className="min-w-0 whitespace-pre-line">{mapQuery}</span>
                </p>
                <a className="pressable inline-flex min-h-11 items-center rounded-full bg-[var(--panel-tertiary)] px-4 text-[15px] font-bold text-[var(--foreground)]" href={links.open} rel="noopener noreferrer" target="_blank">
                  {t("bs_mapOpen")}
                </a>
              </div>
            </div>
          </Section>
        );
      }
      case "hours":
        return on("hours") && site.hours ? (
          <Section folded={folded} id="hours" key={id} look={look} title={t("bs_hours")}>
            <div className={`${look.card} max-w-md`}>
              <HoursList closed={t("bs_closed")} hours={site.hours} />
            </div>
          </Section>
        ) : null;
      case "social":
        return on("social") && social.length ? (
          <Section folded={folded} id="social" key={id} look={look} title={t("bs_social")}>
            <div className="flex flex-wrap gap-2.5">
              {social.map((link) => (
                <a className="pressable inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-bold text-[var(--foreground)] shadow-[var(--shadow-card)]" href={link.href} key={link.key} rel="noopener noreferrer" target="_blank">
                  <i aria-hidden="true" className={`ti ${ICONS[link.key]} text-[20px] text-[var(--primary)]`} />
                  {LABELS[link.key]}
                </a>
              ))}
            </div>
          </Section>
        ) : null;
      default:
        return null;
    }
  };
  return { render, social, t };
}

/** The business: its logo (on a white chip over colour or photos), or its first letter, with its name. */
function Brand({ business, light = false }: { business: SiteBusiness; light?: boolean }) {
  const tile = (
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[17px] font-bold ${light ? "bg-white text-[var(--primary)]" : "bg-[var(--primary)] text-white"}`}>
      {business.name.slice(0, 1).toUpperCase()}
    </span>
  );
  return (
    <span className="flex min-w-0 items-center gap-3">
      {business.logoUrl ? (
        <span className={`inline-flex shrink-0 items-center ${light ? "rounded-xl bg-white px-2 py-1" : ""}`}>
          <BusinessLogoImage alt={`${business.name} logo`} className="max-h-9 max-w-[112px] object-contain" fallback={tile} src={business.logoUrl} />
        </span>
      ) : (
        tile
      )}
      <span className={`truncate text-[17px] font-bold leading-tight ${light ? "text-white" : "text-[var(--foreground)]"}`}>{business.name}</span>
    </span>
  );
}

function DemoBanner({ text }: { text: string }) {
  return <div className="bg-[var(--warning-light)] px-4 py-2.5 text-center text-[14px] font-bold text-[var(--foreground)]">{text}</div>;
}

export function BookingSiteView({ site, business, heroUrl, fromMonthly, fromDaily, vehicleCount, demo = false, preview = false, children }: Props) {
  const template = site.template === "standard" ? "photo" : site.template;
  const look = LOOK[template];
  const heroOn = !site.off.includes("hero");
  // Monthly rentals put the "why" points in the top part, so they are not shown twice.
  const skip: SiteSection[] = template === "monthly" && heroOn ? ["why"] : [];
  const { render, social, t } = useSections({ site, business, look, folded: template === "compact", skip });
  const headline = site.headline || business.name;
  const subline = site.subline || business.location;
  const price = (value: number) => sitePrice(value, business.currency);
  const fromLine = template === "monthly" ? (fromMonthly ? t("bs_fromMonth", { amount: price(fromMonthly) }) : null) : fromDaily ? t("bs_fromDay", { amount: price(fromDaily) }) : fromMonthly ? t("bs_fromMonth", { amount: price(fromMonthly) }) : null;
  const language = preview ? null : <CustomerLanguagePicker className="shrink-0" />;
  const vehiclesTitle = template === "scooter" ? t("bs_pickRide") : template === "monthly" ? t("bs_monthlyVehicles") : t("bs_vehicles");
  const vehicles = (
    <section aria-labelledby="vehicles-title" className="scroll-mt-20" id="vehicles" key="vehicles">
      <h2 className={`${look.title} text-[var(--foreground)]`} id="vehicles-title">
        {vehiclesTitle}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
  const body = site.order.map((id) => (id === "vehicles" ? vehicles : render(id)));
  const banner = demo ? <DemoBanner text={t("bs_demoBanner")} /> : null;
  const chatLinks = social.filter((link) => link.key === "whatsapp" || link.key === "line");

  if (template === "compact") {
    return (
      <main className="min-h-screen bg-[var(--panel-secondary)] pb-12 text-[var(--foreground)]">
        {banner}
        <header className={`${preview ? "" : "sticky top-0"} z-20 border-b border-[var(--border)] bg-white`}>
          <div className="mx-auto flex h-14 max-w-[860px] items-center justify-between gap-3 px-4">
            <Brand business={business} />
            {language}
          </div>
        </header>
        {heroOn ? (
          <div className="bg-[var(--primary)] text-white">
            <div className="mx-auto max-w-[860px] px-4 py-5">
              <h1 className="text-[22px] font-bold leading-tight sm:text-[26px]">{headline}</h1>
              {subline ? <p className="mt-1 text-[15px] leading-6 text-white/85">{subline}</p> : null}
              <ul className="mt-3 flex flex-wrap gap-2 text-[13px] font-semibold">
                <li className="rounded-full bg-white/15 px-3 py-1">{t("bs_vehicleCount", { count: vehicleCount })}</li>
                {fromLine ? <li className="rounded-full bg-white/15 px-3 py-1">{fromLine}</li> : null}
                {site.hours ? (
                  <li className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1">
                    <Clock aria-hidden="true" size={13} />
                    <a href="#hours">{t("bs_hours")}</a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        ) : (
          <h1 className="sr-only">{business.name}</h1>
        )}
        <div className="mx-auto max-w-[860px] space-y-5 px-4 pt-5">{body}</div>
      </main>
    );
  }

  if (template === "monthly") {
    const why = !site.off.includes("why") ? site.why : [];
    return (
      <main className="min-h-screen bg-white text-[var(--foreground)]">
        {banner}
        <header className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-4 pt-[env(safe-area-inset-top)] sm:px-6">
          <Brand business={business} />
          {language}
        </header>
        {heroOn ? (
          <section className="mx-auto grid max-w-[1080px] items-center gap-8 px-4 pb-10 pt-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-16">
            <div>
              {fromMonthly ? (
                <>
                  <p className="text-[15px] font-semibold text-[var(--primary)]">{t("bs_monthlyFrom")}</p>
                  {/* The monthly price is what a long-stay renter looks for first, so it is the biggest thing on the page. */}
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 text-[56px] font-semibold leading-[0.95] tracking-[-0.045em] tabular-nums sm:text-[84px]">
                    {price(fromMonthly)}
                    <span className="text-[20px] font-medium tracking-normal text-[var(--muted)] sm:text-[26px]">{t("bs_aMonth")}</span>
                  </p>
                </>
              ) : null}
              <h1 className={`${fromMonthly ? "mt-6" : ""} text-[26px] font-semibold leading-tight tracking-[-0.015em] sm:text-[34px]`}>{headline}</h1>
              {subline ? <p className="mt-2 max-w-[52ch] text-[17px] leading-7 text-[var(--foreground-secondary)]">{subline}</p> : null}
              {why.length ? (
                <ul className="mt-6 grid gap-2.5">
                  {why.map((line) => (
                    <li className="flex items-start gap-3 text-[16px] font-semibold leading-6" key={line}>
                      <span aria-hidden="true" className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-[var(--primary)] text-[var(--primary)]">
                        <i className="ti ti-check text-[13px]" />
                      </span>
                      {line}
                    </li>
                  ))}
                </ul>
              ) : null}
              <a className="pressable mt-7 inline-flex min-h-12 items-center rounded-full bg-[var(--primary)] px-6 text-[16px] font-bold text-white" href="#vehicles">
                {t("bs_seeMonthly")}
              </a>
            </div>
            {heroUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="aspect-[4/3] w-full rounded-[28px] object-cover lg:aspect-[4/5]" src={heroUrl} />
            ) : null}
          </section>
        ) : (
          <h1 className="sr-only">{business.name}</h1>
        )}
        <div className="border-t border-[var(--border)] bg-[var(--panel-secondary)]">
          <div className={`mx-auto max-w-[1080px] px-4 py-10 sm:px-6 sm:py-14 ${look.gap}`}>{body}</div>
        </div>
      </main>
    );
  }

  if (template === "scooter") {
    return (
      <main className={`min-h-screen bg-[var(--primary)] text-[var(--foreground)] ${chatLinks.length && !preview ? "pb-24 sm:pb-0" : ""}`}>
        {banner}
        <div className="mx-auto max-w-[1080px] px-4 pb-12 pt-[calc(8px+env(safe-area-inset-top))] text-white sm:px-6 sm:pb-16">
          <header className="flex h-14 items-center justify-between gap-3">
            <Brand business={business} light />
            {language}
          </header>
          {heroOn ? (
            <div className="mt-6 grid items-center gap-6 lg:mt-10 lg:grid-cols-[1.15fr_1fr] lg:gap-10">
              <div>
                <h1 className="text-[46px] font-black leading-[0.92] tracking-[-0.045em] sm:text-[76px]">{headline}</h1>
                {subline ? <p className="mt-4 max-w-[40ch] text-[18px] font-medium leading-7 text-white/85">{subline}</p> : null}
                <div className="mt-6 flex flex-wrap gap-2.5">
                  {fromLine ? <span className="inline-flex min-h-11 items-center rounded-full bg-white px-5 text-[16px] font-black text-[var(--primary)]">{fromLine}</span> : null}
                  <a className="pressable inline-flex min-h-11 items-center rounded-full border-2 border-white/70 px-5 text-[16px] font-bold text-white" href="#vehicles">
                    {t("bs_book")}
                  </a>
                </div>
              </div>
              {heroUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="aspect-[16/11] w-full rounded-[32px] object-cover ring-4 ring-white/20" src={heroUrl} />
              ) : null}
            </div>
          ) : (
            <h1 className="sr-only">{business.name}</h1>
          )}
        </div>
        <div className="relative rounded-t-[32px] bg-[var(--panel-secondary)]">
          <div className={`mx-auto max-w-[1080px] px-4 pb-14 pt-7 sm:px-6 sm:pt-10 ${look.gap}`}>{body}</div>
        </div>
        {chatLinks.length && !preview ? (
          // Phones: one tap to message the shop, always in reach.
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[var(--border)] bg-white/95 p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
            {chatLinks.map((link) => (
              <a className="pressable inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-full bg-[var(--primary)] text-[16px] font-bold text-white" href={link.href} key={link.key} rel="noopener noreferrer" target="_blank">
                <i aria-hidden="true" className={`ti ${ICONS[link.key]} text-[20px]`} />
                {LABELS[link.key]}
              </a>
            ))}
          </div>
        ) : null}
      </main>
    );
  }

  // Photo-led: one big photo with the headline on it, then the vehicles.
  const tall = preview ? "min-h-[540px]" : "min-h-[78svh] sm:min-h-[560px]";
  return (
    <main className="min-h-screen bg-[var(--panel-secondary)] pb-16 text-[var(--foreground)]">
      {banner}
      {heroOn ? (
        <div className="relative isolate overflow-hidden bg-[var(--primary)] text-white">
          {heroUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" src={heroUrl} />
          ) : null}
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(0,0,0,0.78),rgba(0,0,0,0.2)_55%,rgba(0,0,0,0.38))]" />
          <div className={`mx-auto flex ${tall} max-w-[1080px] flex-col px-4 pb-8 pt-[calc(8px+env(safe-area-inset-top))] sm:px-6 sm:pb-12`}>
            <header className="flex h-14 items-center justify-between gap-3">
              <Brand business={business} light />
              {language}
            </header>
            <div className="mt-auto max-w-[660px] pt-16">
              <h1 className="text-[40px] font-bold leading-[1.02] tracking-[-0.03em] sm:text-[62px]">{headline}</h1>
              {subline ? <p className="mt-3 text-[17px] leading-7 text-white/85 sm:text-[19px]">{subline}</p> : null}
              <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3">
                <a className="pressable inline-flex min-h-12 items-center rounded-full bg-white px-6 text-[16px] font-bold text-[var(--primary)]" href="#vehicles">
                  {t("bs_book")}
                </a>
                {fromLine ? <span className="text-[15px] font-semibold text-white/85">{fromLine}</span> : null}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <header className="mx-auto flex h-16 max-w-[1080px] items-center justify-between gap-3 px-4 sm:px-6">
          <Brand business={business} />
          {language}
          <h1 className="sr-only">{business.name}</h1>
        </header>
      )}
      <div className={`mx-auto max-w-[1080px] px-4 pt-8 sm:px-6 sm:pt-12 ${look.gap}`}>{body}</div>
    </main>
  );
}

