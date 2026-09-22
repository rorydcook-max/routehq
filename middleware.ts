import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_ORGANIZATION_COOKIE, loadActiveMembership } from "@/lib/auth/active-organization";

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isPublicRoute =
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/onboarding" ||
    pathname === "/accept-invite" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/book" ||
    pathname.startsWith("/book/") ||
    pathname.startsWith("/auth/callback") ||
    pathname === "/api/line/webhook";
  const isOnboardingAllowedRoute = isPublicRoute || pathname.startsWith("/api/") || pathname.startsWith("/fleet/import");
  const isSubscriptionAllowedRoute =
    isOnboardingAllowedRoute ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/billing") ||
    pathname === "/trial-expired" ||
    pathname === "/subscription-required";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    if (isPublicRoute) {
      return NextResponse.next({ request });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    redirectUrl.searchParams.set("reason", "missing-supabase-env");
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options: Record<string, unknown> }>) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user && !isPublicRoute) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (user && !isOnboardingAllowedRoute) {
    const { data: membership } = await loadActiveMembership(
      supabase,
      user.id,
      request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value || null
    );

    // A signed-in user with no organisation has nothing behind the dashboard:
    // send them to set one up rather than letting pages fall back to a default.
    if (!membership?.organization_id) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/onboarding";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

    // Business settings and team management are owner-only. The server actions
    // enforce this too; this just keeps teammates off pages they cannot use.
    const isOwnerOnlyRoute = pathname === "/settings" || pathname.startsWith("/settings/") || pathname === "/invite";
    if (isOwnerOnlyRoute && membership.role !== "owner") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "?notice=owner-only";
      return NextResponse.redirect(redirectUrl);
    }

    if (membership?.organization_id) {
      const { data: organization } = await (supabase as any)
        .from("organizations")
        .select("onboarding_completed, onboarding_skipped, subscription_status, trial_ends_at, next_payment_due")
        .eq("id", membership.organization_id)
        .is("deleted_at", null)
        .maybeSingle();

      if (organization && !organization.onboarding_completed && !organization.onboarding_skipped) {
        const redirectUrl = request.nextUrl.clone();
        redirectUrl.pathname = "/onboarding";
        redirectUrl.searchParams.set("next", pathname);
        return NextResponse.redirect(redirectUrl);
      }

      if (organization && !isSubscriptionAllowedRoute) {
        const now = Date.now();
        const status = organization.subscription_status || "trial";
        const trialEndsAt = organization.trial_ends_at ? new Date(organization.trial_ends_at).getTime() : null;
        const nextPaymentDue = organization.next_payment_due ? new Date(organization.next_payment_due).getTime() : null;

        if (status === "trial" && trialEndsAt && trialEndsAt <= now) {
          return NextResponse.redirect(new URL("/trial-expired", request.url));
        }

        if (status === "past_due" && nextPaymentDue && now > nextPaymentDue + 7 * 24 * 60 * 60 * 1000) {
          return NextResponse.redirect(new URL("/subscription-required", request.url));
        }

        if (["cancelled", "expired", "paused"].includes(status)) {
          return NextResponse.redirect(new URL("/subscription-required", request.url));
        }
      }
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"]
};
