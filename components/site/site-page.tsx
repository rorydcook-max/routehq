"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { BusinessLogoImage } from "@/components/business-logo-image";
import { CustomerLanguagePicker } from "@/components/customer-language-picker";
import { isSectionOn, SITE_MESSAGE, siteConfigFrom, type SectionId, type SiteConfig, type TextSlot } from "@/lib/sites/config";
import { fontHref, fontPairing } from "@/lib/sites/fonts";
import { fleetNoun, sitePrice, socialHref } from "@/lib/sites/format";
import { resolveImage, type ResolvedImage } from "@/lib/sites/images";
import { sitePalette, siteVars } from "@/lib/sites/palettes";
import { templateDef, type TemplateDef } from "@/lib/sites/templates";
import type { SiteBusiness, SiteData } from "@/lib/sites/types";
import { SiteContext, type Say, type SiteContextValue } from "./site-context";
import { About } from "./sections/about";
import { Booking } from "./sections/booking";
import { Contact } from "./sections/contact";
import { Faqs } from "./sections/faqs";
import { Fleet } from "./sections/fleet";
import { Reviews } from "./sections/reviews";
import { Hero } from "./sections/hero";
import s from "./site.module.css";


/** The words a slot shows when the owner hasn't written their own: from the business's details, in the renter's language. */
function defaultText(template: TemplateDef, business: SiteBusiness, noun: string, t: Say): Record<TextSlot, string> {
  const values = { place: business.place, business: business.name, noun };
  const np = business.place ? "" : "_np";
  return {
    "hero.headline": t(`hd_${template.id}${np}`, values),
    "hero.subline": t(`hs_${template.id}`, values),
    "hero.cta": t("cta_check"),
    "about.title": t("about_title", values),
    "about.body": t(`about_body${np}`, values),
    "booking.title": t("booking_title", values),
    "booking.subline": t("booking_sub"),
    "fleet.title": t("fleet_title"),
    "reviews.title": t("reviews_title"),
    "faqs.title": t("faqs_title"),
    "contact.title": t("contact_title"),
    "contact.subline": t("contact_sub")
  };
}

const SECTIONS: Record<SectionId, () => ReactNode> = { about: About, booking: Booking, fleet: Fleet, reviews: Reviews, faqs: Faqs, contact: Contact };

/** Brings the booking section into view (smoothly, unless reduced motion is on). */
function toBooking() {
  requestAnimationFrame(() => document.getElementById("book")?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }));
}

/** Logos at or below this width-to-height ratio are marks or icons, so the name goes beside them. */
const ICON_RATIO = 1.4;

/**
 * The name in the top bar (owner feedback, 7 Nov 2026: a wordmark logo followed by the same name read twice). With a
 * logo, the logo shows alone unless it turns out to be square or icon-like (decided once its size is known; the box
 * keeps its height meanwhile, so nothing jumps) or the owner switched "Show business name next to logo" on.
 */
function Brand({ business, showName }: { business: SiteBusiness; showName: boolean }) {
  const [logo, setLogo] = useState<"loading" | "wide" | "icon" | "failed">("loading");
  const tile = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[calc(var(--s-r-card)*0.5)] bg-[var(--s-accent)] text-[15px] font-bold text-[var(--s-accent-ink)] sm:h-10 sm:w-10 sm:text-[17px]">
      {business.name.slice(0, 1).toUpperCase()}
    </span>
  );
  const nameShown = !business.logoUrl || showName || logo === "icon" || logo === "failed";
  return (
    <a className={`${s.focus} flex min-w-0 items-center gap-3`} href="#top">
      {business.logoUrl ? (
        <span className="flex h-8 min-w-0 shrink-0 items-center sm:h-10">
          <BusinessLogoImage
            alt={nameShown ? "" : `${business.name} logo`}
            className="block h-7 w-auto max-w-[170px] object-contain object-left sm:h-9 sm:max-w-[220px]"
            fallback={tile}
            onFail={() => setLogo("failed")}
            onSize={(width, height) => setLogo(height > 0 && width / height <= ICON_RATIO ? "icon" : "wide")}
            src={business.logoUrl}
          />
        </span>
      ) : (
        tile
      )}
      {nameShown ? <span className="truncate text-[17px] font-bold leading-tight">{business.name}</span> : null}
    </a>
  );
}

