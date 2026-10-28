import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_ORGANIZATION_COOKIE, loadActiveMembership } from "@/lib/auth/active-organization";
import { aliasTarget, canUseOwnDomain, canUseSubdomain, hostTarget, isBookingSitePath, isRenterHost, isRenterSitePath, rootDomain } from "@/lib/booking-address";
import { signedOutLocale, STAFF_LOCALE_COOKIE } from "@/lib/i18n/staff-locale";
import { DEFAULT_SITE_LOCALE, isSitePath, localizeSitePath, SITE_LOCALE_HEADER, splitSiteLocale } from "@/lib/site/locale-path";

// custom_limits: an admin-set custom plan (returned by resolve_booking_host_v2, migration 0108).
type BookingSite = { slug: string; tier: string | null; status: string | null; has_domain: boolean; custom_limits: unknown };
// Which business an address belongs to, remembered for a minute so each page view doesn't ask the database.
const siteCache = new Map<string, { site: BookingSite | null; at: number }>();

async function resolveBookingSite(target: { label: string } | { host: string }, url: string, key: string): Promise<BookingSite | null> {
  const cacheKey = "label" in target ? `label:${target.label}` : `host:${target.host}`;
  const cached = siteCache.get(cacheKey);
  if (cached && Date.now() - cached.at < 60_000) return cached.site;
  try {
    const response = await fetch(`${url}/rest/v1/rpc/resolve_booking_host_v2`, {
      method: "POST",
      headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({ p_label: "label" in target ? target.label : null, p_host: "host" in target ? target.host : null })
    });
    const rows = response.ok ? await response.json() : [];
    const row = Array.isArray(rows) ? rows[0] : null;
    const site: BookingSite | null = row?.slug ? { slug: row.slug, tier: row.tier, status: row.status, has_domain: Boolean(row.has_domain), custom_limits: row.custom_limits ?? null } : null;
    siteCache.set(cacheKey, { site, at: Date.now() });
    return site;
  } catch {
    return null;
  }
}

const GUIDE_TOPICS = new Set(["starting", "legal", "operations", "money", "marketing"]);

/** Whether a website address names a guide, resource or guide topic that has no page (lib/site/content.ts reads the same files). */
function missingSiteContent(path: string, locale: string) {
  const topic = path.match(/^\/guides\/category\/([^/]+)$/);
  if (topic) return !GUIDE_TOPICS.has(topic[1]);
  const item = path.match(/^\/(guides|resources)\/([^/]+)$/);
  if (!item) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item[2])) return true;
  try {
    return !existsSync(join(process.cwd(), "content", item[1], locale, `${item[2]}.md`));
  } catch {
    return false;
  }
}

