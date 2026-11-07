import { cache } from "react";
import type { DistanceUnit } from "@/lib/regional";
import { businessScope } from "@/lib/business-time";

/**
 * Miles or kilometres for the signed-in business (Settings › Rentals; miles by default in the UK), available anywhere
 * without passing it around, the same way as its time zone (lib/business-time.ts):
 *  - server: recorded for the request when the business is loaded (getActiveMembership, getDefaultOrganization);
 *  - browser: recorded by the root layout's ShellBrandProvider.
 * Distances are saved in this unit as typed; nothing is converted.
 */
const requestUnit = cache((): { unit: DistanceUnit | null } => ({ unit: null }));
let pageUnit: DistanceUnit | null = null;

const clean = (unit: unknown): DistanceUnit | null => (unit === "mi" || unit === "km" ? unit : null);

export function setBusinessDistanceUnit(unit: unknown) {
  const valid = clean(unit);
  if (!valid) return;
  const scope = businessScope();
  if (scope) scope.unit = valid;
  try {
    requestUnit().unit = valid;
  } catch {
    // Outside a request.
  }
}

export function rememberPageDistanceUnit(unit: unknown) {
  const valid = clean(unit);
  if (!valid) return;
  pageUnit = valid;
  const scope = businessScope();
  if (scope) scope.unit = valid;
}

export function businessDistanceUnit(): DistanceUnit {
  if (typeof window !== "undefined") return pageUnit || "km";
  const held = clean(businessScope()?.unit);
  if (held) return held;
  try {
    return requestUnit().unit || pageUnit || "km";
  } catch {
    return pageUnit || "km";
  }
}

/** The message key for this unit: "kmToGo" for km, "kmToGoMi" for miles (both in locales/<lang>/common.json). */
export function distanceKey(key: string, unit: DistanceUnit = businessDistanceUnit()) {
  return unit === "mi" ? `${key}Mi` : key;
}

/**
 * The business's currency (THB, GBP, EUR...), the same way: the default for money boxes, symbols and amounts that are
 * not told a currency, so a UK business never sees "฿" where nobody passed one.
 */
const requestCurrency = cache((): { code: string | null } => ({ code: null }));
let pageCurrency: string | null = null;
const cleanCurrency = (code: unknown) => (/^[A-Z]{3}$/.test(String(code || "").toUpperCase()) ? String(code).toUpperCase() : null);

export function setBusinessCurrency(code: unknown) {
  const valid = cleanCurrency(code);
  if (!valid) return;
  const scope = businessScope();
  if (scope) scope.currency = valid;
  try {
    requestCurrency().code = valid;
  } catch {
    // Outside a request.
  }
}

export function rememberPageCurrency(code: unknown) {
  const valid = cleanCurrency(code);
  if (!valid) return;
  pageCurrency = valid;
  const scope = businessScope();
  if (scope) scope.currency = valid;
}

export function businessCurrency(): string {
  if (typeof window !== "undefined") return pageCurrency || "THB";
  const held = businessScope()?.currency;
  if (held) return held;
  try {
    return requestCurrency().code || pageCurrency || "THB";
  } catch {
    return pageCurrency || "THB";
  }
}

/**
 * The business's country (TH, GB, PT...), the same way, for choices that only exist in some countries, such as
 * PromptPay (lib/payment-methods.ts). Null when it isn't known.
 */
const requestCountry = cache((): { code: string | null } => ({ code: null }));
let pageCountry: string | null = null;
const cleanCountry = (code: unknown) => (/^[A-Z]{2}$/.test(String(code || "").toUpperCase()) ? String(code).toUpperCase() : null);

export function setBusinessCountry(code: unknown) {
  const valid = cleanCountry(code);
  if (!valid) return;
  const scope = businessScope();
  if (scope) scope.country = valid;
  try {
    requestCountry().code = valid;
  } catch {
    // Outside a request.
  }
}

/**
 * Recorded as given, none included: the country decides how dates are written, so one left over from an earlier
 * page (another business, or a staff page drawn on the same server) must not carry over to a page with none.
 */
export function rememberPageCountry(code: unknown) {
  pageCountry = cleanCountry(code);
  // Drawn on the server: client components there write dates the same way the browser will.
  const scope = businessScope();
  if (scope) scope.country = pageCountry;
}

export function businessCountry(): string | null {
  if (typeof window !== "undefined") return pageCountry;
  const scope = businessScope();
  if (scope && scope.country !== undefined) return scope.country || null;
  try {
    return requestCountry().code || pageCountry;
  } catch {
    return pageCountry;
  }
}