/**
 * A business's one-page website (Rory, 7 Nov 2026): the hero, then the sections in the owner's order, in the
 * template's layouts, palette and fonts. In the editor's preview (`edit`) the config arrives from the editor as the
 * owner changes it, and text can be clicked and edited.
 */
export function SitePage({ data, config: initial, edit = false }: { data: SiteData; config: SiteConfig; edit?: boolean }) {
  const t = useTranslations("bsite") as unknown as Say;
  const [config, setConfig] = useState<SiteConfig>(initial);
  const [uploads, setUploads] = useState<Record<string, string>>(data.uploads);
  const [picked, setPicked] = useState<{ id: string; n: number } | null>(null);

  // The editor's preview: take the config the editor sends, and tell it when text is edited here.
  useEffect(() => {
    if (!edit || window.parent === window) return;
    const listen = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.data?.type !== SITE_MESSAGE.config) return;
      setConfig(siteConfigFrom(event.data.config));
      if (event.data.uploads && typeof event.data.uploads === "object") setUploads((current) => ({ ...current, ...event.data.uploads }));
    };
    window.addEventListener("message", listen);
    window.parent.postMessage({ type: SITE_MESSAGE.ready }, window.location.origin);
    return () => window.removeEventListener("message", listen);
  }, [edit]);

  const template = templateDef(config.template);
  const palette = sitePalette(config, template, data.brandColour);
  const font = fontPairing(config.font, template.font);
  const noun = fleetNoun(data.vehicles.map((vehicle) => vehicle.kind));
  const defaults = useMemo(() => defaultText(template, data.business, noun, t), [template, data.business, noun, t]);

  const setText = useCallback(
    (slot: TextSlot, value: string) => {
      setConfig((current) => {
        const text = { ...current.text };
        if (value && value !== defaults[slot]) text[slot] = value;
        else delete text[slot];
        return { ...current, text };
      });
      window.parent.postMessage({ type: SITE_MESSAGE.text, slot, value: value === defaults[slot] ? "" : value }, window.location.origin);
    },
    [defaults]
  );

  const vehiclePhotos = useMemo(() => Object.fromEntries(data.vehicles.filter((vehicle) => vehicle.photoUrl).map((vehicle) => [vehicle.id, vehicle.photoUrl as string])), [data.vehicles]);
  const firstPhoto = data.vehicles.find((vehicle) => vehicle.photoUrl);
  const heroFallback: ResolvedImage = { type: "art", id: template.art };
  const aboutFallback: ResolvedImage = firstPhoto ? { type: "url", url: firstPhoto.photoUrl as string, alt: firstPhoto.name } : { type: "art", id: template.art === "tide" ? "dunes" : "bloom" };
  const images = {
    hero: resolveImage(config.images.hero, { uploads, vehiclePhotos }, heroFallback),
    about: resolveImage(config.images.about, { uploads, vehiclePhotos }, aboutFallback)
  };

  const pickVehicle = useCallback((id: string) => {
    setPicked((current) => ({ id, n: (current?.n || 0) + 1 }));
    toBooking();
  }, []);
  const [search, setSearch] = useState<SiteContextValue["search"]>(null);
  const searchDates = useCallback((start: string, end: string, kind: string) => {
    setSearch((current) => ({ start, end, kind, n: (current?.n || 0) + 1 }));
    toBooking();
  }, []);

  const value: SiteContextValue = {
    config,
    template,
    palette,
    data,
    edit,
    t,
    text: (slot) => config.text[slot] || defaults[slot],
    setText,
    images,
    noun,
    money: (amount) => sitePrice(amount, data.business.currency),
    pickVehicle,
    picked,
    searchDates,
    search
  };

  const sections = config.sections.filter((section) => section.on || section.id === "booking");
  const nav = sections
    .filter((section) => ["about", "booking", "fleet", "reviews", "contact"].includes(section.id))
    .filter((section) => section.id !== "reviews" || data.reviews.length || config.reviewsUrl || data.googleReviewsUrl)
    .map((section) => ({ id: section.id === "booking" ? "book" : section.id, label: t(`nav_${section.id}`) }));
  const whatsapp = socialHref("whatsapp", config.social.whatsapp || data.business.whatsapp);
  const chatBar = template.chatBar && whatsapp;
  const centered = template.header === "center";
  // Each model once (a shop often has several of the same scooter).
  const models = data.vehicles.filter((vehicle, index, list) => list.findIndex((other) => other.name === vehicle.name) === index);
  const ticker = template.ticker && models.length > 1 ? models.slice(0, 10) : [];

  return (
    <SiteContext.Provider value={value}>
      <div
        className={`${s.root} ${chatBar ? "pb-24 sm:pb-0" : ""}`}
        data-caps={template.caps ? "" : undefined}
        data-edge={template.edge}
        data-template={template.id}
        id="top"
        style={{ ...(siteVars(palette, template, font) as CSSProperties), colorScheme: palette.dark ? "dark" : "light" }}>
        {/* Only this pairing is loaded (display=swap: text shows at once in the fallback face). */}
        <link crossOrigin="anonymous" href="https://fonts.gstatic.com" rel="preconnect" />
        <link href={fontHref(font)} key={font.id} rel="stylesheet" />

        {data.demo ? <p className="bg-[var(--s-accent)] px-4 py-2.5 text-center text-[14px] font-semibold text-[var(--s-accent-ink)]">{t("demo_banner")}</p> : null}

        <header className={`${s.header} sticky top-0 z-30`}>
          <div className={`${s.wrap} flex h-16 items-center justify-between gap-4${centered ? " lg:grid lg:grid-cols-[1fr_auto_1fr]" : ""}`}>
            {centered ? null : <Brand business={data.business} showName={config.showName} />}
            <nav aria-label={t("nav_label")} className={`hidden items-center gap-1 lg:flex${centered ? " -ms-3.5" : ""}`}>
              {nav.map((item) => (
                <a className={`${s.focus} rounded-full px-3.5 py-2 text-[15px] font-semibold ${s.soft} hover:text-[var(--s-ink)]`} href={`#${item.id}`} key={item.id}>
                  {item.label}
                </a>
              ))}
            </nav>
            {centered ? <Brand business={data.business} showName={config.showName} /> : null}
            <div className={`flex shrink-0 items-center gap-2${centered ? " justify-self-end" : ""}`}>
              {edit ? null : <CustomerLanguagePicker className="max-sm:hidden" />}
              <a className={`${s.btn} !min-h-11 !px-5 text-[15px]`} href="#book">
                {t("book_now")}
              </a>
            </div>
          </div>
        </header>

        <main>
          <Hero />
          {ticker.length ? (
            <div aria-hidden="true" className={`${s.ticker} border-y ${s.line} bg-[var(--s-second)] py-3 text-[var(--s-second-ink)]`}>
              <div className={s.tickerTrack}>
                {[0, 1].map((copy) => (
                  <span className={`${s.display} flex shrink-0 items-center text-[22px] sm:text-[26px]`} key={copy}>
                    {ticker.map((vehicle) => (
                      <span className="flex items-center" key={`${copy}-${vehicle.id}`}>
                        <span className="px-6">{vehicle.name}</span>
                        <span aria-hidden="true">✦</span>
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {sections.map((section) => {
            const Section = SECTIONS[section.id];
            return <Section key={section.id} />;
          })}
        </main>

        <footer className={`${s.footer} border-t ${s.line}`}>
          <div className={`${s.wrap} flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between`}>
            <div>
              <p className="text-[17px] font-bold">{data.business.name}</p>
              {data.business.address ? <p className={`${s.footerSoft} mt-1 max-w-[52ch] whitespace-pre-line text-[15px]`}>{data.business.address}</p> : null}
            </div>
            <div className="flex items-center gap-4">
              {edit ? null : <CustomerLanguagePicker />}
              <p className={`${s.footerSoft} text-[14px]`}>{t("footer_copy", { year: new Date().getFullYear(), business: data.business.name })}</p>
            </div>
          </div>
        </footer>

        {chatBar ? (
          // Moto, Reef and Trail on phones: one tap to message the shop or book, always in reach.
          <div className="fixed inset-x-0 bottom-0 z-30 flex gap-2 border-t border-[var(--s-line)] bg-[color-mix(in_oklab,var(--s-bg)_92%,transparent)] p-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur sm:hidden">
            <a className={`${s.btn} ${s.btnGhost} flex-1`} href={whatsapp as string} rel="noopener noreferrer" target="_blank">
              <MessageCircle aria-hidden="true" size={18} />
              WhatsApp
            </a>
            <a className={`${s.btn} flex-1`} href="#book">
              {t("book_now")}
            </a>
          </div>
        ) : null}
      </div>
    </SiteContext.Provider>
  );
}

export { isSectionOn };
