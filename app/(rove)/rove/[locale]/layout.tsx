import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CookieBanner } from "@/components/cookie-banner";
import { FlagFont } from "@/components/flag-font";
import { GoogleTagManager } from "@/components/google-tag-manager";
import { textDirection } from "@/lib/i18n/locales";
import { roveHqSite, roveOrigin, roveSiteWideLd } from "@/lib/rove/seo";
import { roveLocale, roveLocaleParams } from "@/lib/rove/static";
import { localizeSitePath } from "@/lib/site/locale-path";
import { consentChosenScript } from "@/lib/consent";
import { themeScript } from "@/lib/theme";
import { rootMetadata, rootViewport } from "../../../root-metadata";
import { JsonLd } from "./_components/json-ld";
import { RoveFooter } from "./_components/footer";
import { RoveHeader } from "./_components/header";
import s from "./rove.module.css";
// The app's own stylesheets, in the same order as its root layout, without the Tabler icon font (493 KB): Rove draws
// the few icons it uses inline (_components/icon.tsx; task perf, 8 Nov 2026).
import "../../../globals.css";
import "../../../theme-dark.css";

// `subsets` is what is preloaded: just Latin (task perf, 8 Nov 2026; five font files were fetched ahead of everything
// else on every page). The other alphabets stay in the stylesheet and load only on a page whose words need them.
// The display face isn't preloaded at all: its 78 KB file (variable width) was fetched first on every page, here and on
// RoveHQ's website too (the build preloads it there as well), ahead of the photo that is the page's largest paint.
// Headings show in the size-matched fallback (Next's adjusted Arial) for a moment, then swap (display: swap).
const display = Bricolage_Grotesque({ subsets: ["latin"], axes: ["wdth"], display: "swap", variable: "--rv-display", preload: false });
// Geist for reading and tapping (task build-rove, 8 Nov 2026): neutral, exact, made for interfaces.
const body = Geist({ subsets: ["latin"], display: "swap", variable: "--rv-body" });

export const metadata: Metadata = { ...rootMetadata, metadataBase: new URL(roveOrigin()), applicationName: "Rove", title: { default: "Rove", template: "%s | Rove" } };
export const viewport: Viewport = rootViewport;

// One copy per language. Pages below that are English-only say so with their own generateStaticParams.
export function generateStaticParams() {
  return roveLocaleParams();
}

/**
 * rove.rent, the renter marketplace (task "roverent", 7 Nov 2026): its own root layout, like the RoveHQ website's,
 * so it reads nothing from the request (no signed-in business, no cookies, no language header) and the home,
 * destination and guide pages are drawn ahead of time and served from the cache. proxy.ts serves each public
 * address (rove.rent/, /thailand/koh-samui, /th/search) from here (lib/rove/paths.ts). A business's own booking page
 * (rove.rent/<slug>) stays in the platform's layout: it's the business's page, with no cookie notice or analytics.
 */
export default async function RoveLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const locale = await roveLocale(params);
  const t = await getTranslations("site");
  const d = await getTranslations("directory");
  return (
    <html dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Hides the cookie notice (drawn with the page) before the first paint for a visitor who has already chosen. */}
        <script dangerouslySetInnerHTML={{ __html: consentChosenScript() }} />
        {/* Organization and WebSite (with its search), on every Rove page. */}
        <JsonLd data={roveSiteWideLd(locale)} />
      </head>
      <body>
        <NextIntlClientProvider locale={locale} messages={{}}>
          {/* light-island: Rove keeps its own fixed look in the app's dark mode, as the website does. */}
          <div className={`light-island ${s.rove} ${display.variable} ${body.variable}`}>
            <a className={s.skip} href="#main">
              {d("rv.skip")}
            </a>
            <RoveHeader locale={locale} />
            <main id="main">{children}</main>
            <RoveFooter locale={locale} />
            {/* Cookie consent: the same in every cached page, hidden before the first paint for a visitor who has
                already chosen (consentChosenScript above). Analytics (GTM-NZL8J5FN)
                load only after a yes, and only on Rove's own pages (lib/analytics.ts), never on a business's page. */}
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
                policyHref: `${roveHqSite()}${localizeSitePath("/legal/cookies", locale)}`
              }}
            />
          </div>
          <GoogleTagManager />
        </NextIntlClientProvider>
        <FlagFont />
      </body>
    </html>
  );
}
