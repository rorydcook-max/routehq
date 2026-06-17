import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TRANSACTION_TYPE_OPTIONS } from "@/lib/transaction-options";

const typeLabels: Record<string, string> = {
  rental_income: "Rental Income",
  deposit_received: "Deposit received",
  deposit_refunded: "Deposit refunded",
  deposit_forfeited: "Deposit forfeited (kept)",
  deposit_deduction: "Deposit deduction",
  repair: "Repair",
  servicing: "Servicing",
  maintenance: "Maintenance",
  fuel: "Fuel",
  insurance: "Insurance",
  tax: "Tax",
  finance: "Finance",
  fine: "Fine",
  accessories: "Accessories",
  refund: "Refund",
  deposit: "Deposit",
  other: "Other"
};

export type TransactionListItem = {
  id: string;
  displayCode: string | null;
  type: string;
  typeLabel: string;
  amount: number;
  currency: string;
  transactionDate: string;
  notes: string | null;
  supplier: string | null;
  mileage: number | null;
  vehicleId: string;
  vehicleLabel: string;
  rentalId: string | null;
  customerId: string | null;
  customerName: string | null;
  isDeposit: boolean;
  voided: boolean;
};

export type TransactionFormOptions = {
  vehicles: Array<{ id: string; label: string }>;
  customers: Array<{ id: string; label: string }>;
  rentals: Array<{ id: string; label: string; vehicleId: string; customerId: string }>;
};

export type TransactionFormPrefill = {
  type: string;
  amount: string;
  transactionDate: string;
  notes: string;
  vehicleId: string;
  rentalId: string;
  customerId: string;
  rentalPaymentId: string;
  taskId: string;
};

export async function getTransactionList(organizationId: string): Promise<TransactionListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("transactions")
    .select(
      "id, display_code, type, amount, currency, transaction_date, notes, supplier, mileage, vehicle_id, rental_id, customer_id, is_deposit, voided, vehicles!transactions_vehicle_id_fkey(registration_number, make, model), customers!transactions_customer_id_fkey(full_name)"
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    displayCode: row.display_code,
    type: row.type,
    typeLabel: typeLabels[row.type] || row.type,
    amount: Number(row.amount || 0),
    currency: row.currency || "THB",
    transactionDate: row.transaction_date,
    notes: row.notes,
    supplier: row.supplier,
    mileage: row.mileage,
    vehicleId: row.vehicle_id,
    vehicleLabel: [row.vehicles?.registration_number, row.vehicles?.make, row.vehicles?.model].filter(Boolean).join(" ") || "Vehicle",
    rentalId: row.rental_id,
    customerId: row.customer_id,
    customerName: row.customers?.full_name || null,
    isDeposit: Boolean(row.is_deposit),
    voided: Boolean(row.voided || row.metadata?.voided)
  }));
}

export async function getTransactionFormOptions(organizationId: string): Promise<TransactionFormOptions> {
  const supabase = (await createSupabaseServerClient()) as any;
  const [vehiclesResult, customersResult, rentalsResult] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, registration_number, make, model")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("registration_number"),
    supabase
      .from("customers")
      .select("id, full_name, phone")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .order("full_name"),
    supabase
      .from("rentals")
      .select("id, display_code, reference, vehicle_id, customer_id, customers!rentals_customer_id_fkey(full_name)")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .in("status", ["booked", "active", "due_soon", "overdue", "extended"])
      .order("start_date", { ascending: false })
      .limit(100)
  ]);

  const queryError = [vehiclesResult, customersResult, rentalsResult].find((result) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  return {
    vehicles: (vehiclesResult.data || []).map((row: any) => ({
      id: row.id,
      label: [row.registration_number, row.make, row.model].filter(Boolean).join(" ")
    })),
    customers: (customersResult.data || []).map((row: any) => ({
      id: row.id,
      label: row.full_name || row.phone || row.id.slice(0, 8)
    })),
    rentals: (rentalsResult.data || []).map((row: any) => ({
      id: row.id,
      vehicleId: row.vehicle_id,
      customerId: row.customer_id,
      label: [row.reference || row.display_code, row.customers?.full_name].filter(Boolean).join(" · ")
    }))
  };
}

export async function getTransactionFormPrefill({
  organizationId,
  rentalPaymentId,
  taskId
}: {
  organizationId: string;
  rentalPaymentId?: string;
  taskId?: string;
}): Promise<TransactionFormPrefill | null> {
  const supabase = (await createSupabaseServerClient()) as any;

  if (rentalPaymentId) {
    const { data, error } = await supabase
      .from("rental_payments")
      .select("id, rental_id, amount, due_date, rentals!inner(id, vehicle_id, customer_id, vehicles!rentals_vehicle_id_fkey(registration_number, make, model), customers!rentals_customer_id_fkey(full_name))")
      .eq("organization_id", organizationId)
      .eq("id", rentalPaymentId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) return null;

    const rental = data.rentals || {};
    const vehicle = rental.vehicles || {};
    const dueDate = String(data.due_date || "").slice(0, 10) || new Date().toISOString().slice(0, 10);
    const vehicleName = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || vehicle.registration_number || "vehicle";
    const month = new Intl.DateTimeFormat("en-TH", { month: "short" }).format(new Date(dueDate));

    return {
      type: "rental_income",
      amount: String(Number(data.amount || 0)),
      transactionDate: new Date().toISOString().slice(0, 10),
      notes: `${month} rental payment - ${vehicleName}`,
      vehicleId: rental.vehicle_id || "",
      rentalId: data.rental_id || rental.id || "",
      customerId: rental.customer_id || "",
      rentalPaymentId: data.id,
      taskId: taskId || ""
    };
  }

  if (taskId) {
    const { data, error } = await supabase
      .from("tasks")
      .select("id, title, vehicle_id, rental_id, rental_payment_id")
      .eq("organization_id", organizationId)
      .eq("id", taskId)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) return null;

    if (data.rental_payment_id) {
      const prefill = await getTransactionFormPrefill({ organizationId, rentalPaymentId: data.rental_payment_id, taskId: data.id });
      if (prefill) return prefill;
    }

    return {
      type: "rental_income",
      amount: "",
      transactionDate: new Date().toISOString().slice(0, 10),
      notes: data.title || "Payment",
      vehicleId: data.vehicle_id || "",
      rentalId: data.rental_id || "",
      customerId: "",
      rentalPaymentId: "",
      taskId: data.id
    };
  }

  return null;
}

export function isIncomeTransactionType(type: string) {
  return type === "rental_income" || type === "deposit_forfeited" || type === "deposit_deduction";
}

export { TRANSACTION_TYPE_OPTIONS };
