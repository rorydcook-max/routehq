import { createSupabaseServerClient } from "@/lib/supabase/server";

export { TASK_TYPE_OPTIONS, taskTypeLabel } from "@/lib/task-types";

export type TaskListItem = {
  id: string;
  /** "task" is a to-do someone created; "payment" is an unpaid scheduled payment. */
  kind: "task" | "payment";
  title: string;
  taskType: string;
  dueAt: string | null;
  /** Business-day (Thailand) date the item is due, YYYY-MM-DD. */
  dueDate: string | null;
  completedAt: string | null;
  vehicleLabel: string | null;
  rentalLabel: string | null;
  customerName: string | null;
  vehicleId: string | null;
  rentalId: string | null;
  rentalPaymentId: string | null;
  amount: number | null;
};

const bangkokDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" });

function paymentTitle(metadata: any) {
  const type = String(metadata?.type || "");
  if (type === "deposit" || metadata?.is_deposit === true) return "Collect deposit";
  if (type === "extension") return "Collect extension payment";
  if (type === "deposit_top_up") return "Collect deposit top-up";
  const period = metadata?.period_label ? ` · ${metadata.period_label}` : "";
  return `Collect rent${period}`;
}

function isVoided(payment: any) {
  return payment.voided === true || String(payment.metadata?.voided || "") === "true";
}

/**
 * Open work for the team: tasks people created, plus every unpaid payment on a
 * live booking. Payments come straight from the payment schedule (the one
 * source of truth), so an extension or a rate change shows up without anyone
 * creating a reminder, and a recorded payment disappears at once. The older
 * auto-created "payment reminder" task rows are left out for the same reason.
 */
export async function getTaskList(organizationId: string): Promise<TaskListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const [tasksResult, paymentsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, task_type, due_at, completed_at, vehicle_id, rental_id, rental_payment_id")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .neq("task_type", "payment_reminder")
      .order("due_at", { ascending: true, nullsFirst: false }),
    supabase
      .from("rental_payments")
      .select("id, rental_id, vehicle_id, due_date, amount, status, voided, metadata, rentals!inner(id, status, vehicle_id, reference, display_code, customers!rentals_customer_id_fkey(full_name))")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .not("status", "in", "(paid,voided,waived,cancelled)")
      .not("rentals.status", "in", "(cancelled,completed)")
      .order("due_date", { ascending: true })
  ]);

  if (tasksResult.error) throw new Error(tasksResult.error.message);
  if (paymentsResult.error) throw new Error(paymentsResult.error.message);

  const tasks = tasksResult.data || [];
  const payments = (paymentsResult.data || []).filter((payment: any) => !isVoided(payment) && payment.rentals);

  const vehicleIds = [
    ...new Set([
      ...tasks.map((row: any) => row.vehicle_id),
      ...payments.map((row: any) => row.vehicle_id || row.rentals?.vehicle_id)
    ].filter(Boolean))
  ];
  const rentalIds = [...new Set(tasks.map((row: any) => row.rental_id).filter(Boolean))];

  const [vehiclesResult, rentalsResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, registration_number, make, model").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    rentalIds.length
      ? supabase.from("rentals").select("id, reference, display_code, customers!rentals_customer_id_fkey(full_name)").in("id", rentalIds)
      : Promise.resolve({ data: [] })
  ]);

  const vehicleLabels = new Map<string, string>(
    (vehiclesResult.data || []).map((row: any) => [row.id, [row.make, row.model].filter(Boolean).join(" ") + (row.registration_number ? ` · ${row.registration_number}` : "")])
  );
  const rentalInfo = new Map<string, { label: string | null; customer: string | null }>(
    (rentalsResult.data || []).map((row: any) => [row.id, { label: row.display_code || row.reference || null, customer: row.customers?.full_name || null }])
  );

  const taskItems: TaskListItem[] = tasks.map((row: any) => {
    const rental = row.rental_id ? rentalInfo.get(row.rental_id) : undefined;
    return {
      id: row.id,
      kind: "task",
      title: row.title,
      taskType: row.task_type,
      dueAt: row.due_at,
      dueDate: row.due_at ? bangkokDate.format(new Date(row.due_at)) : null,
      completedAt: row.completed_at,
      vehicleId: row.vehicle_id,
      rentalId: row.rental_id,
      rentalPaymentId: row.rental_payment_id || null,
      vehicleLabel: row.vehicle_id ? vehicleLabels.get(row.vehicle_id) || null : null,
      rentalLabel: rental?.label || null,
      customerName: rental?.customer || null,
      amount: null
    };
  });

  const paymentItems: TaskListItem[] = payments.map((row: any) => {
    const vehicleId = row.vehicle_id || row.rentals?.vehicle_id || null;
    return {
      id: `payment-${row.id}`,
      kind: "payment",
      title: paymentTitle(row.metadata),
      taskType: "payment",
      dueAt: null,
      dueDate: String(row.due_date || "").slice(0, 10) || null,
      completedAt: null,
      vehicleId,
      rentalId: row.rental_id,
      rentalPaymentId: row.id,
      vehicleLabel: vehicleId ? vehicleLabels.get(vehicleId) || null : null,
      rentalLabel: row.rentals?.display_code || row.rentals?.reference || null,
      customerName: row.rentals?.customers?.full_name || null,
      amount: Number(row.amount || 0)
    };
  });

  return [...taskItems, ...paymentItems].sort((a, b) => {
    const left = a.dueDate || "9999-12-31";
    const right = b.dueDate || "9999-12-31";
    if (left !== right) return left < right ? -1 : 1;
    return (a.dueAt || "").localeCompare(b.dueAt || "");
  });
}
