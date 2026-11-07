import { createTranslator } from "next-intl";
import { emailLocale } from "@/lib/email/words";
import { shortDate } from "@/lib/i18n/dates";

/**
 * The words of alerts to the business (lib/notify-operator.ts: device alert, LINE, Telegram, email) and of the morning
 * summary's email subject, in the operator's language (Rory, 4 Nov 2026): the first active owner's own app language,
 * else the business's language, else English. The sentences are ICU messages in the "operatorAlerts" namespace of
 * locales/<lang>/common.json; anything missing in a language falls back to English.
 *
 * A caller describes the alert rather than writing it out:
 *   { emoji: "🧾", key: "receiptSent", values: { amount: "฿1,200" } }
 * Names that may be missing (customer, next, vehicle, partner) can be passed as null and get a neutral word; ISO dates
 * go in `dates` and are written the reader's way ("4 Nov", "4 พ.ย."); `then` adds further sentences.
 */

export type AlertKey =
  | "contractSigned"
  | "contractSignedFor"
  | "cantSignYet"
  | "agreementNotReady"
  | "receiptSent"
  | "extensionRequested"
  | "extensionRequestedReason"
  | "returnConfirmed"
  | "problemReported"
  | "questionAsked"
  | "portalActionOther"
  | "extendedAuto"
  | "openEndedAuto"
  | "bookingCreated"
  | "bookingCreatedNoCustomer"
  | "bookingCancelled"
  | "whenRange"
  | "whenMonthly"
  | "whenOpenEnded"
  | "cancelPaid"
  | "cancelReceipt"
  | "supportReplied"
  | "supportJoined"
  | "returnComplete"
  | "onlineBooking"
  | "planActive"
  | "vehicleChangeSigned"
  | "holdEnded"
  | "referral"
  | "setupDone"
  | "lateReturn"
  | "lateHandoverPast"
  | "lateHandoverToday"
  | "lateHandoverSoon"
  | "nudgeFirstVehicle"
  | "nudgeCurrentRentals"
  | "nudgeReminders"
  | "nudgeBookingPage"
  | "nudgeSignature"
  | "nudgePaymentMethods";

type Value = string | number | null | undefined;

export type AlertText = {
  key: AlertKey;
  /** Shown before the words in chats and on the phone (not part of the translation). */
  emoji?: string;
  values?: Record<string, Value | AlertText>;
  /** ISO dates ("2026-11-04"), written the reader's way. */
  dates?: Record<string, string | null | undefined>;
  /** Further sentences, each added after a space. */
  then?: Array<AlertText | null | undefined | false>;
};

/** Alert titles by notifyOperator type. Types without one show "RoveHQ". */
const TITLE_KEYS: Record<string, string> = {
  portal_action: "titlePortalAction",
  payment_received: "titlePaymentReceived",
  contract_signed: "titleContractSigned",
  return_inspection: "titleReturnInspection",
  new_message: "titleNewMessage",
  support_reply: "titleSupportReply",
  plan_activated: "titlePlanActivated"
};

/** The neutral word for a name that is missing. */
const FALLBACKS: Record<string, string> = {
  customer: "fallbackCustomer",
  next: "fallbackNextCustomer",
  vehicle: "fallbackVehicle",
  partner: "fallbackPartner"
};

export type OperatorAlertText = {
  locale: string;
  /** The alert's title for this notifyOperator type ("Customer request"), or "RoveHQ". */
  title: (type: string) => string;
  /** The alert's words, with its emoji in front when `withEmoji`. */
  render: (text: AlertText, withEmoji?: boolean) => string;
  /** One message of the namespace by key ("summarySubject"). */
  say: (key: string, values?: Record<string, string | number>) => string;
};

const cache = new Map<string, Promise<OperatorAlertText>>();

async function namespace(locale: string): Promise<Record<string, string>> {
  try {
    const messages = (await import(`../locales/${locale}/common.json`)).default as Record<string, any>;
    return (messages.operatorAlerts || {}) as Record<string, string>;
  } catch {
    return {};
  }
}

