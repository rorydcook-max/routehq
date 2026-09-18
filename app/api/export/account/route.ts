import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

function dataRow(table: string, item: any) {
  const summary =
    table === "vehicles"
      ? [item.make, item.model, item.registration_number].filter(Boolean).join(" ")
      : table === "customers"
        ? item.full_name
        : table === "rentals"
          ? [item.status, item.start_date, item.end_date].filter(Boolean).join(" ")
          : table === "transactions"
            ? [item.type, item.amount, item.transaction_date].filter(Boolean).join(" ")
            : item.name || item.file_name || item.id;

  return [table, item.id, summary, JSON.stringify(item)].map(csvCell).join(",");
}

export async function GET() {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Please log in before exporting data." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError || !membership?.organization_id) {
    return NextResponse.json({ error: membershipError?.message || "No organization found for this user." }, { status: 400 });
  }

  const organizationId = membership.organization_id;
  const [vehicles, customers, rentals, transactions, documents] = await Promise.all([
    supabase.from("vehicles").select("*").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("customers").select("*").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("rentals").select("*").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("transactions").select("*").eq("organization_id", organizationId).is("deleted_at", null),
    supabase.from("documents").select("*").eq("organization_id", organizationId).is("deleted_at", null)
  ]);

  const queryError = [vehicles, customers, rentals, transactions, documents].find((result) => result.error)?.error;
  if (queryError) {
    return NextResponse.json({ error: queryError.message }, { status: 400 });
  }

  const rows = [
    ["table", "id", "summary", "json"].map(csvCell).join(","),
    ...(vehicles.data || []).map((item: any) => dataRow("vehicles", item)),
    ...(customers.data || []).map((item: any) => dataRow("customers", item)),
    ...(rentals.data || []).map((item: any) => dataRow("rentals", item)),
    ...(transactions.data || []).map((item: any) => dataRow("transactions", item)),
    ...(documents.data || []).map((item: any) => dataRow("documents", item))
  ];

  return new Response(rows.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="routehq-export-${new Date().toISOString().slice(0, 10)}.csv"`
    }
  });
}
