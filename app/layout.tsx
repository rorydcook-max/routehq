import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { textDirection } from "@/lib/i18n/locales";
import { ImageShrinker } from "@/components/image-shrinker";
import { FlagFont } from "@/components/flag-font";
import { BrandStyle } from "@/components/brand-style";
import { ShellBrandProvider } from "@/components/shell-brand-provider";
import { cookies, headers } from "next/headers";
import { THEME_COOKIE, themeScript, type ThemeChoice } from "@/lib/theme";
import { getCurrentMembership } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shellBrand } from "@/lib/shell-brand";
import { StaffMessages } from "@/components/staff-messages";

async function isCustomerPage() {
  try {
    return Boolean((await headers()).get("x-routehq-customer-page"));
  } catch {
    return false;
  }
}

/** Lokalfleet's website pages (proxy.ts marks them). */
async function isSitePage() {
  try {
    return Boolean((await headers()).get("x-routehq-site-page"));
  } catch {
    return false;
  }
}

/** The signed-in operator's brand (logo, name, colour), so pages open in it rather than switching after load. */
async function operatorBrand() {
  try {
    // Customer pages carry the business's own brand, and the directory and website are Lokalfleet's: none takes the signed-in operator's colour.
    if ((await headers()).get("x-routehq-customer-page") || (await headers()).get("x-routehq-site-page")) return null;
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
import "./globals.css";
import "./theme-dark.css";

export const metadata: Metadata = {
  title: {
    default: "Lokalfleet",
    template: "%s | Lokalfleet"
  },
  description: "The command centre for vehicle rental operations.",
  applicationName: "Lokalfleet",
  metadataBase: new URL("https://lokalfleet.com"),
  icons: {
    icon: "/lokalfleet-icon.svg?v=4",
    shortcut: "/lokalfleet-icon.svg?v=4",
    // ?v= so phones fetch the re-centred icon (27 Oct) instead of a cached copy.
    apple: "/apple-touch-icon.png?v=4"
  },
  // Opens full screen, like an app, when added to a phone's home screen.
  appleWebApp: { capable: true, title: "Lokalfleet", statusBarStyle: "default" }
};

export const viewport: Viewport = {
  // Edge to edge on iPhones, so env(safe-area-inset-*) is real: the floating tab bar clears the home indicator
  // and the page pads itself away from the status bar and the notch (see "Phone pass" in globals.css).
  viewportFit: "cover",
  // The page header is light now (Oct 27), so the browser's top bar matches the page, not the old teal band.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#123f46" }
  ]
};

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
  const [locale, brand, customerPage, theme, sitePage] = await Promise.all([getLocale(), operatorBrand(), isCustomerPage(), themeChoice(), isSitePage()]);
  const page = <ShellBrandProvider brand={brand}>{children}</ShellBrandProvider>;
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
        {/* The website (home, pricing) is drawn on the server: its few client parts need the language, not the words. */}
        {customerPage ? (
          <NextIntlClientProvider>{page}</NextIntlClientProvider>
        ) : sitePage ? (
          <NextIntlClientProvider messages={{}}>{page}</NextIntlClientProvider>
        ) : (
          <StaffMessages locale={locale}>{page}</StaffMessages>
        )}
        <ImageShrinker />
        <FlagFont />
      </body>
    </html>
  );
}
