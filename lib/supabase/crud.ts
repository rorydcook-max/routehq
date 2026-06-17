import type { Database, TableInsert, TableName, TableRow, TableUpdate } from "@/lib/supabase/database.types";

export type MutationResult<T> = { data: T; error: null } | { data: null; error: string };
export type TenantTableName =
  | "customers"
  | "vehicles"
  | "rentals"
  | "rental_payments"
  | "transactions"
  | "maintenance_events"
  | "compliance_events"
  | "inspections"
  | "contracts"
  | "invoices"
  | "documents"
  | "reminders"
  | "gps_devices"
  | "notifications"
  | "tasks";

export function createCrudRepository<TTable extends TenantTableName>(
  supabase: any,
  table: TTable
) {
  return {
    async list(organizationId: string) {
      return supabase
        .from(table)
        .select("*")
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false }) as unknown as Promise<{ data: TableRow<TTable>[] | null; error: Error | null }>;
    },

    async getById(id: string, organizationId: string) {
      return supabase
        .from(table)
        .select("*")
        .eq("id", id)
        .eq("organization_id", organizationId)
        .is("deleted_at", null)
        .single() as unknown as Promise<{ data: TableRow<TTable> | null; error: Error | null }>;
    },

    async create(payload: TableInsert<TTable>) {
      return supabase
        .from(table)
        .insert(payload)
        .select()
        .single() as unknown as Promise<{ data: TableRow<TTable> | null; error: Error | null }>;
    },

    async update(id: string, organizationId: string, payload: TableUpdate<TTable>) {
      return supabase
        .from(table)
        .update(payload)
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single() as unknown as Promise<{ data: TableRow<TTable> | null; error: Error | null }>;
    },

    async softDelete(id: string, organizationId: string) {
      return supabase
        .from(table)
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", id)
        .eq("organization_id", organizationId)
        .select()
        .single() as unknown as Promise<{ data: TableRow<TTable> | null; error: Error | null }>;
    }
  };
}
