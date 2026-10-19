import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { textDirection } from "@/lib/i18n/locales";
import { ImageShrinker } from "@/components/image-shrinker";
import { FlagFont } from "@/components/flag-font";
import { BrandStyle } from "@/components/brand-style";
import { ShellBrandProvider } from "@/components/shell-brand-provider";
import { headers } from "next/headers";
import { getCurrentMembership } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { shellBrand } from "@/lib/shell-brand";

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
    apple: "/apple-touch-icon.png"
  },
  // Opens full screen, like an app, when added to a phone's home screen.
  appleWebApp: { capable: true, title: "RouteHQ", statusBarStyle: "default" }
};

export const viewport: Viewport = {
  themeColor: "#0e5e6f"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [locale, brand] = await Promise.all([getLocale(), operatorBrand()]);
  return (
    <html dir={textDirection(locale)} lang={locale}>
      <body>
        <BrandStyle colour={brand?.colour || null} />
        <NextIntlClientProvider>
          <ShellBrandProvider brand={brand}>{children}</ShellBrandProvider>
        </NextIntlClientProvider>
        <ImageShrinker />
        <FlagFont />
      </body>
    </html>
  );
}
