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
import { businessCountry, businessCurrency, businessDistanceUnit } from "@/lib/business-units";
import { cookies, headers } from "next/headers";
import { THEME_COOKIE, themeScript, type ThemeChoice } from "@/lib/theme";
import { consentChosenScript } from "@/lib/consent";
import { getCurrentMembership } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shellBrand } from "@/lib/shell-brand";
import { StaffMessages } from "@/components/staff-messages";

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
// The Tabler icon font's stylesheet is imported by app/(app)/layout.tsx just before this module, so the order stays
// icons, globals, dark theme. Businesses' booking pages (app/(rent)/layout.tsx) draw no Tabler icons and skip it.
import "./globals.css";
import "./theme-dark.css";

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

/**
 * The platform's root layout, shared by the app (app/(app)/layout.tsx) and businesses' booking pages
 * (app/(rent)/layout.tsx; task perf, 8 Nov 2026). RoveHQ's website has its own (app/(site)/site/[locale]/layout.tsx),
 * drawn ahead of time with no per-visitor reads, so it can be served from the CDN; they all share their metadata.
 */
export async function PlatformRoot({
  children,
  fixedLight = false
}: Readonly<{
  children: React.ReactNode;
  /** Businesses' booking sites have their own palette (light or dark, chosen by the business), so they never follow
   * the visitor's light/dark setting: the app's dark theme only half-repainted them (dark mode pass, 8 Nov 2026). */
  fixedLight?: boolean;
}>) {
  const [locale, brand, customerPage, directoryPage, chosenTheme, timeZone] = await Promise.all([getLocale(), operatorBrand(), isCustomerPage(), isDirectoryPage(), themeChoice(), getTimeZone().catch(() => null)]);
  const theme: ThemeChoice = fixedLight ? "light" : chosenTheme;
  // Customer pages (booking pages, booking links, the directory, embedded checkouts) get no cookie notice and no
  // analytics: renters' data is the business's, not ours. Everything else on rovehq.app gets both.
  // rove.rent's directory search is the exception: Rove's own page, with its own notice and analytics.
  const words = customerPage && !directoryPage ? null : await cookieWords().catch(() => null);
  // Read after getTimeZone(): loading the signed-in business recorded its unit for this request.
  const page = (
    <ShellBrandProvider brand={brand} country={businessCountry()} currency={businessCurrency()} distanceUnit={businessDistanceUnit()} timeZone={timeZone}>
      {children}
    </ShellBrandProvider>
  );
  return (
    // "System" is resolved in the browser before the first paint, so the attribute can differ from the server's: expected.
    <html data-theme={theme === "system" ? undefined : theme} dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        {fixedLight ? null : <script dangerouslySetInnerHTML={{ __html: themeScript }} />}
        {/* Hides the cookie notice (drawn with the page) before the first paint for a visitor who has already chosen. */}
        {words ? <script dangerouslySetInnerHTML={{ __html: consentChosenScript() }} /> : null}
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
