/**
 * Whether a customer's documents are complete, from the files actually on record: an identity document (passport or
 * national ID) and a driving licence; a selfie is optional (Rory, 11 Nov 2026). The saved customers.document_status
 * can be out of date (it was worked out under an older rule, or before a file was added elsewhere), so screens that
 * decide "ask for documents again?" read the files instead: documents uploaded once are never asked for twice.
 */

export function documentStatusFor(categories: string[]) {
  const have = categories.map((category) => String(category || "").toLowerCase());
  const identity = have.some((category) => category.includes("passport") || category.includes("national_id") || category.includes("id_card"));
  const licence = have.some((category) => category.includes("license") || category.includes("licence"));
  if (identity && licence) return "complete";
  return have.length === 0 ? "no_documents" : "missing_documents";
}

/** The same customers, each with document_status worked out from their files when the saved one isn't "complete". */
export async function withLiveDocumentStatus<T extends { id: string; document_status?: string | null }>(supabase: any, organizationId: string, customers: T[]): Promise<T[]> {
  const stale = customers.filter((customer) => customer?.id && customer.document_status !== "complete").map((customer) => customer.id);
  if (stale.length === 0) return customers;
  const byCustomer = new Map<string, string[]>();
  // In batches: a long list of ids doesn't fit in one request address.
  for (let at = 0; at < stale.length; at += 150) {
    const { data, error } = await supabase
      .from("documents")
      .select("owner_id, category")
      .eq("organization_id", organizationId)
      .eq("owner_type", "customer")
      .in("owner_id", stale.slice(at, at + 150))
      .is("deleted_at", null);
    if (error) return customers;
    for (const row of (data || []) as Array<{ owner_id: string; category: string }>) byCustomer.set(row.owner_id, [...(byCustomer.get(row.owner_id) || []), row.category]);
  }
  return customers.map((customer) => (byCustomer.has(customer.id) ? { ...customer, document_status: documentStatusFor(byCustomer.get(customer.id) || []) } : customer));
}
