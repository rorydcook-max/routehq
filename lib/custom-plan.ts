import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * A business's admin-set custom plan (organizations.custom_limits / custom_price, migration 0107).
 * Read on its own so the pages that use it keep working before that migration is applied: if the columns
 * are missing, or anything else goes wrong, the answer is "no custom plan" and the plan's own limits apply.
 */
export async function getCustomPlan(organizationId: string | null | undefined): Promise<{ custom_limits: unknown; custom_price: number | null }> {
  if (!organizationId) return { custom_limits: null, custom_price: null };
  try {
    const db = createSupabaseAdminClient() as any;
    const { data, error } = await db.from("organizations").select("custom_limits, custom_price").eq("id", organizationId).maybeSingle();
    if (error || !data) return { custom_limits: null, custom_price: null };
    return { custom_limits: data.custom_limits ?? null, custom_price: data.custom_price === null || data.custom_price === undefined ? null : Number(data.custom_price) };
  } catch {
    return { custom_limits: null, custom_price: null };
  }
}
