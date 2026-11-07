import { rentalHappeningNow } from "@/lib/vehicle-detail";
import { toWallTime, businessToday } from "@/lib/business-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRevenueTransaction } from "@/lib/transaction-options";
import { HANDED_OVER_STATUSES } from "@/lib/rental-balances";

const activeRentalStatuses = ["booked", "active", "due_soon", "overdue", "extended"];

export type CustomerDocumentStatus = "complete" | "missing" | "none";

export type CustomerDocument = {
  id: string;
  category: string;
  fileName: string;
  mimeType: string | null;
  storageBucket: string;
  storagePath: string;
  url: string | null;
  createdAt: string;
};

export type CustomerListItem = {
  customer: any;
  documents: any[];
  documentStatus: CustomerDocumentStatus;
  documentCompleteness: number;
  activeRentals: any[];
  activeRental: any | null;
  lifetimeRevenue: number;
  lastRentalDate: string | null;
  totalRentals: number;
  /** Unpaid rent due today or earlier, across their rentals (the list only). */
  owesNow?: number;
  /** Lifetime figures from customer_stats (the list and the customer page). */
  stats?: CustomerStats;
};

export type CustomerDetail = CustomerListItem & {
  documentsWithUrls: CustomerDocument[];
  rentals: any[];
  transactions: any[];
  activeRental: any | null;
  totalRentalDays: number;
  averageRentalDuration: number;
};

function normalizeCategory(category: string) {
  return category.toLowerCase().replace(/[\s-]+/g, "_");
}

export function getCustomerDocumentCompleteness(documents: Array<{ category: string }>) {
  const categories = documents.map((document) => normalizeCategory(document.category));
  const hasPassport = categories.some((category) => category.includes("passport"));
  const hasLicense = categories.some((category) => category.includes("license") || category.includes("licence"));
  const hasSelfie = categories.some((category) => category.includes("selfie") || category.includes("customer_photo") || category.includes("photo"));
  const count = [hasPassport, hasLicense, hasSelfie].filter(Boolean).length;

  return {
    hasPassport,
    hasLicense,
    hasSelfie,
    percentage: Math.round((count / 3) * 100),
    status: count === 3 ? "complete" as const : count === 0 ? "none" as const : "missing" as const
  };
}

function daysBetween(start: string | null | undefined, end: string | null | undefined) {
  if (!start) {
    return 0;
  }
  const startDay = Date.parse(`${toWallTime(start).slice(0, 10)}T00:00:00Z`);
  const endDay = Date.parse(`${end ? toWallTime(end).slice(0, 10) : businessToday()}T00:00:00Z`);
  if (Number.isNaN(startDay) || Number.isNaN(endDay)) return 0;
  return Math.max(1, Math.round((endDay - startDay) / 86_400_000) + 1);
}

/** Rent paid back to the customer: it comes off what they brought in. */
export function refundsOf(transactions: any[]) {
  return transactions.filter((transaction) => !transaction.voided && String(transaction.type) === "refund").reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
}

function summarizeCustomer(customer: any, documents: any[], rentals: any[], transactions: any[]): CustomerListItem {
  // What is out on the road first, then what is booked.
  const activeRentals = rentals
    .filter((rental) => activeRentalStatuses.includes(rental.status))
    .sort((left, right) => Number(left.status === "booked") - Number(right.status === "booked") || String(left.start_date).localeCompare(String(right.start_date)));
  // Cancelled (voided) entries are not money the customer brought in.
  const lifetimeRevenue = transactions
    .filter((transaction) =>
      !transaction.voided &&
      isRevenueTransaction({
        amount: Number(transaction.amount || 0),
        isDeposit: transaction.is_deposit,
        type: transaction.type
      })
    )
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0) - refundsOf(transactions);
  // Only rentals that went out count: not drafts, links not filled in, future bookings or cancellations.
  // One that came back early ended on its return day, not on its booked date.
  const today = businessToday();
  const lastRentalDate = rentals
    .filter((rental) => ["active", "due_soon", "overdue", "extended", "completed"].includes(String(rental.status)))
    .map((rental) => {
      // The return form's date when there is one: the day the vehicle actually came back.
      if (rental.status === "completed" && rental.returned_on) return String(rental.returned_on);
      const end = String(rental.end_date || rental.start_date || "").slice(0, 10);
      return rental.status === "completed" && end > today ? today : end;
    })
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  const completeness = getCustomerDocumentCompleteness(documents);

  return {
    customer,
    documents,
    documentStatus: completeness.status,
    documentCompleteness: completeness.percentage,
    activeRentals,
    activeRental: rentalHappeningNow(activeRentals),
    lifetimeRevenue,
    lastRentalDate,
    totalRentals: rentals.length
  };
}

