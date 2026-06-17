import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRevenueTransaction } from "@/lib/transaction-options";

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
  const startDate = new Date(start);
  const endDate = end ? new Date(end) : new Date();
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(0, 0, 0, 0);
  return Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

function summarizeCustomer(customer: any, documents: any[], rentals: any[], transactions: any[]): CustomerListItem {
  const activeRentals = rentals.filter((rental) => activeRentalStatuses.includes(rental.status));
  const lifetimeRevenue = transactions
    .filter((transaction) =>
      isRevenueTransaction({
        amount: Number(transaction.amount || 0),
        isDeposit: transaction.is_deposit,
        type: transaction.type
      })
    )
    .reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const lastRentalDate = rentals
    .map((rental) => rental.end_date || rental.start_date)
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
    activeRental: activeRentals[0] || null,
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

export async function getCustomerList(organizationId: string): Promise<CustomerListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const [customersResult, documentsResult, rentalsResult, transactionsResult] = await Promise.all([
    supabase.from("customers").select("*").eq("organization_id", organizationId).is("deleted_at", null).order("created_at", { ascending: false }),
    supabase.from("documents").select("*").eq("organization_id", organizationId).eq("owner_type", "customer").is("deleted_at", null),
    supabase
      .from("rentals")
      .select("*, vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("start_date", { ascending: false }),
    supabase.from("transactions").select("*").eq("organization_id", organizationId).is("deleted_at", null)
  ]);

  const queryError = [customersResult, documentsResult, rentalsResult, transactionsResult].find((result) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  return (customersResult.data || []).map((customer: any) =>
    summarizeCustomer(
      customer,
      (documentsResult.data || []).filter((document: any) => document.owner_id === customer.id),
      (rentalsResult.data || []).filter((rental: any) => rental.customer_id === customer.id),
      (transactionsResult.data || []).filter((transaction: any) => transaction.customer_id === customer.id)
    )
  );
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
      .select("*, vehicles!rentals_vehicle_id_fkey(id, make, model, registration_number)")
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
      .select("*, vehicles!rentals_vehicle_id_fkey(id, make, model, registration_number)")
      .eq("organization_id", organizationId)
      .eq("customer_id", customerId)
      .in("status", activeRentalStatuses)
      .is("deleted_at", null)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle()
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
    activeRental: activeRentalResult.data || summary.activeRental,
    documentsWithUrls: await addDocumentUrls(supabase, documents),
    rentals,
    transactions,
    totalRentalDays,
    averageRentalDuration: rentals.length ? Math.round(totalRentalDays / rentals.length) : 0
  };
}
