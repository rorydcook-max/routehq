import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Branch = {
  id: string;
  organization_id: string;
  name: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  email: string | null;
  is_active: boolean;
  created_at: string;
};

export async function getBranches(organizationId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const { data, error } = await supabase
    .from("branches")
    .select("id, organization_id, name, address, latitude, longitude, phone, email, is_active, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as Branch[];
}

export async function ensureDefaultBranch(organisation: { id: string; name: string }) {
  const supabase = (await createSupabaseServerClient()) as any;
  const existingBranches = await getBranches(organisation.id);

  if (existingBranches.length > 0) {
    return existingBranches;
  }

  const { data, error } = await supabase
    .from("branches")
    .insert({
      organization_id: organisation.id,
      name: organisation.name,
      is_active: true
    })
    .select("id, organization_id, name, address, latitude, longitude, phone, email, is_active, created_at")
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Unable to create default branch.");
  }

  return [data as Branch];
}
