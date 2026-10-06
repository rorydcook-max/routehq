import { businessToday } from "@/lib/business-time";
import { customerPaymentLabel } from "@/lib/payment-labels";
import { receiptOf, signedReceiptUrls } from "@/lib/payment-receipts";
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
  /** What the job is about, when it has a next step of its own: "refund" or "request". */
  action?: string | null;
  rentalPaymentId: string | null;
  amount: number | null;
  /** A receipt the customer sent for this payment, waiting to be checked. */
  receipt: {
    url: string | null;
    submittedAt: string;
    method: string;
    note: string | null;
    /** Every scheduled payment the customer says this receipt is for. */
    paymentIds: string[];
    /** The total of those payments. */
    total: number;
  } | null;
  /** This payment is part of another row's receipt, so it isn't listed on its own. */
  coveredBy: string | null;
  /** Short name for a payment, e.g. "Rent · October 2026" or "Deposit". */
  paymentLabel: string | null;
  /** What kind of payment this is, so the screen can name it in the reader's language. */
  pay?: { kind: "deposit" | "top_up" | "extension" | "rent"; period: string | null } | null;
  /** What kind of request a customer made. */
  request?: string | null;
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

function payKind(metadata: any): NonNullable<TaskListItem["pay"]> {
  const type = String(metadata?.type || "");
  if (type === "deposit" || metadata?.is_deposit === true) return { kind: "deposit", period: null };
  if (type === "extension") return { kind: "extension", period: null };
  if (type === "deposit_top_up") return { kind: "top_up", period: null };
  return { kind: "rent", period: metadata?.period_label ? String(metadata.period_label) : null };
}

function isVoided(payment: any) {
  return payment.voided === true || String(payment.metadata?.voided || "") === "true";
}

/**
 * Open work for the team: tasks people created, plus every unpaid payment on a
 * booking that wasn't cancelled. Payments come straight from the payment schedule (the one
 * source of truth), so an extension or a rate change shows up without anyone
 * creating a reminder, and a recorded payment disappears at once. The older
 * auto-created "payment reminder" task rows are left out for the same reason.
 */
