import type { ExistingRental } from "@/lib/import/preview";

/** The business's bookings and rentals that are still to come or running, for clash checks in the importer. */
export async function existingRentals(supabase: any, organizationId: string): Promise<ExistingRental[]> {
  const { data } = await supabase
    .from("rentals")
    .select("vehicle_id, start_date, end_date, status, customers(full_name, phone)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["booked", "active", "due_soon", "overdue", "extended"]);
  return ((data || []) as any[])
    .filter((row) => row.vehicle_id && row.start_date)
    .map((row) => ({ vehicle_id: row.vehicle_id, start_date: row.start_date, end_date: row.end_date, customer_name: String(row.customers?.full_name || ""), customer_phone: row.customers?.phone || null }));
}
