import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { businessToday } from "@/lib/business-time";

// Business-time dates: a UTC date would flag rent as overdue a day early for runs before 07:00 in Thailand.
const dateOnly = (offsetDays = 0) => businessToday(offsetDays);

function thb(amount: number) {
  return `THB ${Math.round(amount || 0).toLocaleString()}`;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient() as any;
  const today = dateOnly();
  const tomorrow = dateOnly(1);

  const scheduledResult = await supabase
    .from("rental_payments")
    .update({ status: "pending" })
    .eq("status", "scheduled")
    .eq("due_date", today)
    .or("voided.is.null,voided.eq.false")
    .select("id");

  const overdueResult = await supabase
    .from("rental_payments")
    .update({ status: "overdue" })
    .eq("status", "pending")
    .lt("due_date", today)
    .or("voided.is.null,voided.eq.false")
    .select("id");

  const { data: dueTomorrow, error: dueTomorrowError } = await supabase
    .from("rental_payments")
    .select(
      `
      id, amount, due_date, rental_id,
      rentals!rental_payments_rental_id_fkey(
        id, organization_id, customer_id, vehicle_id,
        customers!rentals_customer_id_fkey(full_name),
        vehicles!rentals_vehicle_id_fkey(make, model, registration_number)
      )
    `
    )
    .eq("status", "scheduled")
    .eq("due_date", tomorrow)
    .or("voided.is.null,voided.eq.false");

  if (dueTomorrowError) {
    return NextResponse.json({ error: dueTomorrowError.message }, { status: 500 });
  }

  let tasksCreated = 0;
  for (const payment of dueTomorrow || []) {
    const rental = payment.rentals;
    if (!rental?.organization_id) continue;

    const { data: existingTask } = await supabase
      .from("tasks")
      .select("id")
      .eq("organization_id", rental.organization_id)
      .eq("rental_payment_id", payment.id)
      .is("deleted_at", null)
      .limit(1);

    if (existingTask?.length) continue;

    const customerName = rental.customers?.full_name || "Customer";
    const vehicle = rental.vehicles || {};
    const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "vehicle";
    const plate = vehicle.registration_number ? ` (${vehicle.registration_number})` : "";
    const { error: taskError } = await supabase.from("tasks").insert({
      organization_id: rental.organization_id,
      vehicle_id: rental.vehicle_id || null,
      rental_id: rental.id,
      rental_payment_id: payment.id,
      title: `Payment due tomorrow - ${customerName}`,
      task_type: "payment_reminder",
      due_at: `${payment.due_date}T09:00:00.000Z`,
      completion_notes: `${thb(Number(payment.amount || 0))} due for ${vehicleLabel}${plate}`,
      created_by: null
    });

    if (!taskError) {
      tasksCreated += 1;
    }
  }

  return NextResponse.json({
    success: true,
    scheduledToPending: scheduledResult.data?.length || 0,
    pendingToOverdue: overdueResult.data?.length || 0,
    tasksCreated
  });
}
