import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InspectionMode = "delivery" | "return" | "condition_report";

export type InspectionContext = {
  mode: InspectionMode;
  organizationId: string;
  rental: any | null;
  unpaidPayments: any[];
  /** True when the booking has any rent/deposit rows at all. */
  hasPaymentSchedule?: boolean;
  vehicle: any;
  customer: any | null;
  gpsDevice: any | null;
  latestLocation: any | null;
  deliveryInspection: any | null;
  /**
   * A change of vehicle during a rental: the form records the replacement being
   * handed over, or the original being collected, without starting or ending the rental.
   */
  swap?: boolean;
};

async function addSignedInspectionUrls(supabase: any, inspection: any | null) {
  if (!inspection) {
    return null;
  }

  const photos = Array.isArray(inspection.photos) ? inspection.photos : [];
  const signedPhotos = await Promise.all(
    photos.map(async (photo: any) => {
      if (!photo?.url || /^https?:\/\//.test(photo.url) || photo.url.startsWith("data:")) {
        return photo;
      }
      const { data } = await supabase.storage.from("documents").createSignedUrl(photo.url, 60 * 60);
      return { ...photo, signed_url: data?.signedUrl || null };
    })
  );

  let signedVideoUrl: string | null = null;
  if (inspection.video_url && !/^https?:\/\//.test(inspection.video_url) && !inspection.video_url.startsWith("data:")) {
    const { data } = await supabase.storage.from("documents").createSignedUrl(inspection.video_url, 60 * 60);
    signedVideoUrl = data?.signedUrl || null;
  }

  return {
    ...inspection,
    photos: signedPhotos,
    signed_video_url: signedVideoUrl
  };
}

export async function getInspectionContextByRental(
  rentalId: string,
  organizationId: string,
  mode: "delivery" | "return",
  swap?: { vehicleId?: string | null }
): Promise<InspectionContext> {
  const supabase = (await createSupabaseServerClient()) as any;

  const { data: rental, error } = await supabase
    .from("rentals")
    .select(
      "*, vehicles!rentals_vehicle_id_fkey(*, vehicle_categories!vehicles_category_id_fkey(id, code, name)), customers!rentals_customer_id_fkey(*)"
    )
    .eq("id", rentalId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!rental?.vehicles) {
    notFound();
  }

  const [gpsResult, locationResult, deliveryResult, unpaidPaymentsResult, scheduleCountResult] = await Promise.all([
    supabase
      .from("gps_devices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", rental.vehicle_id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("vehicle_locations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", rental.vehicle_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("inspections")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .eq("type", "delivery")
      .eq("status", "submitted")
      .is("deleted_at", null)
      .order("submitted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("rental_payments")
      .select("id, amount, due_date, status, metadata")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .in("status", ["scheduled", "pending", "failed", "overdue"])
      // Only rent already due counts against the deposit; later months are not owed on return.
      .lte("due_date", new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(new Date()))
      .order("due_date", { ascending: true }),
    supabase
      .from("rental_payments")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
  ]);

  const queryError = [gpsResult, locationResult, deliveryResult, unpaidPaymentsResult].find((result) => result.error && result.error.code !== "PGRST116")?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  if (swap) {
    // Collecting the original vehicle: the form is about that vehicle, not the one the rental is on now.
    let vehicle = rental.vehicles;
    let deliveryInspection = deliveryResult.data || null;
    let rentalForForm = rental;
    if (mode === "return") {
      const originalId = String(swap.vehicleId || "");
      const { data: change } = await supabase.from("vehicle_changes").select("id").eq("organization_id", organizationId).eq("rental_id", rentalId).eq("from_vehicle_id", originalId).limit(1).maybeSingle();
      if (!originalId || !change) notFound();
      const [{ data: original }, { data: handover }] = await Promise.all([
        supabase.from("vehicles").select("*, vehicle_categories!vehicles_category_id_fkey(id, code, name)").eq("id", originalId).eq("organization_id", organizationId).maybeSingle(),
        supabase.from("inspections").select("*").eq("organization_id", organizationId).eq("rental_id", rentalId).eq("vehicle_id", originalId).eq("type", "delivery").eq("status", "submitted").is("deleted_at", null).order("submitted_at", { ascending: false }).limit(1).maybeSingle()
      ]);
      if (!original) notFound();
      vehicle = original;
      deliveryInspection = handover || null;
      // "Driven during rental" is measured from when this vehicle was handed over.
      rentalForForm = { ...rental, mileage_at_delivery: handover?.odometer_reading ?? (rental.vehicle_id === originalId ? rental.mileage_at_delivery : null) };
    }
    return {
      mode,
      organizationId,
      rental: rentalForForm,
      unpaidPayments: [],
      hasPaymentSchedule: true,
      vehicle,
      customer: rental.customers || null,
      gpsDevice: mode === "delivery" ? gpsResult.data || null : null,
      latestLocation: mode === "delivery" ? locationResult.data || null : null,
      deliveryInspection: await addSignedInspectionUrls(supabase, deliveryInspection),
      swap: true
    };
  }

  // After a change of vehicle, the latest handover on file may be for the vehicle the customer no
  // longer has. Comparing this vehicle's odometer and damage against that one gives nonsense
  // ("driven 71,650 km"), so only a handover of the vehicle now on the rental counts.
  const latestHandover = deliveryResult.data || null;
  const handoverIsForThisVehicle = !latestHandover?.vehicle_id || latestHandover.vehicle_id === rental.vehicle_id;
  const handover = handoverIsForThisVehicle ? latestHandover : null;
  const vehicleWasChanged = Boolean(rental.original_vehicle_id && rental.original_vehicle_id !== rental.vehicle_id);
  const rentalForForm = vehicleWasChanged ? { ...rental, mileage_at_delivery: handover?.odometer_reading ?? null } : rental;

  return {
    mode,
    organizationId,
    rental: rentalForForm,
    unpaidPayments: Array.isArray(unpaidPaymentsResult.data) ? unpaidPaymentsResult.data : unpaidPaymentsResult.data ? [unpaidPaymentsResult.data] : [],
    hasPaymentSchedule: Number(scheduleCountResult.count || 0) > 0,
    vehicle: rental.vehicles,
    customer: rental.customers || null,
    gpsDevice: gpsResult.data || null,
    latestLocation: locationResult.data || null,
    deliveryInspection: await addSignedInspectionUrls(supabase, handover)
  };
}

export async function getInspectionContextByVehicle(
  vehicleId: string,
  organizationId: string
): Promise<InspectionContext> {
  const supabase = (await createSupabaseServerClient()) as any;

  const { data: vehicle, error } = await supabase
    .from("vehicles")
    .select("*, vehicle_categories!vehicles_category_id_fkey(id, code, name)")
    .eq("id", vehicleId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!vehicle) {
    notFound();
  }

  const [gpsResult, locationResult] = await Promise.all([
    supabase
      .from("gps_devices")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("vehicle_locations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("vehicle_id", vehicleId)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  const queryError = [gpsResult, locationResult].find((result) => result.error && result.error.code !== "PGRST116")?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  return {
    mode: "condition_report",
    organizationId,
    rental: null,
    unpaidPayments: [],
    vehicle,
    customer: null,
    gpsDevice: gpsResult.data || null,
    latestLocation: locationResult.data || null,
    deliveryInspection: null
  };
}
