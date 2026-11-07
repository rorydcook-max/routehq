import { AsyncLocalStorage } from "node:async_hooks";
import type { BusinessScope } from "@/lib/business-time";

/**
 * Server only. Scheduled jobs (morning summary, customer reminders) work through many businesses in one run, with no
 * signed-in business to take a clock from. Inside inBusinessTimeZone(zone, ...) every businessToday(), toWallTime()
 * and businessTimeZone() (lib/business-time.ts) follows that business's zone, however deep the call.
 *
 * The store sits on a global, under a symbol lib/business-time.ts reads, so that file never imports a Node module
 * and stays safe in the browser.
 */
const KEY = Symbol.for("rovehq.businessTimeZoneScope");
const holder = globalThis as unknown as Record<symbol, AsyncLocalStorage<string> | undefined>;
const store: AsyncLocalStorage<string> = holder[KEY] || (holder[KEY] = new AsyncLocalStorage<string>());

export function inBusinessTimeZone<T>(zone: string, work: () => T): T {
  return store.run(zone, work);
}

/**
 * For a save (server action) that knows its business: from here on, the rest of this save's work, however deep and
 * across awaits, uses that business's zone. Server actions get no React request cache, so setBusinessTimeZone() there
 * was forgotten and "today" fell back to Bangkok (a New York handover at 1 pm dated the next day). Call it in the
 * action's own body, not inside a helper it awaits, so the zone carries on through the action.
 */
export function enterBusinessTimeZone(zone: string | null | undefined) {
  const text = String(zone || "").trim();
  if (!text) return;
  try {
    new Intl.DateTimeFormat("en", { timeZone: text });
  } catch {
    return;
  }
  store.enterWith(text);
}

const SCOPE_KEY = Symbol.for("rovehq.businessScope");
const scopes = globalThis as unknown as Record<symbol, AsyncLocalStorage<BusinessScope> | undefined>;
const scopeStore: AsyncLocalStorage<BusinessScope> = scopes[SCOPE_KEY] || (scopes[SCOPE_KEY] = new AsyncLocalStorage<BusinessScope>());

/**
 * Opens the holder for this request's business (zone, currency, country, distance unit; read by businessScope() in
 * lib/business-time.ts), or returns the one already open. Call it synchronously as the first thing in a function that
 * loads the business (before its first await): the holder then carries on into the code that awaited it, so a server
 * action that loads its business through getActiveMembership, getCurrentMembership, getDefaultOrganization or
 * adoptBusinessClock keeps that business's clock, money and date format to the end. setBusinessTimeZone() and
 * the setters in lib/business-units.ts fill it.
 */
export function openBusinessScope(): BusinessScope {
  const open = scopeStore.getStore();
  if (open) return open;
  const fresh: BusinessScope = {};
  scopeStore.enterWith(fresh);
  return fresh;
}
