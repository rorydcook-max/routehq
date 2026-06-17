import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildDailySummaryMessage, sendLineMessage } from "@/services/messaging/line";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization") ?? "";
  const cronSecret = process.env.CRON_SECRET ?? "";
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient() as any;

  // Fetch all orgs that have a LINE user ID to send to
  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, name, line_user_id, line_channel_access_token, promptpay_id")
    .not("line_user_id", "is", null)
    .is("deleted_at", null);

  if (orgsError) {
    return NextResponse.json({ error: orgsError.message }, { status: 500 });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86_400_000).toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + "-01";

  const results: Array<{ org: string; success: boolean; error?: string }> = [];

  for (const org of orgs ?? []) {
    const accessToken: string =
      org.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

    if (!accessToken) {
      results.push({ org: org.name, success: false, error: "No LINE channel access token" });
      continue;
    }

    // Parallel data fetch for this org
    const [rentalsRes, vehiclesRes, txRes] = await Promise.all([
      supabase
        .from("rentals")
        .select(
          "id, end_date, status, customers!rentals_customer_id_fkey(full_name, phone), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)"
        )
        .eq("organization_id", org.id)
        .in("status", ["active", "overdue", "due_soon", "booked"])
        .is("deleted_at", null),

      supabase
        .from("vehicles")
        .select("id, make, model, registration_number, metadata")
        .eq("organization_id", org.id)
        .eq("is_active", true)
        .is("deleted_at", null),

      supabase
        .from("transactions")
        .select("amount")
        .eq("organization_id", org.id)
        .not("type", "in", '("deposit_received","deposit_refunded")')
        .neq("is_deposit", true)
        .gte("transaction_date", firstOfMonth)
        .lte("transaction_date", today)
        .is("deleted_at", null)
    ]);

    const rentals: any[] = rentalsRes.data ?? [];
    const vehicles: any[] = vehiclesRes.data ?? [];
    const txRows: any[] = txRes.data ?? [];

    const monthlyRevenue = txRows.reduce((sum: number, t: any) => sum + Number(t.amount ?? 0), 0);

    // Build categorised rental lists
    const returnsToday = rentals
      .filter((r) => r.end_date === today)
      .map((r) => ({
        customerName: r.customers?.full_name ?? "Customer",
        vehicleLabel: vehicleLabel(r.vehicles),
        phone: r.customers?.phone ?? ""
      }));

    const returnsTomorrow = rentals
      .filter((r) => r.end_date === tomorrow)
      .map((r) => ({
        customerName: r.customers?.full_name ?? "Customer",
        vehicleLabel: vehicleLabel(r.vehicles)
      }));

    const overdueRentals = rentals
      .filter((r) => r.status === "overdue" || (r.end_date && r.end_date < today))
      .map((r) => ({
        customerName: r.customers?.full_name ?? "Customer",
        vehicleLabel: vehicleLabel(r.vehicles),
        daysOverdue: r.end_date
          ? Math.ceil((Date.now() - new Date(r.end_date).getTime()) / 86_400_000)
          : 1
      }));

    const activeRentals = rentals.map((r) => ({
      customerName: r.customers?.full_name ?? "Customer",
      vehicleLabel: vehicleLabel(r.vehicles),
      returnDate: r.end_date ?? null,
      daysRemaining: r.end_date
        ? Math.ceil((new Date(r.end_date).getTime() - Date.now()) / 86_400_000)
        : null
    }));

    // Compliance alerts for items expiring within 14 days
    const complianceChecks = [
      { key: "tax_expiry_date", label: "Vehicle Tax (ต่อภาษี)" },
      { key: "porbor_expiry_date", label: "Compulsory Insurance (พรบ)" },
      { key: "insurance_expiry_date", label: "Full Insurance" },
      { key: "next_service_date", label: "Scheduled Service" }
    ];

    const urgentCompliance: Array<{ vehicleLabel: string; item: string; daysUntil: number }> = [];
    for (const v of vehicles) {
      const compliance = v.metadata?.compliance ?? {};
      const vLabel = vehicleLabel(v);
      for (const { key, label } of complianceChecks) {
        const dateStr: string | undefined = compliance[key];
        if (!dateStr) continue;
        const daysUntil = Math.ceil(
          (new Date(dateStr).getTime() - Date.now()) / 86_400_000
        );
        if (daysUntil >= 0 && daysUntil <= 14) {
          urgentCompliance.push({ vehicleLabel: vLabel, item: label, daysUntil });
        }
      }
    }

    const message = buildDailySummaryMessage({
      businessName: org.name,
      activeRentals,
      returnsToday,
      returnsTomorrow,
      overdueRentals,
      urgentCompliance,
      monthlyRevenue
    });

    const sendResult = await sendLineMessage(accessToken, org.line_user_id, [message]);

    // Log to line_messages
    await supabase.from("line_messages").insert({
      organisation_id: org.id,
      type: "daily_summary",
      recipient_line_id: org.line_user_id,
      message_content: message,
      status: sendResult.success ? "sent" : "failed",
      sent_at: sendResult.success ? new Date().toISOString() : null,
      error: sendResult.error ?? null
    });

    results.push({
      org: org.name,
      success: sendResult.success,
      ...(sendResult.error ? { error: sendResult.error } : {})
    });
  }

  return NextResponse.json({ results });
}

function vehicleLabel(v: any): string {
  if (!v) return "Vehicle";
  const parts = [v.make, v.model].filter(Boolean).join(" ");
  return v.registration_number ? `${parts} (${v.registration_number})` : parts || "Vehicle";
}
