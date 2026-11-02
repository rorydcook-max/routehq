import { businessToday } from "@/lib/business-time";

/**
 * A cost recorded for paperwork (a policy, the road tax) also moves the car's date for it: the new expiry, what it cost,
 * and a line in its paperwork history, the same as renewing from the car page (Rory, 2 Nov 2026).
 * Paid in one go, so any monthly plan for the same paperwork ends. Returns the history entry's id.
 */
export async function recordPaperworkDate(
  supabase: any,
  input: { organizationId: string; vehicleId: string; kind: string; from: string | null; until: string; cost: number | null; userId: string; notes?: string | null }
): Promise<string | null> {
  if (!["tax", "porbor", "insurance", "inspection"].includes(input.kind) || !/^\d{4}-\d{2}-\d{2}$/.test(input.until)) return null;
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("metadata")
    .eq("id", input.vehicleId)
    .eq("organization_id", input.organizationId)
    .maybeSingle();
  if (!vehicle) return null;
  const metadata = vehicle.metadata || {};
  const field = `${input.kind}_expiry_date`;
  const compliance: Record<string, any> = { ...(metadata.compliance || {}), [field]: input.until };
  if (input.cost !== null) compliance[`${field}_last_cost`] = input.cost;
  delete compliance[`${field}_monthly`];
  const plans = { ...(metadata.compliance_plans || {}) };
  delete plans[input.kind];
  const next: Record<string, any> = { ...metadata, compliance };
  if (Object.keys(plans).length) next.compliance_plans = plans;
  else delete next.compliance_plans;
  const { error } = await supabase.from("vehicles").update({ metadata: next }).eq("id", input.vehicleId).eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  const { data: event } = await supabase
    .from("compliance_events")
    .insert({
      organization_id: input.organizationId,
      vehicle_id: input.vehicleId,
      compliance_type: input.kind,
      effective_date: input.from || businessToday(),
      expiry_date: input.until,
      cost: input.cost,
      notes: input.notes || null,
      created_by: input.userId
    })
    .select("id")
    .single();
  return event?.id || null;
}