/** Builds the text helpers from already-loaded namespaces (scripts can read the JSON files themselves). */
export function operatorAlertTextFrom(locale: string, english: Record<string, string>, own: Record<string, string> | null | undefined): OperatorAlertText {
  const merged = { ...english, ...(own || {}) };
  let failed = false;
  const onError = () => {
    failed = true;
  };
  const translate = createTranslator({ locale, messages: { operatorAlerts: merged } as any, onError }) as any;
  const englishTranslate = createTranslator({ locale: "en", messages: { operatorAlerts: english } as any, onError }) as any;
  // A translation that can't be formatted falls back to the English sentence, never to the key.
  const attempt = (run: any, key: string, values?: Record<string, string | number>): string | null => {
    failed = false;
    try {
      const text = String(run(`operatorAlerts.${key}`, values));
      return failed ? null : text;
    } catch {
      return null;
    }
  };
  const say = (key: string, values?: Record<string, string | number>) => attempt(translate, key, values) ?? attempt(englishTranslate, key, values) ?? key;
  const capitalise = (text: string) => {
    const [first, ...rest] = Array.from(text);
    return first ? first.toLocaleUpperCase(locale) + rest.join("") : text;
  };
  const sentence = (text: AlertText): string => {
    const values: Record<string, string | number> = {};
    for (const [name, value] of Object.entries(text.values || {})) {
      if (value && typeof value === "object") values[name] = sentence(value as AlertText);
      else if (value === null || value === undefined || value === "") values[name] = FALLBACKS[name] ? say(FALLBACKS[name]) : "";
      else values[name] = value as string | number;
    }
    for (const [name, iso] of Object.entries(text.dates || {})) values[name] = iso ? shortDate(String(iso).slice(0, 10), locale) : "";
    const parts = [say(text.key, values), ...(text.then || []).filter((part): part is AlertText => Boolean(part)).map(sentence)];
    // A date written with a full stop ("9. Nov.") at the end of a sentence would leave "..".
    return parts.filter(Boolean).join(" ").replace(/(?<!\.)\.\.(?!\.)/g, ".");
  };
  return {
    locale,
    title: (type) => (TITLE_KEYS[type] ? say(TITLE_KEYS[type]) : "RoveHQ"),
    render: (text, withEmoji = true) => {
      const words = capitalise(sentence(text));
      return withEmoji && text.emoji ? `${text.emoji} ${words}` : words;
    },
    say
  };
}

/** The alert words in this language (any spelling: "th-TH", "zh-Hant"); English when it isn't one of ours. */
export function operatorAlertText(wanted: string | null | undefined): Promise<OperatorAlertText> {
  const locale = emailLocale(wanted);
  let pending = cache.get(locale);
  if (!pending) {
    pending = Promise.all([namespace("en"), locale === "en" ? Promise.resolve(null) : namespace(locale)]).then(([english, own]) => operatorAlertTextFrom(locale, english, own));
    cache.set(locale, pending);
  }
  return pending;
}

/**
 * The operator's language: the first active owner's own app language, else the business's language, else English.
 * The same rule the morning summary uses (lib/line/daily-summary.ts).
 */
export async function operatorLocale(supabase: any, organisationId: string, businessLocale: string | null | undefined): Promise<string> {
  try {
    const { data: owner } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", organisationId)
      .eq("role", "owner")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();
    if (owner?.user_id) {
      const { data: user } = await supabase.from("users").select("preferred_locale").eq("id", owner.user_id).maybeSingle();
      if (user?.preferred_locale) return String(user.preferred_locale);
    }
  } catch {
    // Fall back to the business's language.
  }
  return String(businessLocale || "en");
}

/** Whether a notifyOperator message is a described alert rather than ready-made words. */
export function isAlertText(message: unknown): message is AlertText {
  return Boolean(message && typeof message === "object" && typeof (message as AlertText).key === "string");
}
