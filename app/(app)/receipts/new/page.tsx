import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { businessToday } from "@/lib/business-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listPaymentsWaiting } from "@/lib/transaction-matching";
import { ReceiptFlow, type ReceiptEntry, type ReceiptPayment } from "./receipt-flow";

/** "Upload a receipt" from the + button: one photo, then where it belongs (Rory, 1 Nov 2026). */
export default async function NewReceiptPage() {
  const t = await getTranslations("money");
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;

  const [entriesResult, waiting] = await Promise.all([
    // Entries of the last three months that have no receipt yet.
    supabase
      .from("transactions")
      .select("id, type, amount, transaction_date, notes, supplier, vehicles!transactions_vehicle_id_fkey(registration_number, make, model), customers!transactions_customer_id_fkey(full_name)")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .is("receipt_document_id", null)
      .gte("transaction_date", businessToday(-90))
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(60),
    listPaymentsWaiting(organization.id).catch(() => [])
  ]);

  const entries: ReceiptEntry[] = (entriesResult.data || []).map((row: any) => ({
    id: row.id,
    type: row.type,
    amount: Math.abs(Number(row.amount || 0)),
    date: String(row.transaction_date || "").slice(0, 10),
    who: row.supplier || row.customers?.full_name || "",
    vehicle: [row.vehicles?.registration_number, row.vehicles?.make, row.vehicles?.model].filter(Boolean).join(" "),
    notes: row.notes || ""
  }));

  const payments: ReceiptPayment[] = waiting
    .filter((item) => item.rentalPaymentId)
    .map((item) => ({
      id: item.rentalPaymentId as string,
      amount: Number(item.amount || 0),
      due: item.dueDate || "",
      who: item.customerName || "",
      vehicle: item.vehicleName || item.vehicleLabel || ""
    }));

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <div className="page-hero mb-5">
          <BackLink href="/transactions" label={t("backLabel")} />
          <h1 className="page-title">{t("rc_title")}</h1>
          <p className="page-subtitle mt-2">{t("rc_subtitle")}</p>
        </div>
        <ReceiptFlow entries={entries} payments={payments} />
      </div>
    </AppShell>
  );
}
