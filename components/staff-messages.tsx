"use client";

import { use } from "react";
import { NextIntlClientProvider } from "next-intl";

/**
 * The staff app's words, loaded in the browser as a cached file instead of sent inside every page.
 *
 * Sent from the server, the whole translation (about 250 KB in English, 450 KB in Thai) came again with
 * every save and every refresh, because each save re-sends the page from the top. Here it is a normal
 * script file: downloaded once, kept by the browser until the next release, and never re-sent.
 * Untranslated words fall back to English, the same as on the server (i18n/request.ts).
 */

type Messages = { [key: string]: string | Messages };

function merge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = out[key];
    out[key] =
      value && typeof value === "object" && existing && typeof existing === "object"
        ? merge(existing as Messages, value as Messages)
        : value;
  }
  return out;
}

const loaded = new Map<string, Promise<Messages>>();

function messagesFor(locale: string): Promise<Messages> {
  let pending = loaded.get(locale);
  if (!pending) {
    const english = import("@/locales/en/common.json").then((m) => m.default as unknown as Messages);
    pending =
      locale === "en"
        ? english
        : Promise.all([
            english,
            import(`@/locales/${locale}/common.json`).then((m) => m.default as Messages).catch(() => ({}) as Messages)
          ]).then(([base, own]) => merge(base, own));
    loaded.set(locale, pending);
  }
  return pending;
}

export function StaffMessages({ locale, children }: { locale: string; children: React.ReactNode }) {
  const messages = use(messagesFor(locale));
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone="Asia/Bangkok">
      {children}
    </NextIntlClientProvider>
  );
}
