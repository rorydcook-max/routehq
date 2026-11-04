import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTimeZone, getTranslations } from "next-intl/server";
import { CookieBanner, type CookieWords } from "@/components/cookie-banner";
import { GoogleTagManager } from "@/components/google-tag-manager";
import { legalUrl } from "@/lib/site/legal-slugs";
import { textDirection } from "@/lib/i18n/locales";
import { ImageShrinker } from "@/components/image-shrinker";
import { FlagFont } from "@/components/flag-font";
import { BrandStyle } from "@/components/brand-style";
import { ShellBrandProvider } from "@/components/shell-brand-provider";
import { businessCurrency, businessDistanceUnit } from "@/lib/business-units";
import { cookies, headers } from "next/headers";
import { THEME_COOKIE, themeScript, type ThemeChoice } from "@/lib/theme";
import { getCurrentMembership } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shellBrand } from "@/lib/shell-brand";
import { StaffMessages } from "@/components/staff-messages";
import { rootMetadata, rootViewport } from "../root-metadata";

/** rove.rent's directory search: a customer page, but Rove's own, so it asks about cookies and may be measured. */
async function isDirectoryPage() {
  try {
    return Boolean((await headers()).get("x-routehq-directory"));
  } catch {
    return false;
  }
}

async function isCustomerPage() {
  try {
    return Boolean((await headers()).get("x-routehq-customer-page"));
  } catch {
    return false;
  }
}

/** The signed-in operator's brand (logo, name, colour), so pages open in it rather than switching after load. */
async function operatorBrand() {
  try {
    // Customer pages carry the business's own brand, and the directory is RoveHQ's: neither takes the signed-in operator's colour.
    if ((await headers()).get("x-routehq-customer-page")) return null;
    const membership = await getCurrentMembership();
    if (!membership) return null;
    return await shellBrand((await createSupabaseServerClient()) as any, membership.organizationId);
  } catch {
    return null;
  }
}
// Bundled with the app (was "@latest" from a CDN): icons can't change or
// break underneath us, and they load with the page.
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "../globals.css";
import "../theme-dark.css";

// The platform's root layout. RoveHQ's website has its own (app/(site)/site/[locale]/layout.tsx), drawn ahead of time
// with no per-visitor reads, so it can be served from the CDN; the two share their metadata.
export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

/** The cookie notice's words: the website's own (site.cookie*), so both domains ask the same thing. */
async function cookieWords(): Promise<CookieWords> {
  const t = await getTranslations("site");
  return {
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
    policyHref: legalUrl("cookies")
  };
}

/** Light, dark, or (no cookie) the device's own setting. */
async function themeChoice(): Promise<ThemeChoice> {
  try {
    const value = (await cookies()).get(THEME_COOKIE)?.value;
    return value === "light" || value === "dark" ? value : "system";
  } catch {
    return "system";
  }
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, brand, customerPage, directoryPage, theme, timeZone] = await Promise.all([getLocale(), operatorBrand(), isCustomerPage(), isDirectoryPage(), themeChoice(), getTimeZone().catch(() => null)]);
  // Customer pages (booking pages, booking links, the directory, embedded checkouts) get no cookie notice and no
  // analytics: renters' data is the business's, not ours. Everything else on rovehq.app gets both.
  // rove.rent's directory search is the exception: Rove's own page, with its own notice and analytics.
  const words = customerPage && !directoryPage ? null : await cookieWords().catch(() => null);
  // Read after getTimeZone(): loading the signed-in business recorded its unit for this request.
  const page = <ShellBrandProvider brand={brand} currency={businessCurrency()} distanceUnit={businessDistanceUnit()} timeZone={timeZone}>{children}</ShellBrandProvider>;
  return (
    // "System" is resolved in the browser before the first paint, so the attribute can differ from the server's: expected.
    <html data-theme={theme === "system" ? undefined : theme} dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <BrandStyle colour={brand?.colour || null} />
        {/* Customer pages get only their few words with the page. The staff app loads its words once as a
            cached file (StaffMessages), so they are not re-sent with every save. */}
        {customerPage ? (
          <NextIntlClientProvider>{page}</NextIntlClientProvider>
        ) : (
          <StaffMessages locale={locale} timeZone={timeZone}>{page}</StaffMessages>
        )}
        {words ? (
          <>
            <CookieBanner words={words} />
            {/* Google Tag Manager (GA4), loaded in the browser only after the visitor accepts analytics cookies. */}
            <GoogleTagManager />
          </>
        ) : null}
        <ImageShrinker />
        <FlagFont />
      </body>
    </html>
  );
}
