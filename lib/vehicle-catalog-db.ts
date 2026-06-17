import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export type VehicleMake = {
  id: string;
  name: string;
  slug: string;
  origin_country: string | null;
  logo_url: string | null;
  sort_order: number;
};

export type VehicleModel = {
  id: string;
  make_id: string;
  name: string;
  category_code: string;
  body_type: string | null;
};

export type VehicleTrim = {
  id: string;
  model_id: string;
  name: string;
  year_from: number;
  year_to: number | null;
  engine_cc: number | null;
  transmission: string | null;
  fuel_type: string | null;
  seating_capacity: number | null;
  drivetrain: string | null;
};

export async function fetchVehicleMakes() {
  const supabase = createSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("vehicle_makes")
    .select("id, name, slug, origin_country, logo_url, sort_order")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as VehicleMake[];
}

export async function fetchVehicleMakesForCategory(categoryCode: string) {
  const supabase = createSupabaseBrowserClient() as any;
  const { data: modelRows, error: modelError } = await supabase
    .from("vehicle_models")
    .select("make_id")
    .eq("category_code", categoryCode)
    .eq("is_active", true);

  if (modelError) {
    throw new Error(modelError.message);
  }

  const makeIds = Array.from(new Set<string>((modelRows || []).map((row: { make_id: string }) => row.make_id))).filter(Boolean);
  if (makeIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("vehicle_makes")
    .select("id, name, slug, origin_country, logo_url, sort_order")
    .in("id", makeIds)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as VehicleMake[];
}

export async function fetchVehicleModels(makeId: string, categoryCode: string) {
  const supabase = createSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("vehicle_models")
    .select("id, make_id, name, category_code, body_type")
    .eq("make_id", makeId)
    .eq("category_code", categoryCode)
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as VehicleModel[];
}

export async function fetchVehicleTrims(modelId: string) {
  const supabase = createSupabaseBrowserClient() as any;
  const { data, error } = await supabase
    .from("vehicle_trims")
    .select("id, model_id, name, year_from, year_to, engine_cc, transmission, fuel_type, seating_capacity, drivetrain")
    .eq("model_id", modelId)
    .eq("is_active", true)
    .order("year_from", { ascending: false })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data || []) as VehicleTrim[];
}
