"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { getConsent, hasConsent, onConsentChange } from "@/lib/consent";
import { gaIdFor, gtmIdFor, isTrackedHost, isUntrackedPath, PENDING_EVENT_COOKIE } from "@/lib/analytics";

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

/** Set once GTM's script has been added to the page (it can't be taken out again; withdrawing consent stops it instead). */
let loaded = false;
let defaultsSet = false;
/** Whether the last consent update told Google "granted". */
let granted = false;

// GTM reads gtag-style commands only as an Arguments object, so this must use `arguments`, not a rest array.
function gtag(..._args: unknown[]) {
  window.dataLayer = window.dataLayer || [];
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/** Everything off until the visitor says yes; there is no advertising category, so ads stay denied always. */
function setDefaults() {
  if (defaultsSet) return;
  defaultsSet = true;
  gtag("consent", "default", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied"
  });
}

function currentPathAllowed() {
  return isTrackedHost(window.location.hostname) && !isUntrackedPath(window.location.pathname, window.location.hostname);
}

/** Google's own off switch, checked by the GA4 tag on every hit: on while a customer page is open in the same tab. */
function setPageSwitch(off: boolean) {
  const id = gaIdFor(window.location.hostname);
  if (id) (window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = off;
}

/** Consent granted: the defaults, then the update, then GTM itself (once). */
function grantAndLoad() {
  setDefaults();
  if (!granted) {
    granted = true;
    gtag("consent", "update", { analytics_storage: "granted" });
  }
  if (loaded) return;
  loaded = true;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const add = () => {
    const script = document.createElement("script");
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmIdFor(window.location.hostname)}`;
    document.head.appendChild(script);
  };
  // After the page is interactive and idle, so it never competes with the page's own loading.
  const idle = (window as unknown as { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number }).requestIdleCallback;
  if (idle) idle(add, { timeout: 3000 });
  else window.setTimeout(add, 1);
}

/** Consent withdrawn: tell Google at once; GTM stays on the page until the next load but stores and sends nothing. */
function revoke() {
  if (!granted) return;
  granted = false;
  gtag("consent", "update", { analytics_storage: "denied" });
}

function readPendingEvent() {
  const match = document.cookie.match(new RegExp(`(?:^|; )${PENDING_EVENT_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function clearPendingEvent() {
  document.cookie = `${PENDING_EVENT_COOKIE}=; Path=/; Max-Age=0`;
}

/** A sign-up or sign-in that finished on the server (lib/analytics.ts): pushed once, then the flag is gone. */
function flushPendingEvent() {
  const pending = readPendingEvent();
  if (!pending) return;
  const choice = getConsent();
  // Refused, or a page that is never tracked on this host: drop it. Not chosen yet: keep it (it expires by itself).
  if ((choice && !choice.analytics) || !isTrackedHost(window.location.hostname)) {
    clearPendingEvent();
    return;
  }
  if (!choice || isUntrackedPath(window.location.pathname, window.location.hostname)) return;
  clearPendingEvent();
  const [event, method] = pending.split(":");
  if (event !== "sign_up" && event !== "login") return;
  window.dataLayer = window.dataLayer || [];
  // Only known values pass: the cookie is readable in the browser, so nothing else from it reaches the dataLayer.
  window.dataLayer.push(method === "email" ? { event, method } : { event });
}

/** Load GTM if this page may have it and the visitor has said yes. */
function sync() {
  const allowed = currentPathAllowed();
  setPageSwitch(!allowed);
  if (!allowed) return;
  if (hasConsent("analytics")) grantAndLoad();
  // Pushed with consent, dropped if refused, kept a little while if not chosen yet.
  flushPendingEvent();
}

/**
 * Google Tag Manager behind the cookie notice, in both root layouts (the website's and the platform's). It renders
 * nothing and reads nothing from the request, so the website's pages stay prerendered and cached.
 * Page views on client-side navigation: the GA4 tag's enhanced measurement listens for history changes (Next's
 * router uses pushState), so none are pushed here.
 */
export function GoogleTagManager() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isTrackedHost(window.location.hostname)) {
      // Never tracked here: a stale sign-up flag has nothing to do.
      if (readPendingEvent()) clearPendingEvent();
      return;
    }
    return onConsentChange((choice) => {
      if (choice.analytics) sync();
      else {
        revoke();
        clearPendingEvent();
      }
    });
  }, []);

  // Every page (and every client-side move between pages): a customer page switches tracking off for as long as it's open.
  useEffect(() => {
    if (isTrackedHost(window.location.hostname)) sync();
  }, [pathname]);

  return null;
}
