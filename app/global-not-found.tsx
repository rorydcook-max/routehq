import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { textDirection } from "@/lib/i18n/locales";
import { themeScript } from "@/lib/theme";
import { rootMetadata, rootViewport } from "./root-metadata";
import "@tabler/icons-webfont/dist/tabler-icons.min.css";
import "./globals.css";
import "./theme-dark.css";

export const metadata: Metadata = rootMetadata;
export const viewport: Viewport = rootViewport;

/**
 * An address that matches no page at all. The app and the website each have their own root layout now
 * (app/(app)/layout.tsx and app/(site)/site/[locale]/layout.tsx), so this page brings its own <html>. Same look and
 * words as app/(app)/not-found.tsx: say so plainly and offer the way back, instead of the framework's bare "404".
 */
export default async function GlobalNotFound() {
  const [t, locale] = await Promise.all([getTranslations("errorPages"), getLocale()]);
  return (
    <html dir={textDirection(locale)} lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-5">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--border)] bg-white p-6 text-center shadow-[var(--shadow-sm)]">
            <h1 className="text-xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">{t("notFoundTitle")}</h1>
            <p className="mt-2 text-sm text-[var(--muted)]">{t("notFoundBody")}</p>
            <Link className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--primary)] px-4 text-sm font-semibold text-white" href="/">
              {t("goHome")}
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
