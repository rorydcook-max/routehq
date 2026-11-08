import { existsSync } from "node:fs";
import { join } from "node:path";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { ACTIVE_ORGANIZATION_COOKIE, loadActiveMembership } from "@/lib/auth/active-organization";
import { aliasTarget, canUseOwnDomain, canUseSubdomain, hostTarget, isAppHost, isBookingSitePath, isMarketingHost, isRenterHost, isRenterSitePath, rootDomain, siteDomain } from "@/lib/booking-address";
import { signedOutLocale, STAFF_LOCALE_COOKIE } from "@/lib/i18n/staff-locale";
import { DEFAULT_SITE_LOCALE, isSitePath, localizeSitePath, splitSiteLocale } from "@/lib/site/locale-path";
import { SITE_INTERNAL_PREFIX, siteInternalPath } from "@/lib/site/internal-path";
import { LEGAL_SLUGS } from "@/lib/site/legal-slugs";
import { CUSTOMER_LOCALE_COOKIE, pickLocale } from "@/lib/i18n/customer-locale";
import { COUNTRY_SLUGS } from "@/lib/rove/guide-slugs";
import { parseRovePath, ROVE_DEFAULT_LOCALE, ROVE_INTERNAL_PREFIX, ROVE_LOCALES, roveHasLocale, roveHref, roveInternalPath } from "@/lib/rove/paths";

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

// Help articles approved from the content queue live in the database, not in content/docs: their slugs, remembered
// for a minute, so those pages answer 200 rather than 404 (they always showed; only the status was wrong).
let publishedDocs: { slugs: Set<string>; at: number } | null = null;
async function publishedDocSlugs(): Promise<Set<string>> {
  if (publishedDocs && Date.now() - publishedDocs.at < 60_000) return publishedDocs.slugs;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  let slugs = publishedDocs?.slugs || new Set<string>();
  if (url && key) {
    try {
      const response = await fetch(`${url}/rest/v1/rpc/published_help_slugs`, {
        method: "POST",
        headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
        body: "{}"
      });
      const rows = response.ok ? await response.json() : null;
      if (Array.isArray(rows)) slugs = new Set(rows.map((row) => String(typeof row === "string" ? row : row?.published_help_slugs || "")));
    } catch {
      // Keep the last list: a slow database shouldn't turn real pages into 404s.
    }
  }
  publishedDocs = { slugs, at: Date.now() };
  return slugs;
}

const GUIDE_TOPICS = new Set(["starting", "legal", "operations", "money", "marketing"]);

/** Whether a website address names a guide, resource or guide topic that has no page (lib/site/content.ts reads the same files). */
function missingSiteContent(path: string, locale: string) {
  const topic = path.match(/^\/guides\/category\/([^/]+)$/);
  if (topic) return !GUIDE_TOPICS.has(topic[1]);
  // Legal pages: a fixed list (lib/site/legal-slugs.ts), English for every language.
  const legal = path.match(/^\/legal\/([^/]+)$/);
  if (legal) return !(LEGAL_SLUGS as readonly string[]).includes(legal[1]);
  // Help articles are written in English first; every language shows the English one until it is translated.
  const doc = path.match(/^\/docs\/([^/]+)$/);
  if (doc) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(doc[1])) return true;
    try {
      return !existsSync(join(process.cwd(), "content", "docs", "en", `${doc[1]}.md`));
    } catch {
      return false;
    }
  }
  // Switching pages: written in English first, every language shows the English one (lib/site/switch.ts).
  const switching = path.match(/^\/switch\/([^/]+)$/);
  if (switching) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(switching[1])) return true;
    try {
      return !existsSync(join(process.cwd(), "content", "switch", "en", `${switching[1]}.md`));
    } catch {
      return false;
    }
  }
  const item = path.match(/^\/(guides|resources)\/([^/]+)$/);
  if (!item) return false;
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item[2])) return true;
  try {
    return !existsSync(join(process.cwd(), "content", item[1], locale, `${item[2]}.md`));
  } catch {
    return false;
  }
}

