import { createSupabaseServerClient } from "@/lib/supabase/server";

async function signedPath(supabase: any, path: string | null | undefined) {
  if (!path || /^https?:\/\//.test(path) || path.startsWith("data:")) {
    return path || null;
  }
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

async function signInspection(supabase: any, inspection: any) {
  const photos = Array.isArray(inspection.photos) ? inspection.photos : [];
  const damageItems = Array.isArray(inspection.damage_items) ? inspection.damage_items : [];
  return {
    ...inspection,
    photos: await Promise.all(
      photos.map(async (photo: any) => ({
        ...photo,
        signed_url: await signedPath(supabase, photo.url)
      }))
    ),
    damage_items: await Promise.all(
      damageItems.map(async (item: any) => ({
        ...item,
        photo_url: await signedPath(supabase, item.photo_url)
      }))
    ),
    signed_video_url: await signedPath(supabase, inspection.video_url)
  };
}

function portalActionSummary(action: any) {
  const content = action.content || {};
  if (action.action_type === "extension_request") return `Customer requested extension to ${content.new_end_date || "a new return date"}${content.note ? `: ${content.note}` : ""}`;
  if (action.action_type === "return_confirmation") return `Customer confirmed return ${content.return_date || ""} ${content.return_time || ""}${content.return_location ? ` at ${content.return_location}` : ""}`.trim();
  if (action.action_type === "problem_report") return `${content.category || "Problem report"}: ${content.description || "No description provided"}`;
  if (action.action_type === "question") return content.question || "Customer asked a question";
  return "Customer portal action";
}

function buildCommunicationTimeline(communicationLog: any[], portalActions: any[]) {
  const logEntries = (communicationLog || []).map((entry: any) => ({
    ...entry,
    source: "communication_log",
    timeline_type: entry.type,
    timeline_id: `log-${entry.id}`,
    content: entry.content || "",
    created_at: entry.created_at
  }));

  const actionEntries = (portalActions || []).map((action: any) => ({
    id: action.id,
    source: "customer_portal_action",
    timeline_type: "customer_portal_action",
    timeline_id: `portal-${action.id}`,
    type: "customer_portal_action",
    action_type: action.action_type,
    direction: "inbound",
    channel: "booking_portal",
    content: portalActionSummary(action),
    status: action.status,
    created_at: action.created_at,
    action
  }));

  return [...logEntries, ...actionEntries].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime());
}

export async function getRentalDetail(rentalId: string, organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;

  const { data: rental, error } = await supabase
    .from("rentals")
    .select("*, vehicles!rentals_vehicle_id_fkey(*), customers!rentals_customer_id_fkey(*)")
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!rental) {
    return null;
  }

  const [bookingLinksResult, inspectionsResult, transactionsResult, paymentsResult, portalActionsResult, communicationResult] = await Promise.all([
    supabase
      .from("booking_links")
      .select("id, rental_id, token, public_url, preferred_payment_method, payment_timing, payment_reported_by_customer, payment_reported_at")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("inspections")
      .select("*, customers!inspections_customer_id_fkey(full_name, nationality, phone)")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("rental_payments")
      .select("id, amount, due_date, status, metadata, paid_at, voided, type")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("customer_portal_actions")
      .select("*")
      .eq("organisation_id", organizationId)
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: false }),
    supabase
      .from("communication_log")
      .select("*")
      .eq("organisation_id", organizationId)
      .eq("rental_id", rentalId)
      .order("created_at", { ascending: false })
      .limit(50)
  ]);

  const queryError = [bookingLinksResult, inspectionsResult, transactionsResult, paymentsResult, portalActionsResult, communicationResult].find((result) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const bookingLink = bookingLinksResult.data?.[0] || null;
  const customerPortalActions = portalActionsResult.data || [];
  const communicationLog = communicationResult.data || [];
  const rentalPayments = paymentsResult.data || [];
  const rentalTransactions = transactionsResult.data || [];
  const totalScheduled = rentalPayments
    .filter((payment: any) => !payment.voided && !payment.metadata?.voided && payment.status !== "voided" && payment.status !== "waived")
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const totalPaidIncome = rentalTransactions
    .filter((transaction: any) => transaction.type === "rental_income" && !transaction.voided && !transaction.metadata?.voided)
    .reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const calculatedBalance = Math.max(0, totalScheduled - totalPaidIncome);

  return {
    rental: {
      ...rental,
      rental_payments: rentalPayments,
      balance_due: calculatedBalance,
      total_scheduled: totalScheduled,
      total_paid_income: totalPaidIncome,
      deposit_held: rental.deposit_held ?? 0,
      deposit_status: rental.deposit_status ?? "pending",
      deposit_received_at: rental.deposit_received_at ?? null,
      deposit_refunded_amount: rental.deposit_refunded_amount ?? 0,
      deposit_forfeited_amount: rental.deposit_forfeited_amount ?? 0,
      deposit_deduction_reason: rental.deposit_deduction_reason ?? null,
      deposit_reconciled_at: rental.deposit_reconciled_at ?? null,
      preferred_payment_method: bookingLink?.preferred_payment_method ?? null,
      payment_timing: bookingLink?.payment_timing ?? null,
      payment_reported_by_customer: bookingLink?.payment_reported_by_customer ?? false,
      payment_reported_at: bookingLink?.payment_reported_at ?? null
    },
    bookingLink,
    customerPortalActions,
    communicationLog,
    communicationTimeline: buildCommunicationTimeline(communicationLog, customerPortalActions),
    inspections: await Promise.all((inspectionsResult.data || []).map((inspection: any) => signInspection(supabase, inspection))),
    transactions: rentalTransactions,
    rental_payments: rentalPayments
  };
}
