import { createSupabaseServerClient } from "@/lib/supabase/server";

export const TASK_TYPE_OPTIONS = [
  { value: "delivery", label: "Delivery" },
  { value: "return", label: "Return" },
  { value: "maintenance", label: "Maintenance" },
  { value: "payment", label: "Payment" },
  { value: "compliance", label: "Compliance" },
  { value: "inspection", label: "Inspection" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" }
] as const;

export type TaskListItem = {
  id: string;
  title: string;
  taskType: string;
  dueAt: string | null;
  completedAt: string | null;
  vehicleLabel: string | null;
  rentalLabel: string | null;
  vehicleId: string | null;
  rentalId: string | null;
  rentalPaymentId: string | null;
};

export async function getTaskList(organizationId: string): Promise<TaskListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("tasks")
    .select("id, title, task_type, due_at, completed_at, vehicle_id, rental_id, rental_payment_id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("completed_at", { ascending: true, nullsFirst: true })
    .order("due_at", { ascending: true, nullsFirst: false });

  if (error) {
    throw new Error(error.message);
  }

  const vehicleIds = [...new Set((data || []).map((row: any) => row.vehicle_id).filter(Boolean))];
  const rentalIds = [...new Set((data || []).map((row: any) => row.rental_id).filter(Boolean))];

  const [vehiclesResult, rentalsResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, registration_number, make, model").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    rentalIds.length
      ? supabase.from("rentals").select("id, reference, display_code").in("id", rentalIds)
      : Promise.resolve({ data: [] })
  ]);

  const vehicleLabels = new Map((vehiclesResult.data || []).map((row: any) => [row.id, [row.registration_number, row.make, row.model].filter(Boolean).join(" ")]));
  const rentalLabels = new Map((rentalsResult.data || []).map((row: any) => [row.id, row.reference || row.display_code || null]));

  return (data || []).map((row: any) => ({
    id: row.id,
    title: row.title,
    taskType: row.task_type,
    dueAt: row.due_at,
    completedAt: row.completed_at,
    vehicleId: row.vehicle_id,
    rentalId: row.rental_id,
    rentalPaymentId: row.rental_payment_id || null,
    vehicleLabel: row.vehicle_id ? vehicleLabels.get(row.vehicle_id) || null : null,
    rentalLabel: row.rental_id ? rentalLabels.get(row.rental_id) || null : null
  }));
}
