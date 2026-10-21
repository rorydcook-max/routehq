import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A connection that acts as the signed-in person, for work finished after the reply has gone (Next's after()),
 * when their cookies can no longer be read. Take the access token while the request is still live and pass it
 * here: row rules and anything that records who did it (auth.uid()) still see that person.
 */
export function createSupabaseClientAsUser(accessToken: string) {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false }
  });
}
