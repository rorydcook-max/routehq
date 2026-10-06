import { createTranslator } from "next-intl";
import { supportedLocaleCodes } from "@/lib/i18n/locales";

/**
 * The wording of messages sent to customers (reminders, receipts, answers to
 * requests), in the customer's own language.
 *
 * These are sent from the daily job and from staff actions, where there is no
 * page being shown and so no language in play: the language is the one saved
 * on the customer, which is the one they read their booking page in.
 * Anything not yet translated into a language falls back to English.
 */

type Values = Record<string, string | number>;
export type CustomerMessageText = { locale: string; t: (key: string, values?: Values) => string; label: (key: string) => string };

const supported = new Set<string>(supportedLocaleCodes);
const cache = new Map<string, CustomerMessageText>();

async function load(locale: string): Promise<Record<string, any>> {
  try {
    return (await import(`../../locales/${locale}/common.json`)).default as Record<string, any>;
  } catch {
    return {};
  }
}

export async function customerMessageText(wanted: string | null | undefined): Promise<CustomerMessageText> {
  const locale = wanted && supported.has(wanted) ? wanted : "en";
  const cached = cache.get(locale);
  if (cached) return cached;
  const english = await load("en");
  const own = locale === "en" ? english : await load(locale);
  const messages = {
    customerMessages: { ...(english.customerMessages || {}), ...(own.customerMessages || {}) },
    customer: { ...(english.customer || {}), ...(own.customer || {}) }
  };
  const translate = createTranslator({ locale, messages: messages as any, timeZone: "Asia/Bangkok" }) as any;
  const safe = (path: string, values?: Values) => {
    try {
      return String(translate(path, values));
    } catch {
      return "";
    }
  };
  const text: CustomerMessageText = {
    locale,
    t: (key, values) => safe(`customerMessages.${key}`, values),
    // A button or heading exactly as the customer sees it on their booking page.
    label: (key) => safe(`customer.${key}`)
  };
  cache.set(locale, text);
  return text;
}
