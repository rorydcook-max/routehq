import { cookies } from "next/headers";
import { ACTIVE_ORGANIZATION_COOKIE, loadActiveMembership } from "@/lib/auth/active-organization";
import { setBusinessTimeZone } from "@/lib/business-time";
import { setBusinessCountry, setBusinessCurrency, setBusinessDistanceUnit } from "@/lib/business-units";
import { distanceUnitFor } from "@/lib/regional";

/**
 * Server-side: the active membership for this request, using the remembered
 * business from the cookie when it is still valid. Use this anywhere the app
 * needs "the current user's business" - never take the first membership.
 */
export async function getActiveMembership(supabase: any, userId: string) {
  const cookieStore = await cookies();
  const preferred = cookieStore.get(ACTIVE_ORGANIZATION_COOKIE)?.value || null;
  const result = await loadActiveMembership(supabase, userId, preferred);
  // Everything after this in the request ("today", due dates) uses the business's own clock.
  setBusinessTimeZone(result.timezone);
  setBusinessDistanceUnit(result.distanceUnit);
  setBusinessCurrency(result.currency);
  setBusinessCountry(result.country);
  return result;
}

/**
 * For saves that are given the business's id (handover, return, cash at handover): use that business's clock,
 * currency and country for the rest of the request. Without it "today" fell back to Bangkok, so a handover in
 * New York at 1 pm was dated the next day.
 */
export async function adoptBusinessClock(supabase: any, organizationId: string | null | undefined): Promise<string | null> {
  if (!organizationId) return null;
  const { data } = await supabase.from("organizations").select("timezone, currency, country_code, settings").eq("id", organizationId).maybeSingle();
  if (!data) return null;
  setBusinessTimeZone(data.timezone);
  setBusinessDistanceUnit(distanceUnitFor(data));
  setBusinessCurrency(data.currency);
  setBusinessCountry(data.country_code);
  // Returned for the caller to enter (enterBusinessTimeZone): a server action has no request cache to keep it in.
  return data.timezone || null;
}
