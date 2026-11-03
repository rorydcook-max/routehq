"use server";

import { said } from "@/lib/i18n/server-text";
import { createBooking, recordPaymentReceived } from "@/app/actions/bookings";
import { createInlineCustomer } from "@/app/actions/customers";
import { createTransaction } from "@/app/actions/transactions";
import { createVehicle, renewVehicleCompliance } from "@/app/actions/vehicles";
import { assistantRecords } from "@/lib/ask";
import { checkAction } from "@/lib/assistant-actions";
import { assistantRole, mayConfirm } from "@/lib/assistant/permissions";
import { loadAssistantRecords, matchCustomer } from "@/lib/assistant/records";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_BUCKET } from "@/lib/support";

type Done = { ok: true; message: string; link?: { label: string; href: string }; copy?: string } | { ok: false; error: string };

/** A form action that finishes by sending the browser elsewhere throws a redirect; that is success here. */
function isRedirect(error: unknown) {
  return typeof (error as any)?.digest === "string" && (error as any).digest.startsWith("NEXT_REDIRECT");
}

function form(organizationId: string, values: Record<string, string | number | boolean | null | undefined>) {
  const data = new FormData();
  data.set("organizationId", organizationId);
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined && value !== "") data.set(key, String(value));
  }
  return data;
}

const DIAL_CODES: Record<string, string> = { TH: "+66", MY: "+60", ID: "+62", PH: "+63", VN: "+84", SG: "+65", KH: "+855", LA: "+856" };
const TASKS = new Set(["record_cost", "record_payment", "create_booking"]);

/**
 * Runs a change the person has just confirmed on an assistant card (with any values they changed on it). The values
 * are checked again here against the real records and the person's role, then saved through the same code the
 * ordinary forms use, so the assistant can't do anything a form can't.
 */
export async function confirmAssistantAction(kind: string, args: Record<string, unknown>): Promise<Done> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (!mayConfirm(String(kind), assistantRole(membership.role))) {
    return { ok: false, error: await said(TASKS.has(kind) ? "You can't do this from your account." : "Only the business owner can do this.") };
  }
  const values = args && typeof args === "object" ? args : {};
  if (TASKS.has(kind)) return confirmTask(kind as "record_cost" | "record_payment" | "create_booking", values, membership.organizationId);

  const records = await assistantRecords();
  const checked = checkAction(String(kind), values, records);
  if (!checked.ok) return { ok: false, error: await said(checked.error) };
  const a = checked.action.args;
  const organizationId = membership.organizationId;
  // The booking is priced in the business's own money (it was always THB before, wrong for a Malaysian business).
  const currency = records.currency || "THB";

  try {
    if (checked.action.kind === "add_vehicle") {
      try {
        await createVehicle(form(organizationId, { categoryId: a.categoryId, make: a.make, model: a.model, registrationNumber: a.registrationNumber, year: a.year, color: a.color, mileage: a.mileage, dailyRate: a.dailyRate, weeklyRate: a.weeklyRate, monthlyRate: a.monthlyRate, purchasePrice: a.purchasePrice, estimatedValue: a.currentValue, serviceArea: "home_branch" }));
      } catch (error) {
        if (!isRedirect(error)) throw error;
      }
      return { ok: true, message: `${a.make} ${a.model} (${a.registrationNumber}) is in your fleet.`, link: { label: "See your fleet", href: "/fleet" } };
    }

    if (checked.action.kind === "add_transaction") {
      try {
        await createTransaction(form(organizationId, { vehicleId: a.vehicleId, type: a.type, amount: a.amount, transactionDate: a.date, notes: a.notes, supplier: a.supplier }));
      } catch (error) {
        if (!isRedirect(error)) throw error;
      }
      return { ok: true, message: "Recorded.", link: { label: "See transactions", href: "/transactions" } };
    }

    if (checked.action.kind === "create_booking_link") {
      const result = await createBooking(
        form(organizationId, { vehicleId: a.vehicleId, customerId: a.customerId, startDate: a.startDate, endDate: a.endDate, openEnded: a.endDate ? "" : "true", pricingModel: a.pricingModel, rentalRate: a.rentalRate, depositAmount: a.depositAmount, deliveryMethod: "tbd", bookingMode: "booking_link", shareChannel: "copy", currency })
      );
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, message: "Booking created. Send this link to your customer:", copy: result.bookingUrl, link: { label: "Open the booking", href: `/bookings/${result.rentalId}` } };
    }

    await renewVehicleCompliance(form(organizationId, { vehicleId: a.vehicleId, complianceType: a.what, newExpiryDate: a.newExpiryDate, cost: a.cost, notes: a.notes }));
    return { ok: true, message: "Marked as renewed.", link: { label: "Open the vehicle", href: `/fleet/${a.vehicleId}` } };
  } catch (error) {
    return failed(error);
  }
}

