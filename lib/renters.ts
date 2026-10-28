/**
 * Lokalfleet's own copy of renters who said yes to partner offers (migration 0103): one renter across every business they
 * rented from, with their contact details and a snapshot of each rental, kept for Lokalfleet's offers and partners.
 *
 * Only renters whose latest answer is yes to the wording that covers it (version RENTER_HISTORY_VERSION or later) are
 * copied. A no deletes the copy (contact details and rentals), leaving only the match keys and dates.
 * Server only (service role).
 */
import { customerMatchKeys } from "@/lib/customer-history";

/** The partner-offers wording that tells the renter Lokalfleet keeps their details and rental history. */
export const RENTER_HISTORY_VERSION = "2026-10-25b";

type Admin = any;

/** The renter's latest answer, whichever business's booking page they gave it on. */
async function latestChoice(admin: Admin, customerIds: string[]) {
  const { data } = await admin
    .from("renter_consents")
    .select("granted, wording_version, created_at")
    .in("customer_id", customerIds)
    .eq("purpose", "partner_offers")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { granted: boolean; wording_version: string; created_at: string } | null;
}

/** The renter this customer is, found by phone or document (any business), or null. */
async function findRenter(admin: Admin, keys: string[], organizationId: string, customerId: string) {
  const { data: linked } = await admin.from("renter_sources").select("renter_id").eq("organization_id", organizationId).eq("customer_id", customerId).maybeSingle();
  if (linked?.renter_id) return String(linked.renter_id);
  if (!keys.length) return null;
  const { data } = await admin.from("renters").select("id").overlaps("match_keys", keys).order("created_at").limit(1).maybeSingle();
  return data?.id ? String(data.id) : null;
}

/** Brings Lokalfleet's copy of one customer up to date: copies, refreshes or (after a no) deletes it. */
export async function syncRenterFromCustomer(admin: Admin, customerId: string): Promise<"copied" | "removed" | "skipped"> {
  const { data: customer } = await admin
    .from("customers")
    .select("id, organization_id, full_name, phone, email, whatsapp, whatsapp_number, line_id, nationality, driver_license_country, preferred_locale, date_of_birth, passport_number, driver_license_number")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return "skipped";
  const keys = customerMatchKeys(customer);
  const renterId = await findRenter(admin, keys, customer.organization_id, customer.id);
  const { data: linkedRows } = renterId ? await admin.from("renter_sources").select("customer_id").eq("renter_id", renterId) : { data: [] };
  const choice = await latestChoice(admin, Array.from(new Set([customer.id, ...((linkedRows || []) as Array<{ customer_id: string }>).map((row) => row.customer_id)])));
  const covered = Boolean(choice?.granted) && String(choice?.wording_version || "") >= RENTER_HISTORY_VERSION;

  if (!covered) {
    if (!renterId) return "skipped";
    // A no (or an older yes that didn't cover keeping their history): only the keys and dates stay.
    await admin.from("renter_rentals").delete().eq("renter_id", renterId);
    await admin
      .from("renters")
      .update({ offers: false, withdrawn_at: choice && !choice.granted ? choice.created_at : new Date().toISOString(), full_name: null, phone: null, email: null, whatsapp: null, line_id: null, nationality: null, licence_country: null, language: null, date_of_birth: null, first_rental_on: null, last_rental_on: null, updated_at: new Date().toISOString() })
      .eq("id", renterId);
    return "removed";
  }

  const contact = {
    full_name: customer.full_name || null,
    phone: customer.phone || null,
    email: customer.email || null,
    whatsapp: customer.whatsapp_number || customer.whatsapp || null,
    line_id: customer.line_id || null,
    nationality: customer.nationality || null,
    licence_country: customer.driver_license_country || null,
    language: customer.preferred_locale || null,
    date_of_birth: customer.date_of_birth || null,
    offers: true,
    consented_at: choice!.created_at,
    consent_version: choice!.wording_version,
    withdrawn_at: null,
    updated_at: new Date().toISOString()
  };
  let id = renterId;
  if (id) {
    const { data: existing } = await admin.from("renters").select("match_keys").eq("id", id).maybeSingle();
    const merged = Array.from(new Set([...(existing?.match_keys || []), ...keys]));
    await admin.from("renters").update({ ...contact, match_keys: merged }).eq("id", id);
  } else {
    const { data: created, error } = await admin.from("renters").insert({ ...contact, match_keys: keys }).select("id").single();
    if (error || !created) return "skipped";
    id = String(created.id);
  }
  await admin.from("renter_sources").upsert({ renter_id: id, organization_id: customer.organization_id, customer_id: customer.id }, { onConflict: "organization_id,customer_id" });

  // Every rental of every business record linked to this renter, as of now.
  const { data: sources } = await admin.from("renter_sources").select("customer_id").eq("renter_id", id);
  const customerIds = ((sources || []) as Array<{ customer_id: string }>).map((row) => row.customer_id);
  const { data: facts } = await admin.rpc("renter_rental_facts", { p_customer_ids: customerIds });
  const rows = ((facts || []) as any[]).map(({ customer_id: _customer, ...fact }) => ({ ...fact, renter_id: id, updated_at: new Date().toISOString() }));
  if (rows.length) await admin.from("renter_rentals").upsert(rows, { onConflict: "rental_id" });
  const dates = rows.map((row) => String(row.start_date || "")).filter(Boolean).sort();
  if (dates.length) await admin.from("renters").update({ first_rental_on: dates[0], last_rental_on: dates[dates.length - 1] }).eq("id", id);
  return "copied";
}

/** Daily: refresh every renter whose answer is yes (status, payments, deposit, mileage change as rentals go on). */
export async function refreshAllRenters(admin: Admin) {
  const { data: sources } = await admin.from("renter_sources").select("customer_id, renters!inner(offers)").eq("renters.offers", true).limit(5000);
  let refreshed = 0;
  for (const row of (sources || []) as Array<{ customer_id: string }>) {
    const result = await syncRenterFromCustomer(admin, row.customer_id).catch(() => "skipped");
    if (result === "copied") refreshed += 1;
  }
  return refreshed;
}