async function addDocumentUrls(supabase: any, documents: any[]): Promise<CustomerDocument[]> {
  return Promise.all(
    documents.map(async (document) => {
      const { data } = await supabase.storage.from(document.storage_bucket).createSignedUrl(document.storage_path, 60 * 60);
      return {
        id: document.id,
        category: document.category,
        fileName: document.file_name,
        mimeType: document.mime_type,
        storageBucket: document.storage_bucket,
        storagePath: document.storage_path,
        url: data?.signedUrl || null,
        createdAt: document.created_at
      };
    })
  );
}

/** Where a customer first came from, worked out from their first booking (customer_stats, migration 0130). */
export type CustomerSource = "booking_page" | "direct" | "imported" | "partner" | "rove_rent";

/** Lifetime figures per customer, computed in the database in one pass (customer_stats, migration 0130). */
export type CustomerStats = {
  /** Rentals that went out (not drafts, unsent links, future bookings or cancellations). */
  rentals: number;
  /** Days on rent so far across those rentals. */
  rentalDays: number;
  firstStart: string | null;
  lastEnd: string | null;
  /** The next booking that hasn't started yet. */
  nextStart: string | null;
  /** Money brought in (not deposits), less refunds. */
  revenue: number;
  source: CustomerSource;
  /** Rentals that came back with new damage or a kept deposit, plus own damage reports. */
  damageCount: number;
};

const EMPTY_STATS: CustomerStats = { rentals: 0, rentalDays: 0, firstStart: null, lastEnd: null, nextStart: null, revenue: 0, source: "direct", damageCount: 0 };

/** customer_stats for a whole business, keyed by customer. An empty map if the function isn't there yet. */
export async function customerStatsByCustomer(supabase: any, organizationId: string) {
  const stats = new Map<string, CustomerStats>();
  const { data, error } = await supabase.rpc("customer_stats", { p_org: organizationId });
  if (error) {
    console.error("[customers] customer_stats failed:", error.message);
    return stats;
  }
  for (const row of (data || []) as any[]) {
    stats.set(String(row.customer_id), {
      rentals: Number(row.rentals || 0),
      rentalDays: Number(row.rental_days || 0),
      firstStart: row.first_start || null,
      lastEnd: row.last_end || null,
      nextStart: row.next_start || null,
      revenue: Number(row.revenue || 0),
      source: (["booking_page", "direct", "imported", "partner", "rove_rent"].includes(row.source) ? row.source : "direct") as CustomerSource,
      damageCount: Number(row.damage_count || 0)
    });
  }
  return stats;
}

/** What each customer owes right now across their rentals: unpaid rent due today or earlier on a handed-over rental. */
async function amountDueNowByCustomer(supabase: any, organizationId: string) {
  const due = new Map<string, number>();
  const { data, error } = await supabase
    .from("rental_payments")
    .select("amount, voided, metadata, rentals!inner(customer_id, status, organization_id, deleted_at)")
    .eq("rentals.organization_id", organizationId)
    .is("rentals.deleted_at", null)
    .is("deleted_at", null)
    .in("status", ["scheduled", "pending", "overdue"])
    .in("rentals.status", HANDED_OVER_STATUSES)
    .lte("due_date", businessToday());
  if (error) console.error("[customers] amount due now failed:", error.message);
  for (const row of (data || []) as any[]) {
    if (row.voided || row.metadata?.voided || !row.rentals?.customer_id) continue;
    due.set(row.rentals.customer_id, (due.get(row.rentals.customer_id) || 0) + Number(row.amount || 0));
  }
  return due;
}

/**
 * The customer list: one fixed set of queries for the whole business, never one per customer.
 * Lifetime figures come from customer_stats; only rentals on the go are read in full (for "renting the Yaris").
 */