async function failed(error: unknown): Promise<Done> {
  if (isRedirect(error)) return { ok: true, message: await said("Done.") };
  // Server code hides its messages in production; this one is safe to show because it is ours.
  const message = error instanceof Error && error.message && !/digest|NEXT_/.test(error.message) ? error.message : "";
  return { ok: false, error: message ? await said(`That couldn't be saved: ${message}`) : await said("That couldn't be saved. Nothing was changed.") };
}

/** The newer cards (cost, payment, booking), open to every member, as their screens are. */
async function confirmTask(kind: "record_cost" | "record_payment" | "create_booking", values: Record<string, unknown>, organizationId: string): Promise<Done> {
  const records = await loadAssistantRecords({ payments: kind === "record_payment" });
  // strict: everything a save needs must be there now (the card may have left the vehicle or price to fill in).
  const checked = checkAction(kind, { ...values, strict: true }, records);
  if (!checked.ok) return { ok: false, error: await said(checked.error) };
  const a = checked.action.args;

  try {
    if (kind === "record_cost") {
      const data = form(organizationId, { vehicleId: a.vehicleId, type: a.type, amount: a.amount, transactionDate: a.date, supplier: a.supplier, notes: a.notes, mileage: a.mileage });
      // The receipt photo sent in the chat goes with the cost, as "Upload a receipt" does. Only from this business's
      // own chat folder.
      const path = typeof a.receiptPath === "string" ? a.receiptPath : "";
      if (path && path.startsWith(`${organizationId}/`)) {
        const { data: blob } = await (createSupabaseAdminClient() as any).storage.from(SUPPORT_BUCKET).download(path);
        if (blob) {
          const name = path.slice(path.lastIndexOf("/") + 1).replace(/^\d+-/, "") || "receipt.jpg";
          data.set("receipt", new File([await blob.arrayBuffer()], name, { type: blob.type || "image/jpeg" }));
        }
      }
      try {
        await createTransaction(data);
      } catch (error) {
        if (!isRedirect(error)) throw error;
      }
      return { ok: true, message: await said("Cost saved."), link: { label: await said("See Money in & out"), href: "/transactions" } };
    }

    if (kind === "record_payment") {
      await recordPaymentReceived(String(a.paymentId), { amount: Number(a.amount), date: String(a.date), method: String(a.method), note: a.note ? String(a.note) : "" } as any);
      return { ok: true, message: await said("Payment saved."), link: { label: await said("Open the booking"), href: `/bookings/${a.rentalId}` } };
    }

    // A booking: the customer they named (an existing one, or added now with their phone), or none, and then the
    // customer fills in their own details from the link.
    let customerId = typeof a.customerId === "string" ? a.customerId : "";
    if (!customerId && a.customerName) {
      const found = matchCustomer(records, String(a.customerName), a.customerPhone ? String(a.customerPhone) : null);
      if (found) customerId = found.id;
      else {
        const organization = (await getDefaultOrganization()) as any;
        const country = String(organization.country_code || organization.settings?.main_location?.country || "TH").toUpperCase();
        const created = await createInlineCustomer(form(organizationId, { fullName: a.customerName, phone: a.customerPhone, phoneCountryCode: DIAL_CODES[country] || "+66" }));
        customerId = created.id;
      }
    }
    const result = await createBooking(
      form(organizationId, {
        vehicleId: a.vehicleId,
        customerId,
        startDate: a.startDate,
        endDate: a.endDate,
        openEnded: a.endDate ? "" : "true",
        pricingModel: a.pricingModel,
        rentalRate: a.rentalRate,
        depositAmount: a.depositAmount,
        deliveryMethod: "tbd",
        bookingMode: "booking_link",
        shareChannel: "copy",
        currency: records.currency || "THB",
        // A price typed for a vehicle that had none is kept on it, as the booking form does.
        saveVehicleRate: "true"
      })
    );
    if (!result.ok) return { ok: false, error: result.error };
    return {
      ok: true,
      message: customerId ? await said("Booking saved. Send this link so they can check and sign:") : await said("Booking saved. Send this link to your customer:"),
      copy: result.bookingUrl,
      link: { label: await said("Open the booking"), href: `/bookings/${result.rentalId}` }
    };
  } catch (error) {
    return failed(error);
  }
}
