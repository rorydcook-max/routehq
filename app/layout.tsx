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

/** The signed-in operator's brand (logo, name, colour), so pages open in it rather than switching after load. */
async function operatorBrand() {
  try {
    // Customer pages carry the business's own brand, and the directory is RouteHQ's: neither takes the signed-in operator's colour.
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
import "./globals.css";
import "./theme-dark.css";

export const metadata: Metadata = {
  title: {
    default: "RouteHQ",
    template: "%s | RouteHQ"
  },
  description: "The command centre for vehicle rental operations.",
  applicationName: "RouteHQ",
  metadataBase: new URL("https://routehq.app"),
  icons: {
    icon: "/routehq-icon.svg",
    shortcut: "/routehq-icon.svg",
    // ?v= so phones fetch the re-centred icon (27 Oct) instead of a cached copy.
    apple: "/apple-touch-icon.png?v=2"
  },
  // Opens full screen, like an app, when added to a phone's home screen.
  appleWebApp: { capable: true, title: "RouteHQ", statusBarStyle: "default" }
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0e5e6f" },
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
  const [locale, brand, customerPage, theme] = await Promise.all([getLocale(), operatorBrand(), isCustomerPage(), themeChoice()]);
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
        {customerPage ? <NextIntlClientProvider>{page}</NextIntlClientProvider> : <StaffMessages locale={locale}>{page}</StaffMessages>}
        <ImageShrinker />
        <FlagFont />
      </body>
    </html>
  );
}
