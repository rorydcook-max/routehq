import { businessToday } from "@/lib/business-time";
import { customerPaymentLabel } from "@/lib/payment-labels";
import { promptPayQrSvg } from "@/lib/promptpay";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Paying without a payment provider: the customer pays (PromptPay QR with the
 * amount filled in, bank transfer, Wise...) and sends a photo of the receipt
 * from their booking page. The operator looks at it and confirms with one tap.
 * The receipt is kept on the scheduled payment itself (metadata.receipt), so
 * the payment schedule stays the one source of truth.
 */

export type PaymentReceipt = {
  path: string;
  submitted_at: string;
  method: string;
  note: string | null;
  /** The payment the customer picked; the receipt may cover more (see covers). */
  primary?: string;
  covers?: string[];
  /** Total of the payments the customer says this receipt is for. */
  amount?: number;
};

/** Several payments paid in one go: one QR for the total, one receipt for all. */
export type PortalBundle = {
  ids: string[];
  amount: number;
  currency: string;
  qrSvg: string | null;
};

export type PortalPayment = {
  id: string;
  label: string;
  /** What the payment is for, so the customer's page can name it in their language. */
  kind?: "rent" | "deposit" | "deposit_top_up" | "extension" | "charge" | "extras";
  /** For a charge: what it is for (as the owner wrote it), or the reasons the return form gave. */
  chargeNote?: string | null;
  chargeReasons?: string[];
  /** "October 2026", "3 days": the stretch of rent it covers, as written when it was scheduled. */
  periodLabel?: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  overdue: boolean;
  /** PromptPay QR that already carries this amount; null when the business has no PromptPay ID. */
  qrSvg: string | null;
  receiptSentAt: string | null;
  /** The business looked at an earlier receipt and could not match it. */
  receiptDeclined: boolean;
};

export const RECEIPT_METHODS = ["promptpay", "bank_transfer", "wise", "revolut", "other"] as const;

export function receiptOf(metadata: any): PaymentReceipt | null {
  const receipt = metadata?.receipt;
  return receipt && typeof receipt === "object" && typeof receipt.path === "string" && receipt.path ? (receipt as PaymentReceipt) : null;
}

function isVoided(payment: any) {
  return payment.voided === true || String(payment.metadata?.voided || "") === "true";
}

