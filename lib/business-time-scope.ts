import { AsyncLocalStorage } from "node:async_hooks";

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