/** The app's and website's own top-level pages: on rove.rent these still go to RoveHQ, never read as a business's name. */
const APP_TOP_LEVEL = new Set(
  "accept-invite,account,actions,amend,api,auth,book,booking-page,bookings,business-closed,calendar,customers,documents,fleet,forgot-password,help,import,inbox,inspections,invite,login,onboarding,partners,platform,receipts,rent,rental-calculator,reports,reset-password,settings,signup,subscription-required,tasks,transactions,trial-expired,contact,docs,faq,guides,home,legal,pricing,resources,switch,car-rental-software,scooter-rental-software,motorcycle-rental-software,booking-pages,manifest,icon,robots,sitemap,favicon,en,th,de,es,fr,ru,zh,ja,ko,el,it,nl,pl,hr,tr".split(",")
);

/** Under one of Rove's sections (guides, vehicles, a country) on rove.rent, optionally after a language. */
const ROVE_SECTION_MISS = new RegExp(`^/(?:[a-z]{2,3}(?:-[A-Z]{2})?/)?(?:guides|vehicles|${COUNTRY_SLUGS.join("|")})/`);

/** Search engines and link previews: never sent to a language by their Accept-Language (they index each address as it is). */
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|headless/i;

/**
 * A redirect from an English (unprefixed) address to the visitor's language (task build-rove, 8 Nov 2026): temporary
 * (307), never cached by a browser or CDN, and marked as depending on the language header and the saved choice. The
 * English page itself is the same for everyone (it's served from the cache), so it carries no Vary.
 */
