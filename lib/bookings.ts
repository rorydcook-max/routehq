import { businessToday } from "@/lib/business-time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildUpcomingPayments, buildVehicleEvents } from "@/lib/rental-upcoming";

async function signedPath(supabase: any, path: string | null | undefined) {
  if (!path || /^https?:\/\//.test(path) || path.startsWith("data:")) {
    return path || null;
  }
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

async function signedDocumentPath(supabase: any, bucket: string | null | undefined, path: string | null | undefined) {
  if (!path || /^https?:\/\//.test(path) || path.startsWith("data:")) {
    return path || null;
  }
  const { data } = await supabase.storage.from(bucket || "documents").createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

function isVehiclePhoto(document: any) {
  return document.mime_type?.startsWith("image/") || ["photo", "photos", "vehicle_photo", "vehicle_image"].includes(document.category);
}

function vehiclePhotoOrder(document: any) {
  const order = Number(document.extracted_data?.vehicle_photo_order);
  return Number.isFinite(order) ? order : null;
}

function sortVehiclePhotoDocuments(documents: any[]) {
  return documents.filter(isVehiclePhoto).sort((left, right) => {
    const leftOrder = vehiclePhotoOrder(left);
    const rightOrder = vehiclePhotoOrder(right);

    if (leftOrder !== null && rightOrder !== null) return leftOrder - rightOrder;
    if (leftOrder !== null) return -1;
    if (rightOrder !== null) return 1;

    return new Date(right.created_at || 0).getTime() - new Date(left.created_at || 0).getTime();
  });
}

async function signDocument(supabase: any, document: any) {
  return {
    ...document,
    signed_url: await signedPath(supabase, document.storage_path)
  };
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

export async function getBookingList(organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: rentals, error } = await supabase
    .from("rentals")
    .select("*, vehicles!rentals_vehicle_id_fkey(id, make, model, trim, year, registration_number, status), customers!rentals_customer_id_fkey(id, full_name, phone, nationality, document_status)")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  const rentalIds = (rentals || []).map((rental: any) => rental.id);
  const vehicleIds = Array.from(new Set((rentals || []).map((rental: any) => rental.vehicle_id || rental.vehicles?.id).filter(Boolean)));
  const [linksResult, transactionsResult, paymentsResult, vehiclePhotosResult] = rentalIds.length
    ? await Promise.all([
        supabase
          .from("booking_links")
          .select("id, rental_id, token, status, public_url, viewed_at, customer_details_submitted_at, contract_signed_at, completed_at, expires_at")
          .eq("organization_id", organizationId)
          .in("rental_id", rentalIds)
          .is("deleted_at", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("id, rental_id, type, amount, voided")
          .eq("organization_id", organizationId)
          .in("rental_id", rentalIds)
          .is("deleted_at", null)
          .neq("voided", true),
        supabase
          .from("rental_payments")
          .select("id, rental_id, amount, status, voided, metadata")
          .eq("organization_id", organizationId)
          .in("rental_id", rentalIds)
          .is("deleted_at", null),
        vehicleIds.length
          ? supabase
              .from("documents")
              .select("id, owner_id, file_name, category, mime_type, storage_bucket, storage_path, created_at, extracted_data")
              .eq("organization_id", organizationId)
              .eq("owner_type", "vehicle")
              .in("owner_id", vehicleIds)
              .is("deleted_at", null)
          : Promise.resolve({ data: [], error: null })
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const queryError = [linksResult, transactionsResult, paymentsResult, vehiclePhotosResult].find((result: any) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const linkByRental = new Map<string, any>();
  for (const link of linksResult.data || []) {
    if (!linkByRental.has(link.rental_id)) {
      linkByRental.set(link.rental_id, link);
    }
  }

  const paidByRental = new Map<string, number>();
  for (const transaction of transactionsResult.data || []) {
    if (transaction.type !== "rental_income") continue;
    const current = paidByRental.get(transaction.rental_id) || 0;
    paidByRental.set(transaction.rental_id, current + Math.abs(Number(transaction.amount || 0)));
  }

  const balanceByRental = new Map<string, number>();
  for (const payment of paymentsResult.data || []) {
    if (payment.voided || payment.metadata?.voided || payment.metadata?.is_deposit) continue;
    if (!["pending", "overdue"].includes(payment.status)) continue;
    const current = balanceByRental.get(payment.rental_id) || 0;
    balanceByRental.set(payment.rental_id, current + Number(payment.amount || 0));
  }

  const photosByVehicle = new Map<string, any[]>();
  for (const document of vehiclePhotosResult.data || []) {
    if (!isVehiclePhoto(document)) continue;
    const current = photosByVehicle.get(document.owner_id) || [];
    current.push(document);
    photosByVehicle.set(document.owner_id, current);
  }

  const primaryPhotoByVehicle = new Map<string, string | null>();
  await Promise.all(
    Array.from(photosByVehicle.entries()).map(async ([vehicleId, documents]) => {
      const [primaryPhoto] = sortVehiclePhotoDocuments(documents);
      primaryPhotoByVehicle.set(vehicleId, await signedDocumentPath(supabase, primaryPhoto?.storage_bucket, primaryPhoto?.storage_path));
    })
  );

  return (rentals || []).map((rental: any) => ({
    ...rental,
    vehicles: rental.vehicles
      ? {
          ...rental.vehicles,
          primary_photo_url: primaryPhotoByVehicle.get(rental.vehicle_id || rental.vehicles.id) || null
        }
      : rental.vehicles,
    booking_link: linkByRental.get(rental.id) || null,
    total_paid: paidByRental.get(rental.id) || 0,
    balance_due: balanceByRental.get(rental.id) || 0
  }));
}

export async function getBookingDetail(rentalId: string, organizationId: string) {
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

  const today = businessToday();
  const [bookingLinksResult, contractsResult, paymentsResult, upcomingPaymentsResult, vehicleTasksResult, transactionsResult, inspectionsResult, documentsResult, activityResult, portalActionsResult, communicationResult] = await Promise.all([
    supabase
      .from("booking_links")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("contracts")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("rental_payments")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("due_date", { ascending: true }),
    supabase
      .from("rental_payments")
      .select("id, amount, currency, due_date, scheduled_date, status, metadata, voided")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .in("status", ["scheduled", "pending", "overdue"])
      .order("due_date", { ascending: true })
      .limit(6),
    rental.vehicle_id
      ? supabase
          .from("tasks")
          .select("id, title, task_type, due_at, completed_at")
          .eq("organization_id", organizationId)
          .eq("vehicle_id", rental.vehicle_id)
          .is("deleted_at", null)
          .is("completed_at", null)
          .gte("due_at", `${today}T00:00:00.000Z`)
          .in("task_type", ["service", "insurance", "tax", "maintenance", "compliance"])
          .order("due_at", { ascending: true, nullsFirst: false })
          .limit(10)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("transactions")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("transaction_date", { ascending: false }),
    supabase
      .from("inspections")
      .select("*, customers!inspections_customer_id_fkey(full_name, nationality, phone)")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("organization_id", organizationId)
      .in("owner_type", ["customer", "contract", "rental"])
      .in("owner_id", [rental.customer_id, rental.contract_id, rental.id].filter(Boolean))
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("activity_events")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .order("occurred_at", { ascending: false }),
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

  const queryError = [bookingLinksResult, contractsResult, paymentsResult, upcomingPaymentsResult, vehicleTasksResult, transactionsResult, inspectionsResult, documentsResult, activityResult, portalActionsResult, communicationResult].find((result: any) => result.error)?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  const documents = await Promise.all((documentsResult.data || []).map((document: any) => signDocument(supabase, document)));
  const contracts = await Promise.all(
    (contractsResult.data || []).map(async (contract: any) => ({
      ...contract,
      signed_pdf_url: await signedPath(supabase, contract.content_pdf_url)
    }))
  );

  const customerPortalActions = portalActionsResult.data || [];
  const communicationLog = communicationResult.data || [];
  const rentalPayments = paymentsResult.data || [];
  const upcomingPayments = buildUpcomingPayments(upcomingPaymentsResult.data || [], rental.currency || "THB");
  const vehicleEvents = buildVehicleEvents(rental.vehicles, vehicleTasksResult.data || []);
  const rentalTransactions = transactionsResult.data || [];
  const activeRentPayments = rentalPayments.filter((payment: any) => {
    const metadata = payment.metadata || {};
    return (
      !payment.voided &&
      !metadata.voided &&
      payment.status !== "voided" &&
      payment.status !== "waived" &&
      metadata.is_deposit !== true &&
      metadata.type !== "deposit"
    );
  });
  const scheduledTotal = activeRentPayments
    .filter((payment: any) => payment.status === "scheduled")
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const pendingTotal = activeRentPayments
    .filter((payment: any) => payment.status === "pending")
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const overdueTotal = activeRentPayments
    .filter((payment: any) => payment.status === "overdue")
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const totalPaidIncome = rentalTransactions
    .filter((transaction: any) => transaction.type === "rental_income" && !transaction.voided && !transaction.metadata?.voided)
    .reduce((sum: number, transaction: any) => sum + Math.abs(Number(transaction.amount || 0)), 0);
  const outstandingBalance = pendingTotal + overdueTotal;

  return {
    rental: {
      ...rental,
      rental_payments: rentalPayments,
      balance_due: outstandingBalance,
      outstandingBalance,
      scheduledTotal,
      pendingTotal,
      overdueTotal,
      total_scheduled: scheduledTotal,
      scheduled_total: scheduledTotal,
      pending_total: pendingTotal,
      overdue_total: overdueTotal,
      total_paid_income: totalPaidIncome,
      upcoming_payments: upcomingPayments,
      vehicle_events: vehicleEvents
    },
    bookingLink: bookingLinksResult.data?.[0] || null,
    bookingLinks: bookingLinksResult.data || [],
    contract: contracts[0] || null,
    contracts,
    payments: rentalPayments,
    transactions: rentalTransactions,
    inspections: await Promise.all((inspectionsResult.data || []).map((inspection: any) => signInspection(supabase, inspection))),
    documents,
    activityEvents: activityResult.data || [],
    customerPortalActions,
    communicationLog,
    communicationTimeline: buildCommunicationTimeline(communicationLog, customerPortalActions),
    upcoming_payments: upcomingPayments,
    vehicle_events: vehicleEvents
  };
}

export async function getCustomersForSelector(organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data } = await supabase
    .from("customers")
    .select("id, full_name, phone, nationality, document_status")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("full_name", { ascending: true });
  return (data || []) as Array<{ id: string; full_name: string; phone: string | null; nationality: string | null; document_status: string | null }>;
}
