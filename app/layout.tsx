import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { textDirection } from "@/lib/i18n/locales";
import { ImageShrinker } from "@/components/image-shrinker";
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
  themeColor: "#0f766e"
};

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html dir={textDirection(locale)} lang={locale}>
      <body>
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <ImageShrinker />
      </body>
    </html>
  );
}
