import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getTranslations } from "next-intl/server";
import { CookieBanner } from "@/components/cookie-banner";
import { FlagFont } from "@/components/flag-font";
import { GoogleTagManager } from "@/components/google-tag-manager";
import { textDirection } from "@/lib/i18n/locales";
import { roveHqSite, roveOrigin, roveSiteWideLd } from "@/lib/rove/seo";
import { roveLocale, roveLocaleParams } from "@/lib/rove/static";
import { localizeSitePath } from "@/lib/site/locale-path";
import { themeScript } from "@/lib/theme";
import { rootMetadata, rootViewport } from "../../../root-metadata";
import { JsonLd } from "./_components/json-ld";
import { RoveFooter } from "./_components/footer";
import { RoveHeader } from "./_components/header";
import s from "./rove.module.css";
// The same stylesheets, in the same order, as the app's root layout.
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "../../../globals.css";
import "../../../theme-dark.css";

const display = Bricolage_Grotesque({ subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap", variable: "--rv-display" });
const body = Figtree({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--rv-body" });

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
            {/* Cookie consent: drawn in the browser only, so the page stays the same for everyone. Analytics (GTM-NZL8J5FN)
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
