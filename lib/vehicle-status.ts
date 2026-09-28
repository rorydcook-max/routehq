/**
 * A vehicle's status follows its bookings: on rent while a rental is out,
 * booked (reserved) while the next booking is waiting, otherwise available.
 * Call after a rental ends or is cancelled so a car with a next booking lined
 * up doesn't show as free. Maintenance / inactive / retired are left alone.
 */
export async function syncVehicleStatusFromBookings(supabase: any, organizationId: string, vehicleId: string | null | undefined) {
  if (!vehicleId) return;
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("status")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (!vehicle || ["maintenance", "inactive", "retired"].includes(String(vehicle.status))) return;

  const { data: rentals } = await supabase
    .from("rentals")
    .select("id, customer_id, status, start_date")
    .eq("organization_id", organizationId)
    .eq("vehicle_id", vehicleId)
    .is("deleted_at", null)
    .in("status", ["active", "due_soon", "overdue", "extended", "booked"])
    .order("start_date", { ascending: true });

  const out = (rentals || []).find((rental: any) => rental.status !== "booked");
  const next = (rentals || []).find((rental: any) => rental.status === "booked");
  const update = out
    ? { status: "rented", availability_status: "rented", current_rental_id: out.id, current_customer_id: out.customer_id || null }
    : next
      ? { status: "reserved", availability_status: "reserved", current_rental_id: next.id, current_customer_id: next.customer_id || null }
      : { status: "available", availability_status: "available_now", current_rental_id: null, current_customer_id: null };

  await supabase.from("vehicles").update(update).eq("id", vehicleId).eq("organization_id", organizationId);
}
