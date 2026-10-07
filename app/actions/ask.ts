"use server";

import { said } from "@/lib/i18n/server-text";
import { getLocale } from "next-intl/server";
import { createBooking } from "@/app/actions/bookings";
import { createTransaction } from "@/app/actions/transactions";
import { createVehicle, renewVehicleCompliance } from "@/app/actions/vehicles";
import { answerQuestion, assistantRecords, type AskAnswer, type AskTurn } from "@/lib/ask";
import { checkAction } from "@/lib/assistant-actions";
import { getCurrentMembership } from "@/lib/auth/roles";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

const OWNER_ONLY = "Only the business owner can use the assistant.";

/** "Ask RouteHQ": answers a question from the business's records, or proposes a change for the owner to confirm. */
export async function askRouteHq(question: string, history: AskTurn[] = []): Promise<AskAnswer> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  // Money questions and changes are the owner's business; teammates handle day-to-day work.
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY) };

  let language = "English";
  try {
    const locale = await getLocale();
    language = supportedLocaleOptions.find((option) => option.code === locale)?.english || "English";
  } catch {
    // English is fine.
  }
  const turns = (Array.isArray(history) ? history : []).filter((turn) => turn && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string");
  return answerQuestion(question, language, turns);
}

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

/**
 * Runs a change the owner has just confirmed. The values are checked again
 * here against the real records, then saved through the same code the
 * ordinary forms use, so the assistant can't do anything a form can't.
 */
export async function confirmAssistantAction(kind: string, args: Record<string, unknown>): Promise<Done> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  if (membership.role !== "owner") return { ok: false, error: await said(OWNER_ONLY) };

  const checked = checkAction(String(kind), args && typeof args === "object" ? args : {}, await assistantRecords());
  if (!checked.ok) return { ok: false, error: checked.error };
  const a = checked.action.args;
  const organizationId = membership.organizationId;

  try {
    if (checked.action.kind === "add_vehicle") {
      try {
        await createVehicle(form(organizationId, { categoryId: a.categoryId, make: a.make, model: a.model, registrationNumber: a.registrationNumber, year: a.year, color: a.color, mileage: a.mileage, dailyRate: a.dailyRate, weeklyRate: a.weeklyRate, monthlyRate: a.monthlyRate, purchasePrice: a.purchasePrice, serviceArea: "home_branch" }));
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
        form(organizationId, { vehicleId: a.vehicleId, customerId: a.customerId, startDate: a.startDate, endDate: a.endDate, openEnded: a.endDate ? "" : "true", pricingModel: a.pricingModel, rentalRate: a.rentalRate, depositAmount: a.depositAmount, deliveryMethod: "tbd", bookingMode: "booking_link", shareChannel: "copy", currency: "THB" })
      );
      if (!result.ok) return { ok: false, error: result.error };
      return { ok: true, message: "Booking created. Send this link to your customer:", copy: result.bookingUrl, link: { label: "Open the booking", href: `/bookings/${result.rentalId}` } };
    }

    await renewVehicleCompliance(form(organizationId, { vehicleId: a.vehicleId, complianceType: a.what, newExpiryDate: a.newExpiryDate, cost: a.cost, notes: a.notes }));
    return { ok: true, message: "Marked as renewed.", link: { label: "Open the vehicle", href: `/fleet/${a.vehicleId}` } };
  } catch (error) {
    if (isRedirect(error)) return { ok: true, message: "Done." };
    // Server code hides its messages in production; this one is safe to show because it is ours.
    const message = error instanceof Error && error.message && !/digest|NEXT_/.test(error.message) ? error.message : "";
    return { ok: false, error: message ? `That couldn't be saved: ${message}` : "That couldn't be saved. Nothing was changed." };
  }
}
