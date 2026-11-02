import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Database } from "@/lib/supabase/database.types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server Components cannot always set cookies; middleware/server actions can.
          }
        }
      }
    }
  );
}

/**
 * Who is signed in, checked once per request. A page asks this several times
 * (the page itself, the business lookup, the role check); each one used to be
 * its own trip to the sign-in service.
 */
export const getRequestUser = cache(async (): Promise<User | null> => {
  const supabase = await createSupabaseServerClient();
  // Read from the signed sign-in token and checked against the service's published key, here, rather than a trip to
  // the sign-in service on every page (Rory, 2 Nov 2026: pages felt slow). Same person, same details.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as Record<string, any> | undefined;
  if (!claims?.sub) return null;
  return {
    id: String(claims.sub),
    email: claims.email,
    phone: claims.phone,
    aud: claims.aud,
    role: claims.role,
    user_metadata: claims.user_metadata || {},
    app_metadata: claims.app_metadata || {},
    created_at: ""
  } as unknown as User;
});
