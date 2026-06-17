"use server";

import { revalidatePath } from "next/cache";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createCrudRepository, type MutationResult, type TenantTableName } from "@/lib/supabase/crud";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TableInsert, TableName, TableRow, TableUpdate } from "@/lib/supabase/database.types";

type ActivityEntityType =
  | "vehicle"
  | "customer"
  | "rental"
  | "payment"
  | "transaction"
  | "document"
  | "maintenance"
  | "compliance"
  | "inspection"
  | "contract"
  | "invoice"
  | "reminder"
  | "notification"
  | "task"
  | "gps_device";

const activityEntityByTable: Partial<Record<TenantTableName, ActivityEntityType>> = {
  vehicles: "vehicle",
  customers: "customer",
  rentals: "rental",
  rental_payments: "payment",
  transactions: "transaction",
  maintenance_events: "maintenance",
  compliance_events: "compliance",
  inspections: "inspection",
  contracts: "contract",
  invoices: "invoice",
  documents: "document",
  reminders: "reminder",
  gps_devices: "gps_device",
  notifications: "notification",
  tasks: "task",
};

export async function createRecord<TTable extends TenantTableName>(
  table: TTable,
  payload: TableInsert<TTable>,
  organizationId: string
): Promise<MutationResult<TableRow<TTable>>> {
  const supabase = await createSupabaseServerClient();
  const repository = createCrudRepository(supabase, table);
  const { data, error } = await repository.create({ ...payload, organization_id: organizationId });

  if (error || !data) {
    return { data: null, error: error?.message || "Unable to create record." };
  }

  await recordMutationActivity(supabase, table, data.id as string, organizationId, "created", "Record created");
  revalidatePath("/");

  return { data, error: null };
}

export async function updateRecord<TTable extends TenantTableName>(
  table: TTable,
  id: string,
  organizationId: string,
  payload: TableUpdate<TTable>
): Promise<MutationResult<TableRow<TTable>>> {
  const supabase = await createSupabaseServerClient();
  const repository = createCrudRepository(supabase, table);
  const { data, error } = await repository.update(id, organizationId, payload);

  if (error || !data) {
    return { data: null, error: error?.message || "Unable to update record." };
  }

  await recordMutationActivity(supabase, table, id, organizationId, "updated", "Record updated");
  revalidatePath("/");

  return { data, error: null };
}

export async function deleteRecord<TTable extends TenantTableName>(
  table: TTable,
  id: string,
  organizationId: string
): Promise<MutationResult<TableRow<TTable>>> {
  const supabase = await createSupabaseServerClient();
  const repository = createCrudRepository(supabase, table);
  const { data, error } = await repository.softDelete(id, organizationId);

  if (error || !data) {
    return { data: null, error: error?.message || "Unable to delete record." };
  }

  await recordMutationActivity(supabase, table, id, organizationId, "deleted", "Record archived");
  revalidatePath("/");

  return { data, error: null };
}

async function recordMutationActivity(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  table: TenantTableName,
  entityId: string,
  organizationId: string,
  eventType: string,
  title: string
) {
  const entityType = activityEntityByTable[table];
  if (!entityType) {
    return;
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    entity_type: entityType,
    entity_id: entityId,
    event_type: eventType,
    title
  });
}
