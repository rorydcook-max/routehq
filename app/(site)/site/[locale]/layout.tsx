import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { ChatLauncher } from "@/components/chat/chat-launcher";
import { FlagFont } from "@/components/flag-font";
import { ImageShrinker } from "@/components/image-shrinker";
import { textDirection } from "@/lib/i18n/locales";
import { siteLocale, siteLocaleParams } from "@/lib/site/static-page";
import { themeScript } from "@/lib/theme";
import { rootMetadata, rootViewport } from "../../../root-metadata";
import { localizeSitePath } from "@/lib/site/locale-path";
import { CookieBanner } from "@/components/cookie-banner";
import { GoogleTagManager } from "@/components/google-tag-manager";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import s from "./site.module.css";
// The same stylesheets, in the same order, as the app's root layout.
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "../../../globals.css";
import "../../../theme-dark.css";

/* The website's two typefaces, only on the website: Geist for everything, and an italic serif for the one phrase
   a headline leans on. Non-Latin scripts fall through to Anuphan (Thai, self-hosted) and the system. */
const geist = Geist({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-site" });
// latin-ext: Turkish ğ ş İ (and Polish, Croatian) in the italic heading accents, not a fallback font mid-word.
const serif = Instrument_Serif({ subsets: ["latin", "latin-ext"], weight: "400", style: "italic", display: "swap", variable: "--font-site-serif" });

export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

// One copy per language, drawn at build time (siteLocale answers "not found" for anything else). No dynamicParams
// here: it would apply to every page below, and some are drawn on first visit (a currency, a help article's translation).
export function generateStaticParams() {
  return siteLocaleParams();
}

/**
 * RoveHQ's public website (home, pricing, FAQ, contact, guides, resources, help centre): its own root layout, apart
 * from the platform's (app/(app)/layout.tsx), so it reads nothing from the request (no signed-in brand, no theme
 * cookie, no language header) and every page is drawn ahead of time and served from Vercel's cache (3 Nov 2026).
 * proxy.ts serves each public address (/pricing, /th/pricing) from these pages (lib/site/internal-path.ts).
 * Moving between the website and the platform is a full page load, as it is between rovehq.io and rovehq.app.
 */
export default async function SiteLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await siteLocale(params);
  const [t, messages] = await Promise.all([getTranslations("site"), getMessages()]);
  return (
    // Light or dark is settled in the browser before the first paint (themeScript reads the choice there), so the
    // page can be the same for everyone; the website itself keeps its own fixed look (light-island below).
    <html dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        {/* The website is drawn on the server: its few client parts need the language, not the words. */}
        <NextIntlClientProvider locale={locale} messages={{}}>
          {/* light-island: the website has its own fixed look, so the app's dark mode (theme-dark.css) leaves it as drawn. */}
          <div className={`light-island ${s.site} ${geist.variable} ${serif.variable}`}>
            <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[#06162b]" href="#main">
              {t("skipToContent")}
            </a>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
            {/* The live chat for visitors (help-centre answers and the RoveHQ team, never anyone's records). The website's
                client parts get no words by default, so the chat's own words come with it. */}
            <NextIntlClientProvider messages={{ chat: ((messages as Record<string, any>).chat ?? {}) as Record<string, string> }}>
              <ChatLauncher site />
            </NextIntlClientProvider>
            {/* Cookie consent (GDPR / UK PECR): drawn in the browser only, so the page itself stays the same for everyone. */}
            <CookieBanner
              words={{
                body: t("cookieBody"),
                accept: t("cookieAccept"),
                reject: t("cookieReject"),
                choices: t("cookieChoices"),
                choicesTitle: t("cookieChoicesTitle"),
                necessary: t("cookieNecessary"),
                necessaryBody: t("cookieNecessaryBody"),
                alwaysOn: t("cookieAlwaysOn"),
                analytics: t("cookieAnalytics"),
                analyticsBody: t("cookieAnalyticsBody"),
                save: t("cookieSave"),
                policy: t("cookiePolicy"),
                policyHref: localizeSitePath("/legal/cookies", locale)
              }}
            />
          </div>
          {/* Google Tag Manager (GA4), loaded in the browser only after the visitor accepts analytics cookies. */}
          <GoogleTagManager />
        </NextIntlClientProvider>
        <ImageShrinker />
        <FlagFont />
      </body>
    </html>
  );
}
