import { businessToday } from "@/lib/business-time";
import type { AssistantRecords, OpenPayment } from "@/lib/assistant-actions";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { plateKey } from "@/lib/receipt-reading";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The records the assistant's cards are built and checked against: the business's vehicles, customers and, for a
 * payment, what's still owed. Read with the person's own session, so RLS decides what they can see (a teammate gets
 * what the booking pages show them). Lighter than the dashboard data the owner's figures come from (lib/ask.ts).
 */
export type RecordsVehicle = { id: string; name: string; plate: string; colour: string; daily: number; weekly: number; monthly: number; deposit: number };
export type LoadedRecords = AssistantRecords & { vehicleRows: RecordsVehicle[]; customerPhones: Record<string, string>; organizationId: string };

const money = (currency: string) => (value: number) => {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: "narrowSymbol", maximumFractionDigits: 2 }).format(value);
  } catch {
    return `${currency} ${value}`;
  }
};

const shortDate = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export async function loadAssistantRecords(options: { payments?: boolean } = {}): Promise<LoadedRecords> {
  const organization = (await getDefaultOrganization()) as any;
  const supabase = (await createSupabaseServerClient()) as any;
  const currency = String(organization.currency || "THB");
  const [categories, { data: vehicles }, { data: customers }, payments] = await Promise.all([
    getVehicleCategories(organization.id).catch(() => []),
    supabase
      .from("vehicles")
      .select("id, make, model, year, color, registration_number, daily_rate, weekly_rate, monthly_rate, deposit_amount")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at")
      .limit(500),
    supabase.from("customers").select("id, full_name, phone").eq("organization_id", organization.id).is("deleted_at", null).order("created_at", { ascending: false }).limit(3000),
    options.payments ? openPayments(supabase, organization.id, currency) : Promise.resolve([])
  ]);
  const vehicleRows: RecordsVehicle[] = ((vehicles || []) as any[]).map((row) => ({
    id: row.id,
    name: `${row.make || ""} ${row.model || ""}${row.year ? ` ${row.year}` : ""}`.trim(),
    plate: String(row.registration_number || ""),
    colour: String(row.color || ""),
    daily: Number(row.daily_rate || 0),
    weekly: Number(row.weekly_rate || 0),
    monthly: Number(row.monthly_rate || 0),
    deposit: Number(row.deposit_amount || 0)
  }));
  return {
    organizationId: organization.id,
    today: businessToday(),
    currency,
    vehicles: vehicleRows.map((row) => ({ id: row.id, name: row.name, plate: row.plate })),
    vehicleRows,
    customers: ((customers || []) as any[]).map((row) => ({ id: row.id, name: String(row.full_name || "") })).filter((row) => row.name),
    customerPhones: Object.fromEntries(((customers || []) as any[]).filter((row) => row.phone).map((row) => [row.id, String(row.phone)])),
    categories,
    payments
  };
}

/** Rent, deposits and charges still to be paid: anything overdue, and what falls due in the next 45 days. */
async function openPayments(supabase: any, organizationId: string, currency: string): Promise<OpenPayment[]> {
  const horizon = businessToday(45);
  const { data } = await supabase
    .from("rental_payments")
    .select("id, rental_id, amount, due_date, status, voided, metadata, customer:customers(full_name), vehicle:vehicles(make, model, registration_number)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .in("status", ["pending", "overdue", "scheduled"])
    .lte("due_date", horizon)
    .order("due_date")
    .limit(300);
  const format = money(currency);
  return ((data || []) as any[])
    .filter((row) => !row.voided && !row.metadata?.voided && Number(row.amount) > 0)
    .map((row) => {
      const type = String(row.metadata?.type || "");
      const what = type === "deposit" || row.metadata?.is_deposit === true ? "Deposit" : type === "charge" ? String(row.metadata?.description || "Charge").slice(0, 40) : row.metadata?.period_label ? `Rent ${row.metadata.period_label}` : "Rent";
      const vehicle = row.vehicle ? `${row.vehicle.make || ""} ${row.vehicle.model || ""} ${row.vehicle.registration_number || ""}`.replace(/\s+/g, " ").trim() : "";
      return {
        id: row.id,
        rentalId: row.rental_id,
        amount: Number(row.amount),
        dueDate: String(row.due_date || ""),
        customer: String(row.customer?.full_name || vehicle || "Customer"),
        label: [what, format(Number(row.amount)), row.due_date ? `due ${shortDate(row.due_date)}` : "", vehicle].filter(Boolean).join(" · ")
      };
    });
}

/** Lowercase words, for loose matching of what someone typed against names. */
function tokens(value: string) {
  return String(value || "").toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, " ").split(/\s+/).filter((word) => word.length > 1);
}

