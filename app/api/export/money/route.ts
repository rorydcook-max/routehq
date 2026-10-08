import { NextRequest, NextResponse } from "next/server";
import { getLocale, getTranslations } from "next-intl/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isExpenseTransaction, isRawDepositTransaction, isRevenueTransaction } from "@/lib/transaction-options";

export const dynamic = "force-dynamic";

const METHOD_EN: Record<string, string> = { cash: "Cash", bank_transfer: "Bank transfer", promptpay: "PromptPay", card: "Card", other: "Other" };
const METHOD_TH: Record<string, string> = { cash: "เงินสด", bank_transfer: "โอนเข้าบัญชี", promptpay: "พร้อมเพย์", card: "บัตร", other: "อื่นๆ" };
const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

/**
 * Every money in and out between two dates, one line each, for an accountant:
 * date, in or out, category, amount, how it was paid, and the booking, customer
 * and vehicle it belongs to. Deposits are listed but marked as not income.
 * Opens in Excel or Google Sheets (Thai text included).
 */
export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const from = request.nextUrl.searchParams.get("from") || "";
  const to = request.nextUrl.searchParams.get("to") || "";
  const valid = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!valid(from) || !valid(to)) return NextResponse.json({ error: "Choose the dates." }, { status: 400 });

  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const t = (await getTranslations("money")) as unknown as { (key: string): string; has: (key: string) => boolean };
  const locale = await getLocale();
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "transaction_date, type, amount, currency, is_deposit, supplier, notes, voided, void_reason, metadata, rentals!transactions_rental_id_fkey(reference, display_code), customers!transactions_customer_id_fkey(full_name), vehicles!transactions_vehicle_id_fkey(make, model, registration_number)"
    )
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .gte("transaction_date", from)
    .lte("transaction_date", to)
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const th = locale === "th";
  const header = th
    ? ["วันที่", "เข้า/ออก", "หมวด", "จำนวนเงิน", "สกุลเงิน", "นับเป็นรายได้", "ช่องทางชำระ", "การจอง", "ลูกค้า", "รถ", "ทะเบียน", "จ่ายให้", "หมายเหตุ", "ยกเลิกแล้ว"]
    : ["Date", "In/Out", "Category", "Amount", "Currency", "Counts as income", "Paid by", "Booking", "Customer", "Vehicle", "Plate", "Paid to", "Notes", "Cancelled"];
  const yes = th ? "ใช่" : "Yes";
  const no = th ? "ไม่" : "No";
  const lines = [header.map(cell).join(",")];
  for (const row of data || []) {
    const amount = Math.abs(Number(row.amount || 0));
    const deposit = isRawDepositTransaction({ isDeposit: row.is_deposit, type: row.type });
    const out = !deposit && isExpenseTransaction({ isDeposit: row.is_deposit, type: row.type });
    const direction = deposit
      ? row.type === "deposit_refunded"
        ? th ? "คืนมัดจำ" : "Deposit out"
        : th ? "รับมัดจำ" : "Deposit in"
      : out
        ? th ? "ออก" : "Out"
        : th ? "เข้า" : "In";
    const category = t.has(`type_${row.type}`) ? t(`type_${row.type}`) : String(row.type || "");
    lines.push(
      [
        row.transaction_date,
        direction,
        category,
        amount,
        row.currency || organization.currency || "THB",
        !row.voided && isRevenueTransaction({ amount, isDeposit: row.is_deposit, type: row.type }) ? yes : no,
        (th ? METHOD_TH : METHOD_EN)[String(row.metadata?.payment_method || "")] || row.metadata?.payment_method || "",
        row.rentals?.display_code || row.rentals?.reference || "",
        row.customers?.full_name || "",
        [row.vehicles?.make, row.vehicles?.model].filter(Boolean).join(" "),
        row.vehicles?.registration_number || "",
        row.supplier || "",
        String(row.notes || "").replace(/\s+/g, " ").trim(),
        row.voided ? `${yes}${row.void_reason ? `: ${row.void_reason}` : ""}` : ""
      ]
        .map(cell)
        .join(",")
    );
  }

  // The byte-order mark makes Excel read Thai text correctly.
  return new Response(`﻿${lines.join("\r\n")}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="money-${from}-to-${to}.csv"`
    }
  });
}
