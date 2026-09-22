import { getRequestConfig } from "next-intl/server";
import { supportedLocaleCodes, type SupportedLocale } from "@/lib/i18n/locales";
import { hasSupabaseEnv } from "@/lib/supabase/config";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Staff interface language.
 *
 * The language comes from the signed-in person's own profile (My account), not
 * from the URL or the business: two people in the same business can each see
 * the app in their own language. Signed-out pages use English.
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
  if (!hasSupabaseEnv()) return "en";
  try {
    const supabase = (await createSupabaseServerClient()) as any;
    const {
      data: { user }
    } = await supabase.auth.getUser();
    if (!user) return "en";
    const { data } = await supabase.from("users").select("preferred_locale").eq("id", user.id).maybeSingle();
    const locale = String(data?.preferred_locale || "");
    return (supported.has(locale) ? locale : "en") as SupportedLocale;
  } catch {
    return "en";
  }
}

async function loadMessages(locale: string): Promise<Messages> {
  try {
    return (await import(`../locales/${locale}/common.json`)).default as Messages;
  } catch {
    return {};
  }
}

export default getRequestConfig(async () => {
  const locale = await resolveLocale();
  const english = await loadMessages("en");
  const messages = locale === "en" ? english : merge(english, await loadMessages(locale));
  return { locale, messages, timeZone: "Asia/Bangkok" };
});
