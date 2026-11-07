import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { CUSTOMER_LOCALE_COOKIE, pickLocale } from "@/lib/i18n/customer-locale";
import { supportedLocaleCodes, type SupportedLocale } from "@/lib/i18n/locales";
import { signedOutLocale, STAFF_LOCALE_COOKIE } from "@/lib/i18n/staff-locale";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient, getRequestUser } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";
import { businessTimeZone } from "@/lib/business-time";

/**
 * Staff interface language.
 *
 * The language comes from the signed-in person's own profile (My account), not
 * from the URL or the business: two people in the same business can each see
 * the app in their own language. Before sign-in (and until a language has been
 * saved) it is the one picked on the sign-in page, else the phone's language
 * when the app is fully written in it, else English.
 *
 * Customer pages (booking link, change to sign, online booking) are separate:
 * they follow the customer's own choice or their phone's language.
 *
 * Translations are layered over English, so any string not yet translated into
 * a language shows in English rather than as a blank or a raw key.
 */

const supported = new Set<string>(supportedLocaleCodes);

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

async function resolveLocale(): Promise<SupportedLocale> {
  // Customer pages: the language the customer picked, else the first language their phone asks for that we have.
  try {
    const requestHeaders = await headers();
    if (requestHeaders.get("x-routehq-customer-page")) {
      const chosen = (await cookies()).get(CUSTOMER_LOCALE_COOKIE)?.value || requestHeaders.get("x-routehq-page-lang") || undefined;
      return pickLocale(chosen, requestHeaders.get("accept-language"));
    }
  } catch {
    // No request to read (a build-time render): fall through to the signed-in person's language.
  }
  // Development only: "routehq_preview_locale" shows the staff app in another language without changing anyone's account.
  // ROUTEHQ_PREVIEW_LOCALE=1 allows it on a local production build for language checks; never set it on the live site.
  if (process.env.NODE_ENV !== "production" || process.env.ROUTEHQ_PREVIEW_LOCALE === "1") {
    try {
      const preview = (await cookies()).get("routehq_preview_locale")?.value;
      if (preview && supported.has(preview)) return preview as SupportedLocale;
    } catch {
      // No request to read.
    }
  }
  // Someone not signed in yet, or with no saved language.
  const beforeSignIn = async (): Promise<SupportedLocale> => {
    try {
      return signedOutLocale((await cookies()).get(STAFF_LOCALE_COOKIE)?.value, (await headers()).get("accept-language"));
    } catch {
      return "en";
    }
  };
  if (!hasSupabaseEnv()) return beforeSignIn();
  try {
    // Who is signed in comes from the signed sign-in token, checked once per request (getRequestUser): this runs on
    // every page and every save, and used to be its own trip to the sign-in service each time.
    const [supabase, user] = (await Promise.all([createSupabaseServerClient(), getRequestUser()])) as [any, Awaited<ReturnType<typeof getRequestUser>>];
    if (!user) return beforeSignIn();
    const { data } = await supabase.from("users").select("preferred_locale").eq("id", user.id).maybeSingle();
    const locale = String(data?.preferred_locale || "");
    return supported.has(locale) ? (locale as SupportedLocale) : beforeSignIn();
  } catch {
    return beforeSignIn();
  }
}

/**
 * Dates and times written through next-intl follow the signed-in person's business clock (Europe/London for a UK
 * business), else Thailand's. Customer pages get the business's zone from the page itself (lib/business-time.ts).
 */
async function staffTimeZone(): Promise<string> {
  if (!hasSupabaseEnv()) return businessTimeZone();
  try {
    const [supabase, user] = (await Promise.all([createSupabaseServerClient(), getRequestUser()])) as [any, Awaited<ReturnType<typeof getRequestUser>>];
    if (!user) return businessTimeZone();
    const { timezone } = await getActiveMembership(supabase, user.id);
    return timezone || businessTimeZone();
  } catch {
    return businessTimeZone();
  }
}

async function loadMessages(locale: string): Promise<Messages> {
  try {
    return (await import(`../locales/${locale}/common.json`)).default as Messages;
  } catch {
    return {};
  }
}

// The words the customer pages (booking link, change to sign, online booking, directory) and their error and
// not-found screens use. The staff app's other ~200 KB of text never reaches a customer's phone.
const CUSTOMER_NAMESPACES = ["customer", "directory", "errorPages", "gallery"];

async function isDirectoryPage(): Promise<boolean> {
  try {
    return Boolean((await headers()).get("x-routehq-directory"));
  } catch {
    return false;
  }
}

async function isCustomerPage(): Promise<boolean> {
  try {
    return Boolean((await headers()).get("x-routehq-customer-page"));
  } catch {
    return false;
  }
}

/**
 * RoveHQ's website (app/(site)/site/[locale]) is drawn ahead of time, one copy per language: its layout and pages pass
 * the language from the address (setRequestLocale, lib/site/static-page.ts). It wins over the cookie and the
 * signed-in person's own language, so each address always shows one language (what search engines index), and
 * nothing about the request is read, or those pages would be drawn again for every visit.
 */
async function sitePageLocale(requestLocale: Promise<string | undefined>): Promise<SupportedLocale | null> {
  try {
    const locale = await requestLocale;
    return locale && supported.has(locale) ? (locale as SupportedLocale) : null;
  } catch {
    return null;
  }
}

export default getRequestConfig(async ({ requestLocale }) => {
  const siteLocale = await sitePageLocale(requestLocale);
  if (siteLocale) {
    const english = await loadMessages("en");
    return { locale: siteLocale, messages: siteLocale === "en" ? english : merge(english, await loadMessages(siteLocale)), timeZone: "Asia/Bangkok" };
  }
  const [locale, customerPage, timeZone] = await Promise.all([resolveLocale(), isCustomerPage(), staffTimeZone()]);
  const english = await loadMessages("en");
  const all = locale === "en" ? english : merge(english, await loadMessages(locale));
  const messages: Record<string, any> = customerPage ? Object.fromEntries(CUSTOMER_NAMESPACES.filter((key) => key in all).map((key) => [key, all[key]])) : all;
  // rove.rent's directory search shows the cookie notice (its own analytics): only those few words come along.
  if (customerPage && (await isDirectoryPage()) && all.site && typeof all.site === "object") {
    messages.site = Object.fromEntries(Object.entries(all.site as Record<string, unknown>).filter(([key]) => key.startsWith("cookie")));
  }
  return { locale, messages, timeZone };
});