function addDays(iso: string, days: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/**
 * What the customer can pay from their booking page: anything overdue, anything
 * due in the next five weeks, and otherwise just the next payment.
 */
export async function getPortalPayments(
  rentalId: string,
  promptPayId: string | null | undefined
): Promise<{ payments: PortalPayment[]; bundle: PortalBundle | null }> {
  if (!rentalId) return { payments: [], bundle: null };
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("rental_payments")
    .select("id, due_date, amount, currency, status, voided, metadata")
    .eq("rental_id", rentalId)
    .is("deleted_at", null)
    .not("status", "in", "(paid,voided,waived,cancelled)")
    .order("due_date", { ascending: true });

  const today = businessToday();
  const horizon = addDays(today, 35);
  const open = ((data || []) as any[]).filter((row) => !isVoided(row) && Number(row.amount || 0) > 0);
  const soon = open.filter((row) => String(row.due_date || "").slice(0, 10) <= horizon);
  const shown = (soon.length ? soon : open.slice(0, 1)).slice(0, 6);

  const payments = await Promise.all(
    shown.map(async (row) => {
      const amount = Number(row.amount || 0);
      const dueDate = String(row.due_date || "").slice(0, 10);
      const currency = String(row.currency || "THB");
      const receipt = receiptOf(row.metadata);
      return {
        id: String(row.id),
        label: customerPaymentLabel(row.metadata),
      kind: (row.metadata?.type === "deposit" || row.metadata?.is_deposit === true ? "deposit" : row.metadata?.type === "deposit_top_up" ? "deposit_top_up" : row.metadata?.type === "extension" ? "extension" : row.metadata?.type === "charge" ? "charge" : row.metadata?.type === "extras" ? "extras" : "rent") as PortalPayment["kind"],
      chargeNote: row.metadata?.type === "charge" && row.metadata?.description ? String(row.metadata.description) : null,
      chargeReasons: row.metadata?.type === "charge" && Array.isArray(row.metadata?.charge_reasons) ? row.metadata.charge_reasons.map(String) : [],
      periodLabel: row.metadata?.period_label ? String(row.metadata.period_label) : null,
        amount,
        currency,
        dueDate,
        overdue: !!dueDate && dueDate < today,
        // PromptPay only moves baht.
        qrSvg: promptPayId && currency === "THB" ? await promptPayQrSvg(promptPayId, amount) : null,
        receiptSentAt: receipt?.submitted_at || null,
        receiptDeclined: !receipt && !!row.metadata?.receipt_declined_at
      };
    })
  );

  // Rent and deposit due together are usually sent as one transfer.
  // Only what is due now: anything overdue, and whatever falls due with the next payment.
  const waiting = payments.filter((payment) => !payment.receiptSentAt);
  const firstDue = waiting[0]?.dueDate || today;
  const together = addDays(firstDue > today ? firstDue : today, 3);
  const unpaid = waiting.filter((payment) => payment.dueDate <= together);
  const sameCurrency = unpaid.every((payment) => payment.currency === unpaid[0]?.currency);
  const total = Math.round(unpaid.reduce((sum, payment) => sum + payment.amount, 0) * 100) / 100;
  const bundle: PortalBundle | null =
    unpaid.length >= 2 && sameCurrency
      ? {
          ids: unpaid.map((payment) => payment.id),
          amount: total,
          currency: unpaid[0].currency,
          qrSvg: promptPayId && unpaid[0].currency === "THB" ? await promptPayQrSvg(promptPayId, total) : null
        }
      : null;

  return { payments, bundle };
}

/** A link staff can open to look at a receipt. Lasts an hour. */
export async function signedReceiptUrls(paths: string[]) {
  const urls = new Map<string, string>();
  paths = [...new Set(paths)];
  if (!paths.length) return urls;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.storage.from("documents").createSignedUrls(paths, 3600);
  for (const row of data || []) {
    if (row?.path && row?.signedUrl) urls.set(row.path, row.signedUrl);
  }
  return urls;
}

/** Unpaid payments a customer has sent a receipt for, for the signed-in member's business. */
export async function getReceiptsWaiting(organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("rental_payments")
    .select("id, amount, voided, vehicle_id, metadata, rentals!inner(status, vehicle_id, customers!rentals_customer_id_fkey(full_name))")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("status", "in", "(paid,voided,waived,cancelled)")
    .not("rentals.status", "in", "(cancelled,completed)");
  if (error) console.error("getReceiptsWaiting", error.message);

  const rows = ((data || []) as any[]).filter((row) => !isVoided(row) && receiptOf(row.metadata));
  const vehicleIds = [...new Set(rows.map((row) => row.vehicle_id || row.rentals?.vehicle_id).filter(Boolean))];
  const { data: vehicles } = vehicleIds.length
    ? await supabase.from("vehicles").select("id, make, model").in("id", vehicleIds)
    : { data: [] };
  const names = new Map<string, string>((vehicles || []).map((v: any) => [v.id, [v.make, v.model].filter(Boolean).join(" ")]));

  // One receipt can cover several payments (rent and deposit paid together): it is one thing to check, for the total.
  const byReceipt = new Map<string, { id: string; amount: number; customer: string | null; vehicle: string | null }>();
  for (const row of rows) {
    const path = receiptOf(row.metadata)?.path || String(row.id);
    const existing = byReceipt.get(path);
    if (existing) {
      existing.amount = Math.round((existing.amount + Number(row.amount || 0)) * 100) / 100;
      continue;
    }
    byReceipt.set(path, {
      id: String(row.id),
      amount: Number(row.amount || 0),
      customer: (row.rentals?.customers?.full_name as string) || null,
      vehicle: names.get(row.vehicle_id || row.rentals?.vehicle_id) || null
    });
  }
  return [...byReceipt.values()];
}
