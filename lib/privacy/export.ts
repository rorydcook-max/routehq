/**
 * Data exports for privacy rights (GDPR Art. 15 and 20, UK GDPR, Thai PDPA s.30-31), 3 Nov 2026:
 * - a whole business, for its owner ("Download all your data", My account);
 * - one customer, for a business answering that renter's access request (their customer page).
 * One JSON file: readable, and easy to bring into a spreadsheet or another system. Files (ID photos, agreements,
 * receipts, vehicle photos) are listed with links that work for 7 days rather than packed in, so the export stays
 * small and quick on a phone. Server only: callers check who is asking first, and every query is scoped to the business.
 */

type Admin = any;
type Row = Record<string, unknown>;

const LINK_SECONDS = 7 * 24 * 60 * 60;
const PAGE = 1000;
/** The most rows of one kind in one export (well beyond any small business; keeps a request inside its time limit). */
const MAX_ROWS = 50_000;
const MAX_FILE_LINKS = 5_000;

/** Never in an export: sign-in secrets and links that would open someone's booking page. */
const SECRET_COLUMNS = new Set(["line_channel_access_token", "line_link_code", "line_link_code_expires_at", "token", "public_url", "reply_token"]);

function clean(rows: Row[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !SECRET_COLUMNS.has(key))));
}

/** Every row of a table matching the filter, page by page. A table that doesn't exist (or fails) is noted, not fatal. */
async function all(admin: Admin, table: string, filter: (query: any) => any, columns = "*"): Promise<Row[] | { error: string }> {
  const out: Row[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE) {
    const { data, error } = await filter(admin.from(table).select(columns)).range(from, from + PAGE - 1);
    if (error) return out.length ? clean(out) : { error: error.message };
    out.push(...((data || []) as Row[]));
    if (!data || data.length < PAGE) break;
  }
  return clean(out);
}

const rowsOf = (value: Row[] | { error: string }) => (Array.isArray(value) ? value : []);

/** Adds a 7-day download link to each document row (grouped by storage bucket). OCR read-outs stay out. */
async function withLinks(admin: Admin, documents: Row[]) {
  const byBucket = new Map<string, Row[]>();
  for (const doc of documents.slice(0, MAX_FILE_LINKS)) {
    const bucket = String(doc.storage_bucket || "");
    if (!bucket || !doc.storage_path) continue;
    byBucket.set(bucket, [...(byBucket.get(bucket) || []), doc]);
  }
  const links = new Map<string, string>();
  for (const [bucket, docs] of byBucket) {
    for (let i = 0; i < docs.length; i += 100) {
      const chunk = docs.slice(i, i + 100);
      const result = await admin.storage
        .from(bucket)
        .createSignedUrls(chunk.map((doc) => String(doc.storage_path)), LINK_SECONDS)
        .catch(() => ({ data: null }));
      for (const item of (result?.data || []) as Array<{ path: string | null; signedUrl: string | null }>) {
        if (item.path && item.signedUrl) links.set(`${bucket}/${item.path}`, item.signedUrl);
      }
    }
  }
  return documents.map(({ extracted_data: _ocr, ...doc }) => ({ ...doc, download_url: links.get(`${doc.storage_bucket}/${doc.storage_path}`) || null }));
}

function envelope<T extends Row>(kind: string, extra: T) {
  const expires = new Date(Date.now() + LINK_SECONDS * 1000).toISOString();
  return {
    export: {
      kind,
      created_at: new Date().toISOString(),
      format: "RoveHQ export v1 (JSON)",
      file_links_expire_at: expires,
      note: "Each document has a download_url that works for 7 days. Download the export again for fresh links."
    },
    ...extra
  };
}

/** Everything a business keeps in RoveHQ. */
export async function exportBusiness(admin: Admin, organizationId: string) {
  const org = (q: any) => q.eq("organization_id", organizationId);
  const { data: organization } = await admin.from("organizations").select("*").eq("id", organizationId).maybeSingle();
  const [vehicles, customers, rentals, payments, transactions, documents, inspections, maintenance, compliance, reports, branches, members] = await Promise.all([
    all(admin, "vehicles", org),
    all(admin, "customers", org),
    all(admin, "rentals", org),
    all(admin, "rental_payments", org),
    all(admin, "transactions", org),
    all(admin, "documents", org),
    all(admin, "inspections", org),
    all(admin, "maintenance_events", org),
    all(admin, "compliance_events", org),
    all(admin, "customer_reports", org),
    all(admin, "branches", org),
    all(admin, "organization_members", org, "user_id, role, is_active, created_at")
  ]);
  return envelope("business", {
    business: organization ? clean([organization as Row])[0] : null,
    team: members,
    branches,
    vehicles,
    customers,
    bookings: rentals,
    payments_due: payments,
    money_in_and_out: transactions,
    documents: await withLinks(admin, rowsOf(documents)),
    vehicle_checks: inspections,
    maintenance,
    insurance_and_tax: compliance,
    shared_history_reports: reports
  });
}

/** Everything a business holds about one customer: for answering that person's access or portability request. */
export async function exportCustomer(admin: Admin, organizationId: string, customerId: string) {
  const org = (q: any) => q.eq("organization_id", organizationId);
  const { data: customer } = await admin.from("customers").select("*").eq("organization_id", organizationId).eq("id", customerId).maybeSingle();
  if (!customer) return null;
  const rentals = rowsOf(await all(admin, "rentals", (q: any) => org(q).eq("customer_id", customerId)));
  const rentalIds = rentals.map((rental) => String(rental.id));
  const none = Promise.resolve([] as Row[]);
  const [payments, transactions, ownDocuments, rentalDocuments, inspections, links, consents, reports, messages] = await Promise.all([
    all(admin, "rental_payments", (q: any) => org(q).eq("customer_id", customerId)),
    all(admin, "transactions", (q: any) => org(q).eq("customer_id", customerId)),
    all(admin, "documents", (q: any) => org(q).eq("owner_type", "customer").eq("owner_id", customerId)),
    rentalIds.length ? all(admin, "documents", (q: any) => org(q).eq("owner_type", "rental").in("owner_id", rentalIds)) : none,
    all(admin, "inspections", (q: any) => org(q).eq("customer_id", customerId)),
    all(admin, "booking_links", (q: any) => org(q).eq("customer_id", customerId)),
    all(admin, "renter_consents", (q: any) => org(q).eq("customer_id", customerId)),
    all(admin, "customer_reports", (q: any) => org(q).eq("customer_id", customerId)),
    all(admin, "communication_log", (q: any) => q.eq("organisation_id", organizationId).eq("customer_id", customerId))
  ]);
  return envelope("customer", {
    customer: clean([customer as Row])[0],
    bookings: rentals,
    payments_due: payments,
    payments_and_refunds: transactions,
    documents: await withLinks(admin, [...rowsOf(ownDocuments), ...rowsOf(rentalDocuments)]),
    vehicle_checks: inspections,
    booking_links: links,
    choices_given: consents,
    shared_history_reports: reports,
    messages
  });
}

/** A file name safe for a download header: "rovehq-island-wheels-2026-11-03.json". */
export function exportFileName(label: string) {
  const slug =
    label
      .normalize("NFKD")
      .replace(/[^\w\s-]/g, "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .slice(0, 40) || "export";
  return `rovehq-${slug}-${new Date().toISOString().slice(0, 10)}.json`;
}
