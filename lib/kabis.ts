import { toWallTime } from "@/lib/business-time";
import { cleanTcKimlikNo, licenceCategoriesText } from "@/lib/licence";
import { orgCountry } from "@/lib/regional";

/**
 * KABİS (Kiralık Araç Bildirim Sistemi): Türkiye's police register of vehicle rentals (Rory, 4 Nov 2026).
 *
 * Rental businesses must keep each renter's identity and the rented vehicle on the Interior Ministry's system, day by
 * day, connected to the police (Identity Notification Law No. 1774, additional articles 2-3, and its implementing
 * regulation, 2015). Since Law No. 7574 (Resmî Gazete 27 Feb 2026, art. 31, adding to Highway Traffic Act 2918 art. 116)
 * a traffic fine on a rented vehicle is issued to the renter when the police data show who rented it on that day, so
 * an entry missed or mistyped leaves the fine with the business.
 *
 * There is no public API: entries are made in the EGM web portal (KABIS_URL) by the business. RoveHQ can't submit for
 * them, so it keeps exactly what an entry asks for on the customer and booking, and shows it on Turkish bookings with a
 * copy button per line (app/(app)/bookings/[id]/kabis-details.tsx) and a to-do at handover (lib/rental-activation.ts).
 *
 * The field list follows public descriptions of the portal (renter name and T.C. Kimlik No or passport and
 * nationality, licence, plate, rental start and end, contact details); the portal is not public, so the exact set is an
 * open point to check with a Turkish operator (content/contracts/tr.yaml, open points).
 */

/** The EGM rental-notification portal (business login; registration is through the local police unit). */
export const KABIS_URL = "https://arackiralama.egm.gov.tr";

/** The to-do raised at handover for a Turkish business (tasks.action). */
export const KABIS_TASK_ACTION = "kabis";

export type KabisField = {
  /** booking namespace message key for the label: kabis_<key>. */
  key: string;
  value: string;
  /** Needed for the entry and not on the customer or booking yet. */
  missing: boolean;
};

/** KABİS applies to rentals by a business in Türkiye only. */
export function isKabisBusiness(organization: any): boolean {
  return orgCountry(organization) === "TR";
}

const TURKISH = /^(tr|tur|turkey|türkiye|turkiye|turkish|türk|turk|t\.c\.?)$/i;

/** A Turkish citizen enters with their T.C. Kimlik No; anyone else with their passport and nationality. */
export function isTurkishCitizen(customer: any): boolean {
  return Boolean(cleanTcKimlikNo(customer?.national_id_number)) || TURKISH.test(String(customer?.nationality || "").trim());
}

/** "2026-11-04" or an ISO time -> "04.11.2026" (the Turkish way of writing a date). */
export function kabisDate(value: unknown, timeZone?: string): string {
  const wall = toWallTime(value, timeZone);
  const match = wall.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}.${match[2]}.${match[1]}` : "";
}

/** An ISO time -> "14:30" on the business's clock; "" for a date with no time. */
export function kabisTime(value: unknown, timeZone?: string): string {
  const text = String(value ?? "");
  if (!/T\d{2}:\d{2}/.test(text) && !/ \d{2}:\d{2}/.test(text)) return "";
  const match = toWallTime(value, timeZone).match(/T(\d{2}:\d{2})/);
  return match ? match[1] : "";
}

const text = (value: unknown) => String(value ?? "").trim();

/**
 * The lines of a KABİS entry for one booking, in the portal's order. Every line is shown (a missing one says so), so
 * the business sees at a glance what to ask the renter for before the vehicle goes out.
 */
export function kabisFields(input: { customer: any; vehicle: any; rental: any; bookingLink?: any; timeZone?: string }): KabisField[] {
  const { customer, vehicle, rental } = input;
  const data = (input.bookingLink?.booking_data || {}) as Record<string, any>;
  const zone = input.timeZone;
  const turkish = isTurkishCitizen(customer);
  const start = rental?.delivery_datetime || data.delivery_datetime || rental?.start_date;
  const end = rental?.end_date;
  const field = (key: string, value: unknown, needed = true): KabisField => {
    const shown = text(value);
    return { key, value: shown, missing: needed && !shown };
  };
  const name = text(customer?.full_name);
  const parts = name.split(/\s+/).filter(Boolean);
  const surname = parts.length > 1 ? parts[parts.length - 1] : "";
  const given = parts.length > 1 ? parts.slice(0, -1).join(" ") : name;
  return [
    field("name", given),
    field("surname", surname),
    field("nationality", customer?.nationality || data.nationality || data.ocr_nationality),
    turkish
      ? field("tcKimlik", cleanTcKimlikNo(customer?.national_id_number))
      : field("passport", customer?.passport_number || data.passport_number || data.ocr_passport_number),
    field("birthDate", kabisDate(customer?.date_of_birth)),
    field("licenceNo", customer?.driver_license_number || data.licence_number || data.ocr_licence_number),
    field("licenceClass", licenceCategoriesText(customer?.license_type) || customer?.license_type),
    field("licenceIssued", kabisDate(customer?.driver_license_issued)),
    field("licenceCountry", customer?.driver_license_country || data.licence_country || data.ocr_licence_country, !turkish),
    field("phone", customer?.phone || customer?.whatsapp_number),
    field("address", customer?.address || data.collection_address),
    field("plate", vehicle?.registration_number),
    field("vehicle", [vehicle?.make, vehicle?.model].filter(Boolean).join(" "), false),
    field("startDate", kabisDate(start, zone)),
    field("startTime", kabisTime(start, zone), false),
    field("endDate", end ? kabisDate(end, zone) : "", !rental?.is_indefinite),
    field("endTime", end ? kabisTime(end, zone) : "", false)
  ];
}

/** How many needed lines are still empty. */
export function kabisMissingCount(fields: KabisField[]): number {
  return fields.filter((item) => item.missing).length;
}
