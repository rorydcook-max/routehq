import { cookies } from "next/headers";
import { ACTIVE_ORGANIZATION_COOKIE, loadActiveMembership } from "@/lib/auth/active-organization";
import { setBusinessTimeZone } from "@/lib/business-time";
import { setBusinessCountry, setBusinessCurrency, setBusinessDistanceUnit } from "@/lib/business-units";

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