export async function getCustomerList(organizationId: string): Promise<CustomerListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const [customersResult, documentsResult, rentalsResult, stats, dueByCustomer] = await Promise.all([
    supabase.from("customers").select("*").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("documents").select("owner_id, category").eq("organization_id", organizationId).eq("owner_type", "customer").is("deleted_at", null),
    supabase
      .from("rentals")
      .select("id, customer_id, status, start_date, end_date, vehicle_id, vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
      .eq("organization_id", organizationId)
      .in("status", activeRentalStatuses)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    customerStatsByCustomer(supabase, organizationId),
    amountDueNowByCustomer(supabase, organizationId)
  ]);

  const queryError = [customersResult, documentsResult, rentalsResult].find((result) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const documentsBy = new Map<string, any[]>();
  for (const document of (documentsResult.data || []) as any[]) documentsBy.set(document.owner_id, [...(documentsBy.get(document.owner_id) || []), document]);
  const rentalsBy = new Map<string, any[]>();
  for (const rental of (rentalsResult.data || []) as any[]) rentalsBy.set(rental.customer_id, [...(rentalsBy.get(rental.customer_id) || []), rental]);

  return (customersResult.data || []).map((customer: any) => {
    const documents = documentsBy.get(customer.id) || [];
    const completeness = getCustomerDocumentCompleteness(documents);
    // What is out on the road first, then what is booked.
    const activeRentals = (rentalsBy.get(customer.id) || []).sort(
      (left, right) => Number(left.status === "booked") - Number(right.status === "booked") || String(left.start_date).localeCompare(String(right.start_date))
    );
    const own = stats.get(customer.id) || EMPTY_STATS;
    return {
      customer,
      documents,
      documentStatus: completeness.status,
      documentCompleteness: completeness.percentage,
      activeRentals,
      activeRental: rentalHappeningNow(activeRentals),
      lifetimeRevenue: own.revenue,
      lastRentalDate: own.lastEnd,
      totalRentals: own.rentals,
      owesNow: dueByCustomer.get(customer.id) || 0,
      stats: own
    };
  });
}

/** One month of the insights panel (customer_month_stats, migration 0130). */
export type CustomerMonth = { month: string; newCustomers: number; rentals: number; rentalDays: number; revenue: number };

/** The last 12 months: new customers, rentals started, their days and the money they brought in. */
export async function getCustomerMonths(organizationId: string): Promise<CustomerMonth[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase.rpc("customer_month_stats", { p_org: organizationId });
  if (error) {
    console.error("[customers] customer_month_stats failed:", error.message);
    return [];
  }
  return ((data || []) as any[]).map((row) => ({
    month: String(row.month).slice(0, 7),
    newCustomers: Number(row.new_customers || 0),
    rentals: Number(row.rentals || 0),
    rentalDays: Number(row.rental_days || 0),
    revenue: Number(row.revenue || 0)
  }));
}

export async function getCustomerDetail(customerId: string, organizationId: string): Promise<CustomerDetail | null> {
  const supabase = (await createSupabaseServerClient()) as any;
  const customerResult = await supabase
    .from("customers")
    .select("*")
    .eq("id", customerId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (customerResult.error) {
    throw new Error(customerResult.error.message);
  }

  if (!customerResult.data) {
    return null;
  }

  const [documentsResult, rentalsResult, transactionsResult, activeRentalResult] = await Promise.all([
    supabase.from("documents").select("*").eq("organization_id", organizationId).eq("owner_type", "customer").eq("owner_id", customerId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase
      .from("rentals")
      .select("*, vehicles!rentals_vehicle_id_fkey(id, make, model, registration_number, color, vehicle_categories(code, name))")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase
      .from("transactions")
      .select("*, vehicles!transactions_vehicle_id_fkey(make, model, registration_number)")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("rentals")
      .select("*, vehicles!rentals_vehicle_id_fkey(id, make, model, registration_number, color, vehicle_categories(code, name))")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .in("status", activeRentalStatuses)
      .is("deleted_at", null)
      .order("start_date", { ascending: true })
      .limit(20)
  ]);

  const queryError = [documentsResult, rentalsResult, transactionsResult, activeRentalResult].find((result) => result.error && result.error.code !== "PGRST116")?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const documents = documentsResult.data || [];
  const rentals = rentalsResult.data || [];
  const transactions = transactionsResult.data || [];
  const summary = summarizeCustomer(customerResult.data, documents, rentals, transactions);
  const totalRentalDays = rentals.reduce((sum: number, rental: any) => sum + daysBetween(rental.start_date, rental.end_date), 0);

  return {
    ...summary,
    activeRental: rentalHappeningNow(activeRentalResult.data as any[]) || summary.activeRental,
    documentsWithUrls: await addDocumentUrls(supabase, documents),
    rentals,
    transactions,
    totalRentalDays,
    averageRentalDuration: rentals.length ? Math.round(totalRentalDays / rentals.length) : 0
  };
}
