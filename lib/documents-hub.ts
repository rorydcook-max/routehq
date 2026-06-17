import { createSupabaseServerClient } from "@/lib/supabase/server";

export type DocumentListItem = {
  id: string;
  fileName: string;
  category: string;
  ownerType: string;
  ownerId: string | null;
  ownerLabel: string;
  mimeType: string | null;
  createdAt: string;
  signedUrl: string | null;
  href: string | null;
};

async function signedPath(supabase: any, path: string) {
  const { data } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 60);
  return data?.signedUrl || null;
}

function ownerHref(ownerType: string, ownerId: string | null) {
  if (!ownerId) return null;
  if (ownerType === "vehicle") return `/fleet/${ownerId}`;
  if (ownerType === "customer") return `/customers/${ownerId}`;
  if (ownerType === "rental") return `/bookings/${ownerId}`;
  return null;
}

export async function getDocumentList(organizationId: string, limit = 100): Promise<DocumentListItem[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("documents")
    .select("id, file_name, category, owner_type, owner_id, mime_type, storage_path, created_at")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(error.message);
  }

  const vehicleIds = [...new Set((data || []).filter((row: any) => row.owner_type === "vehicle" && row.owner_id).map((row: any) => row.owner_id))];
  const customerIds = [...new Set((data || []).filter((row: any) => row.owner_type === "customer" && row.owner_id).map((row: any) => row.owner_id))];
  const rentalIds = [...new Set((data || []).filter((row: any) => row.owner_type === "rental" && row.owner_id).map((row: any) => row.owner_id))];

  const [vehiclesResult, customersResult, rentalsResult] = await Promise.all([
    vehicleIds.length
      ? supabase.from("vehicles").select("id, registration_number, make, model").in("id", vehicleIds)
      : Promise.resolve({ data: [] }),
    customerIds.length
      ? supabase.from("customers").select("id, full_name").in("id", customerIds)
      : Promise.resolve({ data: [] }),
    rentalIds.length
      ? supabase.from("rentals").select("id, reference, display_code").in("id", rentalIds)
      : Promise.resolve({ data: [] })
  ]);

  const vehicleLabels = new Map((vehiclesResult.data || []).map((row: any) => [row.id, [row.registration_number, row.make, row.model].filter(Boolean).join(" ")]));
  const customerLabels = new Map((customersResult.data || []).map((row: any) => [row.id, row.full_name]));
  const rentalLabels = new Map((rentalsResult.data || []).map((row: any) => [row.id, row.reference || row.display_code || row.id.slice(0, 8)]));

  return Promise.all(
    (data || []).map(async (row: any) => {
      let ownerLabel = row.owner_type;
      if (row.owner_type === "vehicle" && row.owner_id) ownerLabel = vehicleLabels.get(row.owner_id) || ownerLabel;
      if (row.owner_type === "customer" && row.owner_id) ownerLabel = customerLabels.get(row.owner_id) || ownerLabel;
      if (row.owner_type === "rental" && row.owner_id) ownerLabel = rentalLabels.get(row.owner_id) || ownerLabel;

      return {
        id: row.id,
        fileName: row.file_name,
        category: row.category,
        ownerType: row.owner_type,
        ownerId: row.owner_id,
        ownerLabel,
        mimeType: row.mime_type,
        createdAt: row.created_at,
        signedUrl: await signedPath(supabase, row.storage_path),
        href: ownerHref(row.owner_type, row.owner_id)
      };
    })
  );
}