/** Search engines and link previews: never sent to a language by their Accept-Language (they index each address as it is). */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHost = request.headers.get("host");
  // Our extra domains (lokalfleet.app, lokalkeys.app, www.*) send people to the main one, same path.
  const alias = aliasTarget(requestHost);
  if (alias) return NextResponse.redirect(new URL(`https://${alias}${pathname}${request.nextUrl.search}`), 308);
  // Lokalkeys (lokalkeys.com), the renter booking site: its home is the /rent search; booking links work there too;
  // anything else (the operator app, the Lokalfleet website) belongs on lokalfleet.com.
  if (isRenterHost(requestHost)) {
    if (!isRenterSitePath(pathname)) {
      const appHome = String(process.env.NEXT_PUBLIC_APP_URL || `https://${rootDomain()}`).replace(/\/$/, "");
      if (!/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appHome)) return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, appHome));
    }
    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = "/rent";
      request.headers.set("x-routehq-customer-page", "1");
      return NextResponse.rewrite(url, { request });
    }
  }
  // Lokalfleet's own website: home (what a signed-out visitor sees at "/", rewritten below), plans, FAQ, contact, guides and
  // free resources. Marked so the root layout sends them no staff-app words. (/owners was dropped on 28 Oct 2026.)
  // Each language has its own address (lib/site/locale-path.ts): English at the root, others under /<code>/.
  // A prefixed address is served from the unprefixed page with the language in a request header.
  const { locale: prefixLocale, rest: unprefixed } = splitSiteLocale(pathname);
  const prefixedSite = Boolean(prefixLocale) && isSitePath(unprefixed);
  if (prefixedSite && prefixLocale === DEFAULT_SITE_LOCALE) {
    // English has no prefix: /en/pricing → /pricing, so each page has exactly one English address.
    const url = request.nextUrl.clone();
    url.pathname = unprefixed;
    return NextResponse.redirect(url, 308);
  }
  const sitePath = prefixedSite ? (unprefixed === "/" ? "/home" : unprefixed) : pathname;
  const isSitePage = sitePath !== "/" && isSitePath(sitePath);
  // Rewritten to the unprefixed page when the address carried a language.
  const siteRewrite = prefixedSite ? (() => { const url = request.nextUrl.clone(); url.pathname = sitePath; return url; })() : null;
  if (isSitePage) {
    request.headers.set("x-routehq-site-page", "1");
    request.headers.set(SITE_LOCALE_HEADER, prefixLocale || DEFAULT_SITE_LOCALE);
  }
  /** The language a visitor would like the website in: the one they picked (cookie), else their phone's (people only). */
  const preferredSiteLocale = () => {
    const chosen = request.cookies.get(STAFF_LOCALE_COOKIE)?.value;
    if (!chosen && BOT.test(request.headers.get("user-agent") || "")) return DEFAULT_SITE_LOCALE;
    return signedOutLocale(chosen, request.headers.get("accept-language"));
  };
  // An English (unprefixed) website address for someone who reads another language: that language's address instead.
  if (isSitePage && !prefixedSite && request.method === "GET" && !request.headers.get("next-action")) {
    const wanted = preferredSiteLocale();
    if (wanted !== DEFAULT_SITE_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = localizeSitePath(pathname, wanted);
      return NextResponse.redirect(url);
    }
  }
  /** "/" for someone not signed in: the website's home page, at the same address (a rewrite, not a redirect). */
  const siteHome = () => {
    const wanted = preferredSiteLocale();
    if (wanted !== DEFAULT_SITE_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = `/${wanted}`;
      return NextResponse.redirect(url);
    }
    const url = request.nextUrl.clone();
    url.pathname = "/home";
    request.headers.set("x-routehq-site-page", "1");
    request.headers.set(SITE_LOCALE_HEADER, DEFAULT_SITE_LOCALE);
    return NextResponse.rewrite(url, { request });
  };
  // A guide, resource or topic that does not exist (in this language): the page shows "not found", and the answer
  // says 404 from the start (the app's root loading screen would otherwise have streamed a 200 already).
  const contentMissing = isSitePage && missingSiteContent(sitePath, prefixLocale || DEFAULT_SITE_LOCALE);
  /** Carry on to the page: the unprefixed page when the address carried a language. */
  const pass = () =>
    contentMissing
      ? NextResponse.rewrite(siteRewrite || request.nextUrl.clone(), { request, status: 404 })
      : siteRewrite
        ? NextResponse.rewrite(siteRewrite, { request })
        : NextResponse.next({ request });
  const isPublicRoute =
    isSitePage ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    // Free resources, behind a signed link (app/api/download/[slug]/route.ts checks it).
    pathname.startsWith("/api/download/") ||
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
    // Calendar apps subscribing to a business's booking feed (a secret token in the address), and the Lokalfleet Telegram bot.
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
  // "This business was closed" is shown to members of a business Lokalfleet closed, so it needs no working business.
  const isOnboardingAllowedRoute = isPublicRoute || pathname === "/business-closed" || pathname.startsWith("/api/") || pathname.startsWith("/fleet/import") || pathname === "/fleet/new" || pathname === "/help" || pathname.startsWith("/help/");
  const isSubscriptionAllowedRoute =
    isOnboardingAllowedRoute ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/billing") ||
    pathname === "/trial-expired" ||
    pathname === "/subscription-required";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Booking addresses: theirshop.lokalfleet.com and a business's own domain open that business's booking page.
  // Booking links and the booking page keep working there; anything else goes to Lokalfleet itself.
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
      const plan = { subscription_tier: site.tier, subscription_status: site.status, custom_limits: site.custom_limits };
      const allowed = "label" in target ? canUseSubdomain(plan) : site.has_domain && canUseOwnDomain(plan);
      // On a plan without the address, the page still works at its Lokalfleet address.
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
    if (pathname === "/") return siteHome();
    if (isPublicRoute) {
      return pass();
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("next", pathname);
    redirectUrl.searchParams.set("reason", "missing-supabase-env");
    return NextResponse.redirect(redirectUrl);
  }

  let response = pass();
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
          response = pass();
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        }
      }
    }
  );

  const {
    data: { user }
  } = await supabase.auth.getUser();

  // Signed out at "/": the website. Signed in: the dashboard, as always.
  if (!user && pathname === "/") {
    const rewrite = siteHome();
    // Keep any session cookie the check above refreshed or cleared.
    response.cookies.getAll().forEach((cookie) => rewrite.cookies.set(cookie));
    return rewrite;
  }

  // Signed in, a language's home page (/th): the dashboard, as "/" is for them.
  if (user && prefixedSite && unprefixed === "/") {
    return NextResponse.redirect(new URL("/", request.url));
  }

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
    const { data: membership, closed } = await loadActiveMembership(
      supabase,
      user.id,
      request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value || null
    );

    // Their only business was closed by Lokalfleet: say so plainly rather than offering to set up a new one.
    if (!membership?.organization_id && closed) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/business-closed";
      redirectUrl.search = "";
      return NextResponse.redirect(redirectUrl);
    }

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
