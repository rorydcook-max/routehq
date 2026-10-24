/**
 * What the importer learns from a business's own corrections. When the owner re-maps a column or changes what a
 * cost was for, the choice is kept, and the next import from that business reads the same heading or description
 * the same way: before the AI and before the built-in rules, because the owner knows their own sheet best.
 */
import { IMPORT_FIELD_KEYS } from "@/lib/import/fields";
import { cleanString } from "@/lib/import/normalize";
import type { ImportPreview, SheetMapping } from "@/lib/import/preview";

export type Learnings = { columns: Map<string, string>; costs: Map<string, string> };

export const emptyLearnings = (): Learnings => ({ columns: new Map(), costs: new Map() });

/** Headings and descriptions match however they're spaced or capitalised. */
export function learningKey(text: unknown) {
  return cleanString(text).toLowerCase().replace(/\s+/g, " ").slice(0, 200);
}

const COST_KINDS = new Set(["rental_income", "charge_recovered", "repair", "servicing", "maintenance", "fuel", "insurance", "tax", "finance", "fine", "accessories", "refund", "deposit", "deposit_received", "deposit_refunded", "other"]);

export async function loadLearnings(supabase: any, organizationId: string): Promise<Learnings> {
  const learnings = emptyLearnings();
  const { data } = await supabase.from("import_learnings").select("kind, key, value").eq("organization_id", organizationId).limit(2000);
  for (const row of (data || []) as Array<{ kind: string; key: string; value: string }>) {
    if (row.kind === "column" && (IMPORT_FIELD_KEYS.has(row.value) || row.value === "__ignore__")) learnings.columns.set(row.key, row.value);
    if (row.kind === "cost" && COST_KINDS.has(row.value)) learnings.costs.set(row.key, row.value);
  }
  return learnings;
}

async function save(supabase: any, organizationId: string, kind: "column" | "cost", pairs: Map<string, string>) {
  if (!pairs.size) return;
  const now = new Date().toISOString();
  await supabase
    .from("import_learnings")
    .upsert([...pairs].map(([key, value]) => ({ organization_id: organizationId, kind, key, value, updated_at: now })), { onConflict: "organization_id,kind,key" });
}

/** The owner changed how columns were read: remember each heading they changed. */
export async function rememberColumns(supabase: any, organizationId: string, before: SheetMapping[], after: SheetMapping[]) {
  const changed = new Map<string, string>();
  for (const sheet of after) {
    const old = before.find((item) => item.sheet_name === sheet.sheet_name);
    for (const mapping of sheet.column_mappings) {
      const previous = old?.column_mappings.find((item) => item.source_column === mapping.source_column)?.routehq_field;
      const key = learningKey(mapping.source_column);
      // Numbered columns ("Column 3") say nothing about the next file.
      if (!key || /^column \d+$/.test(key) || previous === mapping.routehq_field) continue;
      if (IMPORT_FIELD_KEYS.has(mapping.routehq_field) || mapping.routehq_field === "__ignore__") changed.set(key, mapping.routehq_field);
    }
  }
  await save(supabase, organizationId, "column", changed);
}

/** The owner changed what costs were for before bringing them in: remember each description. */
export async function rememberCosts(supabase: any, organizationId: string, before: ImportPreview, after: ImportPreview) {
  const original = new Map((before?.transactions || []).map((item) => [item.key, item]));
  const changed = new Map<string, string>();
  for (const item of after?.transactions || []) {
    const old = original.get(item.key);
    const key = learningKey(old?.notes || item.notes);
    if (!old || !key || old.type === item.type || !COST_KINDS.has(item.type) || item.key.includes(":pay-")) continue;
    changed.set(key, item.type);
  }
  await save(supabase, organizationId, "cost", changed);
}

/** Costs described the way the owner has corrected before take the kind they chose. */
export function applyCostLearnings(preview: ImportPreview, learnings: Learnings) {
  let applied = 0;
  if (!learnings.costs.size) return applied;
  for (const item of preview.transactions) {
    const kind = learnings.costs.get(learningKey(item.notes));
    if (kind && kind !== item.type && !item.key.includes(":pay-")) {
      item.type = kind;
      applied += 1;
    }
  }
  return applied;
}
