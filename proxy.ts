import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_ORGANIZATION_COOKIE, loadActiveMembership } from "@/lib/auth/active-organization";
import { canUseOwnDomain, canUseSubdomain, hostTarget, isBookingSitePath, rootDomain } from "@/lib/booking-address";

type BookingSite = { slug: string; tier: string | null; status: string | null; has_domain: boolean };
// Which business an address belongs to, remembered for a minute so each page view doesn't ask the database.
const siteCache = new Map<string, { site: BookingSite | null; at: number }>();

async function resolveBookingSite(target: { label: string } | { host: string }, url: string, key: string): Promise<BookingSite | null> {
  const cacheKey = "label" in target ? `label:${target.label}` : `host:${target.host}`;
  const cached = siteCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 60_000) return cached.site;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/resolve_booking_host`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_label: "label" in target ? target.label : null, p_host: "host" in target ? target.host : null })
    });
    const rows = response.ok ? await response.json() : [];
    const row = Array.isArray(rows) ? rows[0] : null;
    const site: BookingSite | null = row?.slug ? { slug: row.slug, tier: row.tier, status: row.status, has_domain: Boolean(row.has_domain) } : null;
    siteCache.set(cacheKey, { site, at: Date.now() });
    return site;
  } catch {
    return null;
  }
}

export async function proxy(request: NextRequest) {
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
    pathname.startsWith("/amend/") ||
    // The directory of every listed business, and each business's public booking page.
    pathname === "/rent" ||
    pathname.startsWith("/rent/") ||
    pathname.startsWith("/auth/") ||
    pathname === "/api/line/webhook" ||
    // Customer messages arriving from each business's own LINE / Telegram account.
    pathname.startsWith("/api/inbox/") ||
    // Scheduled jobs have no user session; they check CRON_SECRET themselves.
    pathname.startsWith("/api/cron/") ||
    pathname === "/api/line/daily-summary" ||
    // Calendar apps subscribing to a business's booking feed (a secret token in the address), and the RouteHQ Telegram bot.
    pathname.startsWith("/api/calendar/") ||
    pathname === "/api/telegram/webhook";
  // Customer pages take their language from the customer (their choice, or their phone's language), never from whoever is signed in.
  if (pathname.startsWith("/book/") || pathname.startsWith("/amend/") || pathname === "/rent" || pathname.startsWith("/rent/")) {
    request.headers.set("x-routehq-customer-page", "1");
    // The booking box on a business's own site can say which language to open in (data-lang); a choice the customer
    // makes on the page still wins.
    const pageLang = request.nextUrl.searchParams.get("lang");
    if (pageLang && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(pageLang)) request.headers.set("x-routehq-page-lang", pageLang);
  }
  // During first-time setup the wizard sends people to the normal Add vehicle and import screens; everything else waits until setup is finished.
  const isOnboardingAllowedRoute = isPublicRoute || pathname.startsWith("/api/") || pathname.startsWith("/fleet/import") || pathname === "/fleet/new" || pathname === "/help" || pathname.startsWith("/help/");
  const isSubscriptionAllowedRoute =
    isOnboardingAllowedRoute ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/billing") ||
    pathname === "/trial-expired" ||
    pathname === "/subscription-required";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Booking addresses: theirshop.routehq.app and a business's own domain open that business's booking page.
  // Booking links and the booking page keep working there; anything else goes to RouteHQ itself.
  const target = hostTarget(request.headers.get("host"));
  if (target && supabaseUrl && supabaseAnonKey) {
    const appHome = String(process.env.NEXT_PUBLIC_APP_URL || `https://${rootDomain()}`).replace(/\/$/, "");
    const site = await resolveBookingSite(target, supabaseUrl, supabaseAnonKey);
    // In development the app itself is on localhost, and Next.js turns a redirect to localhost into one back to the
    // address being visited (a loop), so there those requests are simply served here instead.
    const appOnLocalhost = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appHome);
    const toApp = () => (appOnLocalhost ? null : NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, appHome)));
    if (!site) {
      const away = toApp();
      if (away) return away;
    } else {
      const plan = { subscription_tier: site.tier, subscription_status: site.status };
      const allowed = "label" in target ? canUseSubdomain(plan) : site.has_domain && canUseOwnDomain(plan);
      // On a plan without the address, the page still works at its RouteHQ address.
      if (!allowed) {
        const destination = `${pathname === "/" ? `/rent/${site.slug}` : pathname}${request.nextUrl.search}`;
        if (!appOnLocalhost) return NextResponse.redirect(new URL(destination, appHome));
        if (pathname === "/") return NextResponse.redirect(new URL(destination, request.url));
      } else if (!isBookingSitePath(pathname)) {
        const away = toApp();
        if (away) return away;
      } else if (pathname === "/") {
        const url = request.nextUrl.clone();
        url.pathname = `/rent/${site.slug}`;
        request.headers.set("x-routehq-customer-page", "1");
        return NextResponse.rewrite(url, { request });
      }
    }
  }

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

  // The importer is open during first-time setup (so the checks below are skipped for it), but it stays the owner's.
  if (user && (pathname === "/import" || pathname.startsWith("/fleet/import"))) {
    const { data: membership } = await loadActiveMembership(supabase, user.id, request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value || null);
    if (membership && membership.role !== "owner") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "?notice=owner-only";
      return NextResponse.redirect(redirectUrl);
    }
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
    // A teammate runs the day: bookings, vehicles, customers, payments. How the business is doing (reports, what a
    // vehicle would earn) and bringing in a whole fleet from a file are the owner's.
    const isOwnerOnlyRoute =
      pathname === "/settings" ||
      pathname.startsWith("/settings/") ||
      pathname === "/invite" ||
      pathname === "/reports" ||
      pathname.startsWith("/reports/") ||
      pathname === "/rental-calculator" ||
      pathname === "/import" ||
      pathname.startsWith("/fleet/import");
    if (isOwnerOnlyRoute && membership.role !== "owner") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "?notice=owner-only";
      return NextResponse.redirect(redirectUrl);
    }

    if (membership?.organization_id) {
      const { data: organization } = await (supabase as any)
        .from("organizations")
        .select("onboarding_completed, onboarding_skipped, subscription_status, subscription_tier, trial_ends_at, next_payment_due")
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

        // A business that chose Free during its trial simply carries on, on Free, when the trial ends.
        if (status === "trial" && trialEndsAt && trialEndsAt <= now && organization.subscription_tier !== "free") {
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw\\.js|embed\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)$).*)"]
};
