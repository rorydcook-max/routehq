"use server";

import { revalidatePath } from "next/cache";
import { said } from "@/lib/i18n/server-text";
import { getCurrentMembership, OWNER_ONLY_MESSAGE } from "@/lib/auth/roles";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { countryInfo, defaultCurrency, toCountryCode, validTimeZone } from "@/lib/regional";

type Result = { ok: true } | { ok: false; error: string };

export type RegionalInput = {
  country: string;
  timezone: string;
  currency: string;
  distanceUnit: "km" | "mi";
  vat: { registered: boolean; number: string; rate: number; included: boolean };
};

/**
 * Settings › Rentals › Country and units (owner only): country, time zone, currency, miles or km, VAT.
 * The country is kept as a code (organizations.country_code) and as the name setup saved (settings.main_location.country).
 */
export async function saveRegionalSettings(input: RegionalInput): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY_MESSAGE) };
  const code = toCountryCode(input.country);
  const info = countryInfo(code);
  if (!code || !info) return { ok: false, error: await said("Please pick a country.") };
  const currency = /^[A-Z]{3}$/.test(String(input.currency || "").toUpperCase()) ? String(input.currency).toUpperCase() : defaultCurrency(code);
  const timezone = validTimeZone(input.timezone, code);
  const rate = Math.max(0, Math.min(50, Math.round(Number(input.vat?.rate || 0) * 100) / 100));

  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin
    .from("organizations")
    .select("settings, supported_currencies")
    .eq("id", membership.organizationId)
    .maybeSingle();
  if (!organization) return { ok: false, error: await said("Business not found.") };
  const settings = organization.settings && typeof organization.settings === "object" && !Array.isArray(organization.settings) ? organization.settings : {};
  const mainLocation = settings.main_location && typeof settings.main_location === "object" ? settings.main_location : {};
  const supported = Array.isArray(organization.supported_currencies) ? organization.supported_currencies : [];

  const { error } = await admin
    .from("organizations")
    .update({
      country_code: code,
      timezone,
      currency,
      supported_currencies: Array.from(new Set([currency, ...supported])),
      settings: {
        ...settings,
        main_location: { ...mainLocation, country: info.name },
        preferred_currency: currency,
        distance_unit: input.distanceUnit === "mi" ? "mi" : "km",
        vat: {
          registered: Boolean(input.vat?.registered),
          number: String(input.vat?.number || "").trim().slice(0, 40),
          rate,
          included: input.vat?.included !== false
        }
      }
    })
    .eq("id", membership.organizationId);
  if (error) return { ok: false, error: await said("Couldn't save. Please try again.") };
  revalidatePath("/", "layout");
  return { ok: true };
}
