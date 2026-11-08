/**
 * Cookie consent on RoveHQ's website and platform (GDPR / UK PECR / ePrivacy / Thai PDPA, 3 Nov 2026; rovehq.app too
 * from 4 Nov 2026, each domain keeping its own choice). Google Tag Manager waits on it: components/google-tag-manager.tsx.
 *
 * Browser only, so it works on the website's prerendered pages: nothing is read per request. The choice is kept in
 * localStorage and mirrored in a first-party cookie (rovehq_consent) for 6 months, then asked again.
 * Strictly necessary cookies (sign-in, language, theme) never need consent and are not managed here.
 *
 * For anything optional (Google Analytics):
 *   import { hasConsent, onConsentChange } from "@/lib/consent";
 *   if (hasConsent("analytics")) loadAnalytics();
 *   const stop = onConsentChange((choice) => { if (choice.analytics) loadAnalytics(); });
 * Plain scripts can use window.rovehqConsent.hasConsent("analytics") and listen for the "rovehq:consent" event
 * on window (event.detail is the choice).
 */

export type ConsentCategory = "analytics";
export type ConsentChoice = { analytics: boolean; decidedAt: string; version: number };

export const CONSENT_KEY = "rovehq_consent";
/** Fired on window whenever the choice changes; event.detail is the ConsentChoice. */
export const CONSENT_EVENT = "rovehq:consent";
/** Fired on window to open the choices panel (the footer's "Cookie choices"). */
export const CONSENT_OPEN_EVENT = "rovehq:consent-open";
/** Bump when the categories change, so everyone is asked again. */
const VERSION = 1;
const MAX_AGE_DAYS = 182;

function valid(value: unknown): value is ConsentChoice {
  if (!value || typeof value !== "object") return false;
  const choice = value as ConsentChoice;
  if (choice.version !== VERSION || typeof choice.analytics !== "boolean") return false;
  const at = Date.parse(choice.decidedAt);
  return Number.isFinite(at) && Date.now() - at < MAX_AGE_DAYS * 86_400_000;
}

/** The choice held in the rovehq_consent cookie's value (already URL-decoded), or null. Safe on the server too. */
export function consentFromCookieValue(value: string | null | undefined): ConsentChoice | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return valid(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** The visitor's current choice, or null if they haven't chosen (or it expired). */
export function getConsent(): ConsentChoice | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (valid(parsed)) return parsed;
    }
  } catch {
    // Storage blocked: fall back to the cookie.
  }
  try {
    const match = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_KEY}=([^;]*)`));
    if (match) {
      const parsed = JSON.parse(decodeURIComponent(match[1]));
      if (valid(parsed)) return parsed;
    }
  } catch {
    // Unreadable: treat as not chosen.
  }
  return null;
}

/**
 * A tiny inline script, run while the page is read: marks <html data-consent-set> when the visitor has a valid choice
 * (the same test as getConsent), so the cookie notice drawn with the page is hidden before the first paint for them
 * (components/cookie-banner.tsx; task perf, 8 Nov 2026). Goes in the <head> of every layout that shows the notice.
 */
export function consentChosenScript() {
  return `(function(){try{var k=${JSON.stringify(CONSENT_KEY)};function ok(v){try{var c=JSON.parse(v);return c&&c.version===${VERSION}&&typeof c.analytics==="boolean"&&Date.now()-Date.parse(c.decidedAt)<${MAX_AGE_DAYS * 86_400_000};}catch(e){return false;}}var s=null;try{s=localStorage.getItem(k);}catch(e){}var m=document.cookie.match(new RegExp("(?:^|; )"+k+"=([^;]*)"));if((s&&ok(s))||(m&&ok(decodeURIComponent(m[1]))))document.documentElement.setAttribute("data-consent-set","");}catch(e){}})();`;
}

/** True only when the visitor said yes to this category. No choice yet means no. */
export function hasConsent(category: ConsentCategory): boolean {
  const choice = getConsent();
  return Boolean(choice && choice[category]);
}

/** Save the visitor's choice and tell everything listening. */
export function setConsent(categories: { analytics: boolean }): ConsentChoice {
  const choice: ConsentChoice = { analytics: Boolean(categories.analytics), decidedAt: new Date().toISOString(), version: VERSION };
  const value = JSON.stringify(choice);
  try {
    window.localStorage.setItem(CONSENT_KEY, value);
  } catch {
    // Storage blocked: the cookie still holds it.
  }
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_KEY}=${encodeURIComponent(value)}; Path=/; Max-Age=${MAX_AGE_DAYS * 86_400}; SameSite=Lax${secure}`;
  if (!choice.analytics) clearAnalyticsCookies();
  window.dispatchEvent(new CustomEvent<ConsentChoice>(CONSENT_EVENT, { detail: choice }));
  return choice;
}

/** Call back whenever the choice changes (in this tab or another). Returns a function that stops listening. */
export function onConsentChange(callback: (choice: ConsentChoice) => void): () => void {
  const local = (event: Event) => callback((event as CustomEvent<ConsentChoice>).detail);
  const other = (event: StorageEvent) => {
    if (event.key !== CONSENT_KEY) return;
    const choice = getConsent();
    if (choice) callback(choice);
  };
  window.addEventListener(CONSENT_EVENT, local);
  window.addEventListener("storage", other);
  return () => {
    window.removeEventListener(CONSENT_EVENT, local);
    window.removeEventListener("storage", other);
  };
}

/** Open the cookie choices panel. */
export function openConsentChoices() {
  window.dispatchEvent(new Event(CONSENT_OPEN_EVENT));
}

/** Google Analytics' own cookies (_ga, _ga_<id>), removed when analytics is refused or withdrawn. */
function clearAnalyticsCookies() {
  const names = document.cookie.split("; ").map((part) => part.split("=")[0]).filter((name) => name === "_ga" || name.startsWith("_ga_") || name === "_gid");
  const host = window.location.hostname;
  const domains = ["", host, `.${host}`, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of names) for (const domain of domains) document.cookie = `${name}=; Path=/; Max-Age=0${domain ? `; Domain=${domain}` : ""}`;
}

declare global {
  interface Window {
    rovehqConsent?: { hasConsent: typeof hasConsent; getConsent: typeof getConsent; onChange: typeof onConsentChange; open: typeof openConsentChoices };
  }
}

/** Makes the API available to plain scripts (window.rovehqConsent). Called once by the banner. */
export function exposeConsentApi() {
  window.rovehqConsent = { hasConsent, getConsent, onChange: onConsentChange, open: openConsentChoices };
}
