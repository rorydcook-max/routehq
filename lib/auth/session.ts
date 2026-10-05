import { hasSupabaseEnv } from "@/lib/supabase/config";
import { getRequestUser } from "@/lib/supabase/server";

export async function getCurrentUserEmail() {
  if (!hasSupabaseEnv()) {
    return null;
  }

  const user = await getRequestUser();

  return user?.email ?? null;
}
