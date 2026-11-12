/**
 * One way to record work done on a vehicle, whether it is logged from the car page or recorded as a cost in Money in & out
 * (Rory, 1 Nov 2026: "are we making things more complex by doubling up?"). Either way the same three things happen:
 * a row in the car's service history, the car's last/next service (and last oil change) updated everywhere, and the odometer moved on.
 * The money entry itself is made by the caller and linked here.
 */

/** Kinds of work that count as a service (they set "last service"). Repairs, tyres and batteries don't. */
const SERVICE_KINDS = new Set(["service", "oil_change"]);

/** Money entry types that are work on a vehicle, and the kind of work each one is. */
export const SERVICE_COST_TYPES: Record<string, string> = { servicing: "service", maintenance: "service", repair: "repair" };

/** The money entry type for a kind of work logged from the car page. */
export function costTypeForService(kind: string) {
  return kind === "repair" || kind === "tyres" || kind === "battery" ? "repair" : "servicing";
}

export type ServiceRecord = {
  organizationId: string;
  vehicleId: string;
  userId: string;
  kind: string;
  date: string;
  mileage: number | null;
  cost: number | null;
  supplier: string | null;
  notes: string | null;
  nextDueDate: string | null;
  nextDueMileage: number | null;
  oilChanged: boolean;
  /** When the oil is next due, by date, km or both. Kept apart from the next service. */
  nextOilDate?: string | null;
  nextOilMileage?: number | null;
  transactionId: string | null;
};

export async function recordService(supabase: any, record: ServiceRecord) {
  const oilChanged = record.oilChanged || record.kind === "oil_change";
  const { data: event, error } = await supabase
    .from("maintenance_events")
    .insert({
      organization_id: record.organizationId,
      vehicle_id: record.vehicleId,
      transaction_id: record.transactionId,
      event_type: record.kind,
      service_date: record.date,
      mileage: record.mileage,
      cost: record.cost,
      supplier: record.supplier,
      notes: record.notes,
      oil_changed: oilChanged,
      next_due_date: record.nextDueDate,
      next_due_mileage: record.nextDueMileage,
      created_by: record.userId
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("mileage, metadata")
    .eq("id", record.vehicleId)
    .eq("organization_id", record.organizationId)
    .maybeSingle();
  if (!vehicle) return event.id as string;

  const metadata = vehicle.metadata || {};
  const compliance = { ...(metadata.compliance || {}) };
  const later = (a: string | null | undefined, b: string) => !a || String(a).slice(0, 10) <= b;
  const isService = SERVICE_KINDS.has(record.kind);

  // Only a newer service moves "last service" (logging an old one from the paperwork shouldn't wind it back).
  if (isService && later(compliance.last_service_date, record.date)) {
    compliance.last_service_date = record.date;
    if (record.mileage !== null) compliance.last_service_mileage = record.mileage;
  }
  if (oilChanged && later(compliance.last_oil_change_date, record.date)) {
    compliance.last_oil_change_date = record.date;
    if (record.mileage !== null) compliance.last_oil_change_mileage = record.mileage;
  }
  // The next service: whatever was given now. A service with nothing given clears a due date or km it has already passed.
  if (record.nextDueDate) compliance.next_service_date = record.nextDueDate;
  else if (isService && compliance.next_service_date && String(compliance.next_service_date).slice(0, 10) <= record.date) compliance.next_service_date = null;
  if (record.nextDueMileage) compliance.next_service_mileage = record.nextDueMileage;
  else if (isService && record.mileage !== null && Number(compliance.next_service_mileage || 0) > 0 && Number(compliance.next_service_mileage) <= record.mileage) compliance.next_service_mileage = null;

  // The next oil change, the same way: whatever was given now; an oil change with nothing given clears a due date or km it has passed.
  if (record.nextOilDate) compliance.oil_change_due_date = record.nextOilDate;
  else if (oilChanged && compliance.oil_change_due_date && String(compliance.oil_change_due_date).slice(0, 10) <= record.date) compliance.oil_change_due_date = null;
  if (record.nextOilMileage) compliance.oil_change_due_mileage = record.nextOilMileage;
  else if (oilChanged && record.mileage !== null && Number(compliance.oil_change_due_mileage || 0) > 0 && Number(compliance.oil_change_due_mileage) <= record.mileage) compliance.oil_change_due_mileage = null;

  const update: Record<string, unknown> = { metadata: { ...metadata, compliance } };
  if (record.mileage !== null && record.mileage > Number(vehicle.mileage || 0)) update.mileage = record.mileage;
  await supabase.from("vehicles").update(update).eq("id", record.vehicleId).eq("organization_id", record.organizationId);
  return event.id as string;
}

/** Km left before the next service, when a km is set and the odometer is known. */
export function serviceKmLeft(compliance: any, mileage: number | null | undefined) {
  const due = Number(compliance?.next_service_mileage || 0);
  const now = Number(mileage || 0);
  return due > 0 && now > 0 ? due - now : null;
}