export async function getTaskList(organizationId: string): Promise<TaskListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const [tasksResult, paymentsResult, requestsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, title, task_type, due_at, completed_at, vehicle_id, rental_id, rental_payment_id, action, portal_action_id")
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
      // A returned rental can still owe money; rent scheduled past the return is voided at return.
      .not("rentals.status", "in", "(cancelled)")
      .order("due_date", { ascending: true }),
    // Anything a customer asked for that nobody has answered yet.
    supabase
      .from("customer_portal_actions")
      .select("id, action_type, created_at, rental_id")
      .eq("organisation_id", organizationId)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
  ]);

  if (tasksResult.error) throw new Error(tasksResult.error.message);
  if (paymentsResult.error) throw new Error(paymentsResult.error.message);

  const tasks = tasksResult.data || [];
  // A waiting request must always be on the list, even when no job was created for it.
  const withJob = new Set(tasks.filter((row: any) => !row.completed_at).map((row: any) => row.portal_action_id).filter(Boolean));
  const requests = ((requestsResult.data || []) as any[]).filter((row) => row.rental_id && !withJob.has(row.id));
  // Rent is scheduled a year ahead; only what is overdue or due in the next five weeks is a job.
  // A payment the customer has already sent a receipt for always shows, whenever it is due.
  const horizon = businessToday(35);
  const payments = (paymentsResult.data || []).filter(
    (payment: any) => !isVoided(payment) && payment.rentals && (!payment.due_date || String(payment.due_date).slice(0, 10) <= horizon || receiptOf(payment.metadata))
  );

  const receiptUrls = await signedReceiptUrls(payments.map((row: any) => receiptOf(row.metadata)?.path).filter(Boolean));

  const vehicleIds = [
    ...new Set([
      ...tasks.map((row: any) => row.vehicle_id),
      ...payments.map((row: any) => row.vehicle_id || row.rentals?.vehicle_id)
    ].filter(Boolean))
  ];
  const rentalIds = [...new Set([...tasks.map((row: any) => row.rental_id), ...requests.map((row) => row.rental_id)].filter(Boolean))];

  const [vehiclesResult, rentalsResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, registration_number, make, model").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    rentalIds.length
      ? supabase.from("rentals").select("id, reference, display_code, vehicle_id, customers!rentals_customer_id_fkey(full_name), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)").in("id", rentalIds)
      : Promise.resolve({ data: [] })
  ]);

  const vehicleLabels = new Map<string, string>(
    (vehiclesResult.data || []).map((row: any) => [row.id, [row.make, row.model].filter(Boolean).join(" ") + (row.registration_number ? ` · ${row.registration_number}` : "")])
  );
  const rentalInfo = new Map<string, { label: string | null; customer: string | null; vehicleId: string | null; vehicle: string | null }>(
    (rentalsResult.data || []).map((row: any) => [
      row.id,
      {
        label: row.display_code || row.reference || null,
        customer: row.customers?.full_name || null,
        vehicleId: row.vehicle_id || null,
        vehicle: row.vehicles ? [row.vehicles.make, row.vehicles.model].filter(Boolean).join(" ") + (row.vehicles.registration_number ? ` · ${row.vehicles.registration_number}` : "") : null
      }
    ])
  );
  const requestTitles: Record<string, string> = {
    extension_request: "Wants to keep the vehicle longer",
    return_confirmation: "Wants to arrange the return",
    problem_report: "Reported a problem",
    question: "Asked a question"
  };
  const requestItems: TaskListItem[] = requests.map((row) => {
    const rental = rentalInfo.get(row.rental_id);
    return {
      id: `request-${row.id}`,
      kind: "task",
      title: requestTitles[String(row.action_type)] || "Customer request",
      taskType: "admin",
      dueAt: row.created_at,
      dueDate: row.created_at ? bangkokDate.format(new Date(row.created_at)) : null,
      completedAt: null,
      vehicleId: rental?.vehicleId || null,
      rentalId: row.rental_id,
      action: "request",
      request: String(row.action_type || ""),
      rentalPaymentId: null,
      vehicleLabel: rental?.vehicle || null,
      rentalLabel: rental?.label || null,
      customerName: rental?.customer || null,
      amount: null,
      receipt: null,
      coveredBy: null,
      paymentLabel: null
    };
  });

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
      action: row.action || null,
      rentalPaymentId: row.rental_payment_id || null,
      vehicleLabel: row.vehicle_id ? vehicleLabels.get(row.vehicle_id) || null : null,
      rentalLabel: rental?.label || null,
      customerName: rental?.customer || null,
      amount: null,
      receipt: null,
      coveredBy: null,
      paymentLabel: null
    };
  });

  // One receipt can cover several payments (rent and deposit in one transfer).
  // It is shown once, on the payment the customer picked.
  const receiptGroups = new Map<string, any[]>();
  for (const row of payments) {
    const path = receiptOf(row.metadata)?.path;
    if (path) receiptGroups.set(path, [...(receiptGroups.get(path) || []), row]);
  }
  const leadOf = (path: string) => {
    const rows = receiptGroups.get(path) || [];
    const wanted = receiptOf(rows[0]?.metadata)?.primary;
    return rows.find((row) => row.id === wanted) || rows[0];
  };

  const paymentItems: TaskListItem[] = payments.map((row: any) => {
    const vehicleId = row.vehicle_id || row.rentals?.vehicle_id || null;
    const receipt = receiptOf(row.metadata);
    const group = receipt ? receiptGroups.get(receipt.path) || [row] : [];
    const lead = receipt ? leadOf(receipt.path) : null;
    const isLead = !!receipt && lead?.id === row.id;
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
      amount: Number(row.amount || 0),
      receipt: receipt && isLead
        ? {
            url: receiptUrls.get(receipt.path) || null,
            submittedAt: receipt.submitted_at,
            method: receipt.method || "other",
            note: receipt.note || null,
            paymentIds: group.map((item: any) => item.id),
            total: group.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)
          }
        : null,
      coveredBy: receipt && !isLead && lead ? `payment-${lead.id}` : null,
      paymentLabel: customerPaymentLabel(row.metadata),
      pay: payKind(row.metadata)
    };
  });

  return [...requestItems, ...taskItems, ...paymentItems].sort((a, b) => {
    const left = a.dueDate || "9999-12-31";
    const right = b.dueDate || "9999-12-31";
    if (left !== right) return left < right ? -1 : 1;
    return (a.dueAt || "").localeCompare(b.dueAt || "");
  });
}