/** The vehicle someone meant ("the white Yaris", "1กก 1234", "Honda Click 2022"): by plate first, then by its words. */
export function matchVehicle(records: LoadedRecords, said: string | null | undefined): RecordsVehicle | null {
  const asked = String(said || "").trim();
  if (!asked) return null;
  const key = plateKey(asked);
  if (key.length >= 3) {
    const byPlate = records.vehicleRows.filter((row) => row.plate && (plateKey(row.plate) === key || (key.length >= 4 && plateKey(row.plate).includes(key)) || (plateKey(row.plate).length >= 4 && key.includes(plateKey(row.plate)))));
    if (byPlate.length === 1) return byPlate[0];
  }
  const words = tokens(asked);
  if (!words.length) return null;
  const scored = records.vehicleRows
    .map((row) => {
      const theirs = new Set(tokens(`${row.name} ${row.colour} ${row.plate}`));
      return { row, score: words.filter((word) => theirs.has(word)).length };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
  // Only a clear winner; otherwise they pick on the card.
  return scored.length && (scored.length === 1 || scored[0].score > scored[1].score) ? scored[0].row : null;
}

/** An existing customer by name (or phone), when exactly one fits. */
export function matchCustomer(records: LoadedRecords, name: string | null | undefined, phone?: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (digits.length >= 6) {
    const id = Object.entries(records.customerPhones).find(([, value]) => value.replace(/\D/g, "").endsWith(digits.slice(-8)))?.[0];
    const found = id ? records.customers.find((customer) => customer.id === id) : null;
    // The same phone is the same person only when the name agrees too (or none was given): a name typed with
    // someone else's number must never quietly become that customer.
    const named = tokens(String(name || ""));
    if (found && (!named.length || named.some((word) => tokens(found.name).includes(word)))) return found;
  }
  const asked = String(name || "").trim().toLowerCase();
  if (!asked) return null;
  const exact = records.customers.filter((customer) => customer.name.toLowerCase() === asked);
  if (exact.length === 1) return exact[0];
  const loose = records.customers.filter((customer) => customer.name.toLowerCase().includes(asked) || (asked.length > 3 && asked.includes(customer.name.toLowerCase())));
  return loose.length === 1 ? loose[0] : null;
}

/** The payments of the customer someone named (or of a booking), oldest first. */
export function paymentsFor(records: LoadedRecords, input: { customer?: string | null; rentalId?: string | null }) {
  const payments = records.payments || [];
  if (input.rentalId) {
    const forRental = payments.filter((payment) => payment.rentalId === input.rentalId);
    if (forRental.length) return forRental;
  }
  const asked = tokens(String(input.customer || ""));
  if (!asked.length) return [];
  const scored = payments
    .map((payment) => ({ payment, score: asked.filter((word) => tokens(payment.customer).includes(word)).length }))
    .filter((entry) => entry.score > 0);
  const best = Math.max(0, ...scored.map((entry) => entry.score));
  return scored.filter((entry) => entry.score === best).map((entry) => entry.payment);
}
