import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import { getMessages, getTranslations } from "next-intl/server";
import { PublicSpeedInsights } from "@/components/public-speed-insights";
import { FlagFont } from "@/components/flag-font";
import { ImageShrinker } from "@/components/image-shrinker";
import { textDirection } from "@/lib/i18n/locales";
import { siteLocale, siteLocaleParams } from "@/lib/site/static-page";
import { consentChosenScript } from "@/lib/consent";
import { themeScript } from "@/lib/theme";
import { rootMetadata, rootViewport } from "../../../root-metadata";
import { localizeSitePath } from "@/lib/site/locale-path";
import { siteWideLd } from "@/lib/site/schema";
import { JsonLd } from "./_components/content-ui";
import { CookieBanner } from "@/components/cookie-banner";
import { GoogleTagManager } from "@/components/google-tag-manager";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { SiteChat } from "./_components/site-chat";
import s from "./site.module.css";
// The app's own stylesheets, in the same order as its root layout, without the Tabler icon font: the website's icons
// are lucide-react SVGs, so its 212 KB stylesheet was loaded for nothing (task perf, 8 Nov 2026).
import "../../../globals.css";
import "../../../theme-dark.css";

/* The website's two typefaces, only on the website: Geist for everything, and an italic serif for the one phrase
   a headline leans on. Non-Latin scripts fall through to Anuphan (Thai, self-hosted) and the system. */
// `subsets` is only what is preloaded (task perf, 8 Nov 2026): Latin. Latin Extended (Turkish ğ ş İ, Polish, Croatian)
// stays in the stylesheet and loads on the pages whose words need it, so the italic accents never fall back mid-word.
const geist = Geist({ subsets: ["latin"], display: "swap", variable: "--font-site" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", variable: "--font-site-serif" });

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
  const chatWords = ((messages as Record<string, any>).chat ?? {}) as Record<string, string>;
  return (
    // Light or dark is settled in the browser before the first paint (themeScript reads the choice there), so the
    // page can be the same for everyone; the website itself keeps its own fixed look (light-island below).
    <html dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Hides the cookie notice (drawn with the page) before the first paint for a visitor who has already chosen. */}
        <script dangerouslySetInnerHTML={{ __html: consentChosenScript() }} />
        {/* Organization and WebSite structured data, on every website page (lib/site/schema.ts). */}
        <JsonLd data={siteWideLd(locale)} />
      </head>
      <body>
        {/* The website is drawn on the server, and its few client parts are handed the language and words they show
            (task perf2, 8 Nov 2026): no next-intl provider, so next-intl's browser code isn't loaded with every page. */}
        <>
          {/* light-island: the website has its own fixed look, so the app's dark mode (theme-dark.css) leaves it as drawn. */}
          <div className={`light-island ${s.site} ${geist.variable} ${serif.variable}`}>
            <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[#06162b]" href="#main">
              {t("skipToContent")}
            </a>
            <SiteHeader />
            <main id="main">{children}</main>
            <SiteFooter />
            {/* The live chat for visitors (help-centre answers and the RoveHQ team, never anyone's records), with its own
                words. Drawn as its button; the chat itself loads when the visitor first interacts (site-chat.tsx). */}
            <SiteChat label={chatWords.launcher || "Chat"} locale={locale} words={chatWords} />
            {/* Cookie consent (GDPR / UK PECR): the same in every cached page, hidden before the first paint for a
                visitor who has already chosen (consentChosenScript above). */}
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
          {/* Real visitors' loading speed (Vercel Speed Insights): no cookies, nothing stored on the device. */}
          <PublicSpeedInsights />
        </>
        <ImageShrinker />
        <FlagFont />
      </body>
    </html>
  );
}
