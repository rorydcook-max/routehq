import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type InspectionMode = "delivery" | "return" | "condition_report";

export type InspectionContext = {
  mode: InspectionMode;
  organizationId: string;
  rental: any | null;
  unpaidPayments: any[];
  vehicle: any;
  customer: any | null;
  gpsDevice: any | null;
  latestLocation: any | null;
  deliveryInspection: any | null;
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
  mode: "delivery" | "return"
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

  const [gpsResult, locationResult, deliveryResult, unpaidPaymentsResult] = await Promise.all([
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
      .select("id, amount, due_date, status")
      .eq("organization_id", organizationId)
      .eq("rental_id", rentalId)
      .is("deleted_at", null)
      .in("status", ["scheduled", "pending", "failed", "overdue"])
      .order("due_date", { ascending: true })
  ]);

  const queryError = [gpsResult, locationResult, deliveryResult, unpaidPaymentsResult].find((result) => result.error && result.error.code !== "PGRST116")?.error;
  if (queryError) {
    throw new Error(queryError.message);
  }

  return {
    mode,
    organizationId,
    rental,
    unpaidPayments: Array.isArray(unpaidPaymentsResult.data) ? unpaidPaymentsResult.data : unpaidPaymentsResult.data ? [unpaidPaymentsResult.data] : [],
    vehicle: rental.vehicles,
    customer: rental.customers || null,
    gpsDevice: gpsResult.data || null,
    latestLocation: locationResult.data || null,
    deliveryInspection: await addSignedInspectionUrls(supabase, deliveryResult.data || null)
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