function languageRedirect(url: URL) {
  const response = NextResponse.redirect(url, 307);
  response.headers.set("Vary", "Accept-Language, Cookie");
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const requestHost = request.headers.get("host");
  // Our extra domains (rovehq.app, rove.app, www.*) send people to the main one, same path.
  const alias = aliasTarget(requestHost);
  if (alias) return NextResponse.redirect(new URL(`https://${alias}${pathname}${request.nextUrl.search}`), 308);
  // Rove (rove.rent), the renter booking site: its home is the /rent search; booking links work there too;
  // anything else (the operator app, the RoveHQ website) belongs on rovehq.app.
  if (isRenterHost(requestHost)) {
    // rove.rent's own robots.txt and sitemap (the directory and every listed business), not RoveHQ's website ones.
    if (pathname === "/robots.txt" || pathname === "/sitemap.xml") {
      const url = request.nextUrl.clone();
      url.pathname = pathname === "/robots.txt" ? "/rove-robots.txt" : "/rove-sitemap.xml";
      return NextResponse.rewrite(url);
    }
    // Rove's own pages (task "roverent", 7 Nov 2026): home, search, vehicles, destinations and guides, drawn from
    // app/(rove)/rove/[locale] (lib/rove/paths.ts). They read nothing from the request, so no session is checked here.
    const rovePage = parseRovePath(pathname);
    if (rovePage && (request.method === "GET" || request.method === "HEAD")) {
      // A page not written in this language yet: its English address.
      if (!roveHasLocale(rovePage.section, rovePage.locale)) {
        const url = request.nextUrl.clone();
        url.pathname = rovePage.rest;
        return NextResponse.redirect(url);
      }
      // An English address for someone who reads another language Rove is written in: that language's address
      // (their choice on the language list, else their phone's). Search engines index each address as it is.
      if (!rovePage.prefixed) {
        const chosen = request.cookies.get(CUSTOMER_LOCALE_COOKIE)?.value;
        const wanted = !chosen && BOT.test(request.headers.get("user-agent") || "") ? ROVE_DEFAULT_LOCALE : pickLocale(chosen, request.headers.get("accept-language"));
        if (wanted !== ROVE_DEFAULT_LOCALE && roveHasLocale(rovePage.section, wanted)) {
          const url = request.nextUrl.clone();
          url.pathname = roveHref(rovePage.rest, wanted);
          return languageRedirect(url);
        }
      }
      const url = request.nextUrl.clone();
      url.pathname = roveInternalPath(rovePage);
      return NextResponse.rewrite(url);
    }
    // Under one of Rove's sections but not a page (an unknown guide, vehicle or place): Rove's "not found".
    if (ROVE_SECTION_MISS.test(pathname)) {
      const url = request.nextUrl.clone();
      // Through the vehicle page, which is drawn per visit and so reaches Rove's own not-found.tsx, in the address's
      // language (final-web test, 8 Nov 2026: guides/not-a-page isn't a listed guide, so it showed the app's page).
      const missLocale = pathname.match(/^\/([a-z]{2,3}(?:-[A-Z]{2})?)\//)?.[1];
      url.pathname = `${ROVE_INTERNAL_PREFIX}/${missLocale && ROVE_LOCALES.includes(missLocale) ? missLocale : ROVE_DEFAULT_LOCALE}/vehicles/not-a-page`;
      return NextResponse.rewrite(url, { status: 404 });
    }
    // The old search address (rove.rent/rent?place=…): the new search page, same question.
    if (pathname === "/rent") {
      const url = request.nextUrl.clone();
      url.pathname = request.nextUrl.search ? "/search" : "/";
      return NextResponse.redirect(url, 308);
    }
    // A business's booking page at its short address, rove.rent/<their-name> (Rory, 1 Nov 2026): served from
    // /rent/<their-name>. One renter domain for the search page and every business's page.
    if (/^\/[a-z0-9][a-z0-9-]{1,62}$/.test(pathname) && !isRenterSitePath(pathname) && !APP_TOP_LEVEL.has(pathname.slice(1))) {
      const url = request.nextUrl.clone();
      url.pathname = `/rent${pathname}`;
      request.headers.set("x-routehq-customer-page", "1");
      return NextResponse.rewrite(url, { request });
    }
    if (!isRenterSitePath(pathname)) {
      const appHome = String(process.env.NEXT_PUBLIC_APP_URL || `https://${rootDomain()}`).replace(/\/$/, "");
      if (!/\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(appHome)) return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, appHome));
    }
  }
  // Rove's pages live at internal addresses (/rove/<language>/…) that only the proxy serves them from.
  if (pathname === ROVE_INTERNAL_PREFIX || pathname.startsWith(`${ROVE_INTERNAL_PREFIX}/`)) {
    return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  // The website's pages live at internal addresses (/site/<language>/…, lib/site/internal-path.ts) that only this
  // proxy serves them from: asked for directly, they are not a page.
  if (pathname === SITE_INTERNAL_PREFIX || pathname.startsWith(`${SITE_INTERNAL_PREFIX}/`)) {
    return new NextResponse("Not found", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  // RoveHQ's own website: home (what a signed-out visitor sees at "/", rewritten below), plans, FAQ, contact, guides,
  // free resources and the help centre. (/owners was dropped on 28 Oct 2026.)
  // Each language has its own address (lib/site/locale-path.ts): English at the root, others under /<code>/.
  // Every website address is served from its page drawn ahead of time for that language (and, on the home and pricing
  // pages, the visitor's currency): app/(site)/site/[locale], via lib/site/internal-path.ts. Nothing about the
  // visitor is passed in headers, so Vercel serves those pages from its cache.
  const { locale: prefixLocale, rest: unprefixed } = splitSiteLocale(pathname);
  // /home (and /th/home) is the home page's internal name, not an address: one home page per language, at "/" or
  // "/<language>" (SEO, 7 Nov 2026: /home was a duplicate of "/").
  if (unprefixed === "/home" && !isRenterHost(requestHost)) {
    const url = request.nextUrl.clone();
    url.pathname = localizeSitePath("/", prefixLocale || DEFAULT_SITE_LOCALE);
    return NextResponse.redirect(url, 308);
  }
  const prefixedSite = Boolean(prefixLocale) && isSitePath(unprefixed);
  if (prefixedSite && prefixLocale === DEFAULT_SITE_LOCALE) {
    // English has no prefix: /en/pricing → /pricing, so each page has exactly one English address.
    const url = request.nextUrl.clone();
    url.pathname = unprefixed;
    return NextResponse.redirect(url, 308);
  }
  const sitePath = prefixedSite ? (unprefixed === "/" ? "/home" : unprefixed) : pathname;
  const isSitePage = sitePath !== "/" && isSitePath(sitePath);
  /** A website page's internal address, in this address's language. */
  const internalSite = (path: string, locale: string) => {
    const url = request.nextUrl.clone();
    url.pathname = siteInternalPath(path, locale, request.headers, request.nextUrl.searchParams);
    return url;
  };
  const siteRewrite = isSitePage ? internalSite(sitePath, prefixLocale || DEFAULT_SITE_LOCALE) : null;
  /** The language a visitor would like the website in: the one they picked (cookie), else their phone's (people only). */
  const preferredSiteLocale = () => {
    const chosen = request.cookies.get(STAFF_LOCALE_COOKIE)?.value;
    if (!chosen && BOT.test(request.headers.get("user-agent") || "")) return DEFAULT_SITE_LOCALE;
    return signedOutLocale(chosen, request.headers.get("accept-language"));
  };
  // An English (unprefixed) website address for someone who reads another language: that language's address instead.
  if (isSitePage && !prefixedSite && request.method === "GET" && !request.headers.get("next-action")) {
    const wanted = preferredSiteLocale();
    // Only when the page exists in that language: a guide written in English alone stays English (it was a 404).
    if (wanted !== DEFAULT_SITE_LOCALE && !missingSiteContent(pathname, wanted)) {
      const url = request.nextUrl.clone();
      url.pathname = localizeSitePath(pathname, wanted);
      return languageRedirect(url);
    }
  }
  /** "/" for someone not signed in: the website's home page, at the same address (a rewrite, not a redirect). */
  const siteHome = () => {
    const wanted = preferredSiteLocale();
    if (wanted !== DEFAULT_SITE_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = `/${wanted}`;
      return languageRedirect(url);
    }
    return NextResponse.rewrite(internalSite("/home", DEFAULT_SITE_LOCALE), { request });
  };
  // A guide, resource or topic that does not exist (in this language): the page shows "not found", and the answer
  // says 404 from the start (the app's root loading screen would otherwise have streamed a 200 already).
  let contentMissing = isSitePage && missingSiteContent(sitePath, prefixLocale || DEFAULT_SITE_LOCALE);
  const docSlug = contentMissing ? sitePath.match(/^\/docs\/([a-z0-9]+(?:-[a-z0-9]+)*)$/)?.[1] : undefined;
  if (docSlug && (await publishedDocSlugs()).has(docSlug)) contentMissing = false;
  /** Carry on to the page: a website page's internal address (see above). */
  const pass = () =>
    contentMissing
      ? NextResponse.rewrite(siteRewrite || request.nextUrl.clone(), { request, status: 404 })
      : siteRewrite
        ? NextResponse.rewrite(siteRewrite, { request })
        : NextResponse.next({ request });
  // Two domains (Rory, 31 Oct 2026): the website on rovehq.io, the platform on rovehq.app. On the website's domain
  // only website pages (and their downloads) are served, anything else goes to the platform; on the platform's
  // domain, website pages go to rovehq.io. In development (localhost) both are simply served here.
  const siteOriginUrl = String(process.env.NEXT_PUBLIC_SITE_URL || `https://${siteDomain()}`).replace(/\/$/, "");
  const appHomeUrl = String(process.env.NEXT_PUBLIC_APP_URL || `https://${rootDomain()}`).replace(/\/$/, "");
  const isLocalUrl = (url: string) => /\/\/(localhost|127\.0\.0\.1|[^/:]+\.localhost)(:|\/|$)/.test(url);
  const websiteHome = prefixedSite && unprefixed === "/";
  if (isMarketingHost(requestHost)) {
    const websitePath = pathname === "/" || isSitePage || websiteHome || pathname === "/robots.txt" || pathname === "/sitemap.xml" || pathname.startsWith("/api/download/");
    if (!websitePath && !isLocalUrl(appHomeUrl)) return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, appHomeUrl));
    // The website needs no session: "/" is always the home page here, signed in or not.
    if (pathname === "/") return siteHome();
    if (websitePath) return pass();
  } else if (isAppHost(requestHost) && !isLocalUrl(siteOriginUrl) && (isSitePage || websiteHome)) {
    return NextResponse.redirect(new URL(`${pathname}${request.nextUrl.search}`, siteOriginUrl), 308);
  }
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
    // Calendar apps subscribing to a business's booking feed (a secret token in the address), and the RoveHQ Telegram bot.
    pathname.startsWith("/api/calendar/") ||
    pathname === "/api/telegram/webhook" ||
    // Stripe events for RoveHQ's plans; the route checks Stripe's signature itself.
    pathname.startsWith("/api/stripe/webhook/") ||
    // rove.rent's vehicle photos (listed vehicles only; the route checks) and its share pictures.
    pathname.startsWith("/api/rove-photo/") ||
    pathname === "/api/rove-og";
  // Customer pages take their language from the customer (their choice, or their phone's language), never from whoever is signed in.
  if (pathname.startsWith("/book/") || pathname.startsWith("/amend/") || pathname === "/rent" || pathname.startsWith("/rent/")) {
    request.headers.set("x-routehq-customer-page", "1");
    // The booking box on a business's own site can say which language to open in (data-lang); a choice the customer
    // makes on the page still wins.
    const pageLang = request.nextUrl.searchParams.get("lang");
    if (pageLang && /^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(pageLang)) request.headers.set("x-routehq-page-lang", pageLang);
  }
  // During first-time setup the wizard sends people to the normal Add vehicle and import screens; everything else waits until setup is finished.
  // "This business was closed" is shown to members of a business RoveHQ closed, so it needs no working business.
  const isOnboardingAllowedRoute = isPublicRoute || pathname === "/business-closed" || pathname.startsWith("/api/") || pathname.startsWith("/fleet/import") || pathname === "/fleet/new" || pathname === "/help" || pathname.startsWith("/help/");
  const isSubscriptionAllowedRoute =
    isOnboardingAllowedRoute ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/billing") ||
    pathname === "/trial-expired" ||
    pathname === "/subscription-required";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Booking addresses: theirshop.rovehq.app and a business's own domain open that business's booking page.
  // Booking links and the booking page keep working there; anything else goes to RoveHQ itself.
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
      // On a plan without the address, the page still works at its RoveHQ address.
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

  // Checked on this server against the sign-in service's published key, not with a trip to it on every page and every
  // link the app loads ahead (Rory, 2 Nov 2026: moving between pages felt slow). An expired session is still refreshed.
  const { data: claimsData } = await supabase.auth.getClaims();
  const user = claimsData?.claims?.sub ? { id: String(claimsData.claims.sub) } : null;

  // Signed out at "/": the website (on rovehq.app, a visit to rovehq.io's home). Signed in: the dashboard, as always.
  if (!user && pathname === "/" && isAppHost(requestHost) && !isLocalUrl(siteOriginUrl)) {
    return NextResponse.redirect(new URL("/", siteOriginUrl));
  }
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
  // RoveHQ support, viewing a business that asked "set it up for you", brings records in with the same importer (2 Nov 2026).
  const importPath = pathname === "/import" || pathname.startsWith("/fleet/import");
  if (user && importPath) {
    const { data: membership } = await loadActiveMembership(supabase, user.id, request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value || null);
    const { data: platformAdmin } = membership && membership.role !== "owner" ? await (supabase as any).rpc("is_platform_admin") : { data: null };
    if (membership && membership.role !== "owner" && !platformAdmin) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "?notice=owner-only";
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Passed every check below a moment ago (set up, paid up, which business, what role): trust that for a few minutes
  // instead of asking the database twice more on every page and every link loaded ahead.
  const activeOrgCookie = request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value || "";
  const gateRole = user && !isOnboardingAllowedRoute ? await readGate(request.cookies.get(GATE_COOKIE)?.value, user.id, activeOrgCookie) : null;
  if (user && gateRole) {
    if (isOwnerOnlyPath(pathname) && gateRole !== "owner" && !importPath) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.search = "?notice=owner-only";
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  if (user && !isOnboardingAllowedRoute) {
    const { data: membership, closed } = await loadActiveMembership(
      supabase,
      user.id,
      request.cookies.get(ACTIVE_ORGANIZATION_COOKIE)?.value || null
    );

    // Their only business was closed by RoveHQ: say so plainly rather than offering to set up a new one.
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
    if (isOwnerOnlyPath(pathname) && membership.role !== "owner" && !importPath) {
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

      // All clear: remembered for a few minutes (see readGate).
      // Only when the payment checks actually ran (pages like the subscription screen skip them).
      if (organization && membership.role && !isSubscriptionAllowedRoute) {
        response.cookies.set(GATE_COOKIE, await writeGate(user.id, activeOrgCookie, String(membership.role)), {
          httpOnly: true,
          sameSite: "lax",
          secure: request.nextUrl.protocol === "https:",
          path: "/",
          maxAge: GATE_SECONDS
        });
      }
    }
  }

  return response;
}

// ── The few-minutes pass (Rory, 2 Nov 2026: pages felt slow) ───────────────────────────────────────────────────
// A signed note of who passed the checks, for which business and with what role. Signed with a server-only secret,
// so it can't be made up or edited; tied to the person and the business chosen, so signing out or switching business ends it.
const GATE_COOKIE = "rhq_gate";
const GATE_SECONDS = 300;

/** Settings (and the Booking page tool that came out of it), the team, reports and bringing in a fleet from a file are the owner's. */
function isOwnerOnlyPath(pathname: string) {
  return (
    pathname === "/booking-page" ||
    pathname === "/settings" ||
    pathname.startsWith("/settings/") ||
    pathname === "/invite" ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname === "/rental-calculator" ||
    pathname === "/import" ||
    pathname.startsWith("/fleet/import")
  );
}

async function gateSignature(payload: string) {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!secret) return "";
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signed = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)));
  return Array.from(signed, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function writeGate(userId: string, organizationCookie: string, role: string) {
  const payload = [userId, organizationCookie, role, Math.floor(Date.now() / 1000) + GATE_SECONDS].join("|");
  return `${Buffer.from(payload).toString("base64url")}.${await gateSignature(payload)}`;
}

/** The role, when the note is genuine, still fresh and for this person and business; otherwise null and the full checks run. */
async function readGate(value: string | undefined, userId: string, organizationCookie: string) {
  if (!value) return null;
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) return null;
  let payload = "";
  try {
    payload = Buffer.from(encoded, "base64url").toString();
  } catch {
    return null;
  }
  const expected = await gateSignature(payload);
  if (!expected || expected !== signature) return null;
  const [gateUser, gateOrganization, role, expires] = payload.split("|");
  if (gateUser !== userId || gateOrganization !== organizationCookie || !role || Number(expires) < Date.now() / 1000) return null;
  return role;
}

// _vercel/: Vercel's own endpoints (Speed Insights' script and reports, task perf2), never a page to send elsewhere.
// avif: rove.rent's destination photos have AVIF copies (public/rove/destinations, task perf2), served as files like the WebP ones.
// css: the booking-page font stylesheets (public/fonts/sites/<pairing>.css, task perf2), which signed-out renters load too.
export const config = {
  matcher: ["/((?!_next/static|_next/image|_vercel/|favicon.ico|sw\\.js|embed\\.js|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|css|ico|woff2?|ttf|otf)$).*)"]
};
