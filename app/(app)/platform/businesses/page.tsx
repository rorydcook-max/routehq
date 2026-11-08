import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ADMIN_STATUS_LABEL, ADMIN_TIER_LABEL, adminDate, daysFromNow, listBusinesses, requirePlatformAdmin } from "@/lib/admin";
import { ADMIN_SEGMENTS, segmentsOf, type AdminSegment } from "@/lib/admin-segments";
import { AdminHeader } from "../admin-nav";
import { BusinessesTable, type BusinessRow } from "./businesses-table";

export const dynamic = "force-dynamic";

type Query = { q?: string; plan?: string; status?: string; soon?: string; deleted?: string; seg?: string; tag?: string; page?: string };

const PAGE_SIZE = 100;

/**
 * Every business on RoveHQ: search by name or owner email, filter by plan, status, automatic segment or manual tag,
 * and act on many at once (Rory, 7 Nov 2026: tick rows, then tag, change plan, extend trial, export or delete).
 * Platform admins only.
 */
export default async function AdminBusinessesPage({ searchParams }: { searchParams: Promise<Query> }) {
  await requirePlatformAdmin();
  const [query, userEmail, all] = await Promise.all([searchParams, getCurrentUserEmail(), listBusinesses()]);
  const q = (query.q || "").trim().toLowerCase();
  // "soon" is the old "Trial ends within 7 days" tick box; it is the trial_7 segment now.
  const segment = (ADMIN_SEGMENTS.some((item) => item.key === query.seg) ? query.seg : query.soon ? "trial_7" : "") as AdminSegment | "";
  const tag = (query.tag || "").trim().toLowerCase();
  const visible = all.filter((b) => query.deleted || !b.deletedAt);
  const withSegments = visible.map((b) => ({ business: b, segments: segmentsOf(b) }));
  const rows = withSegments.filter(({ business: b, segments }) => {
    if (q && !`${b.name} ${b.owners.map((o) => o.email).join(" ")} ${b.tags.join(" ")}`.toLowerCase().includes(q)) return false;
    if (query.plan && (b.tier === "growth" ? "pro" : b.tier) !== query.plan) return false;
    if (query.status && b.status !== query.status) return false;
    if (segment && !segments.includes(segment)) return false;
    if (tag && !b.tags.includes(tag)) return false;
    return true;
  });
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number(query.page) || 1));
  const shown = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allTags = Array.from(new Set(visible.flatMap(({ tags }) => tags))).sort((a, b) => a.localeCompare(b));
  const segmentCount = new Map<string, number>();
  for (const { segments } of withSegments) for (const key of segments) segmentCount.set(key, (segmentCount.get(key) || 0) + 1);

  // Links that keep the other filters and change one.
  const href = (change: Partial<Query>) => {
    const params = new URLSearchParams();
    const next: Query = { q: query.q, plan: query.plan, status: query.status, deleted: query.deleted, seg: segment || undefined, tag: tag || undefined, ...change };
    for (const [key, value] of Object.entries(next)) if (value) params.set(key, String(value));
    const text = params.toString();
    return `/platform/businesses${text ? `?${text}` : ""}` as Route;
  };
  const chip = (on: boolean) =>
    `inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3 text-[14px] font-semibold transition ${on ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)] hover:border-[var(--primary)]"}`;

  const tableRows: BusinessRow[] = shown.map(({ business: b, segments }) => {
    const left = daysFromNow(b.trialEndsAt);
    return {
      id: b.id,
      name: b.name,
      ownerEmail: b.owners[0]?.email || null,
      country: b.country,
      plan: ADMIN_TIER_LABEL[b.tier] || b.tier,
      custom: Boolean(b.customLimits || b.customPrice !== null),
      wants: b.pendingPlan ? ADMIN_TIER_LABEL[b.pendingPlan] || b.pendingPlan : null,
      status: b.status,
      trialOrNext: b.status === "trial" ? `${adminDate(b.trialEndsAt)}${left !== null ? ` · ${left < 0 ? "ended" : `${left} days`}` : ""}` : adminDate(b.nextPaymentDue),
      trialSoon: b.status === "trial" && left !== null && left <= 7,
      vehicles: b.vehicles,
      lastActive: adminDate(b.lastActive),
      joined: adminDate(b.createdAt),
      deleted: Boolean(b.deletedAt),
      tags: b.tags,
      segments
    };
  });

  return (
    <AppShell userEmail={userEmail}>
      <AdminHeader active="/platform/businesses" subtitle={`${all.filter((b) => !b.deletedAt).length} businesses`} title="Businesses" />

      <form className="card mb-3 grid gap-2 p-3 md:grid-cols-[minmax(0,1fr)_170px_170px_auto] md:items-center" method="get">
        <input aria-label="Search" className="w-full" defaultValue={query.q || ""} name="q" placeholder="Business name, owner email or tag" type="search" />
        <select aria-label="Plan" defaultValue={query.plan || ""} name="plan">
          <option value="">Any plan</option>
          {["business", "free", "pro", "starter"].map((tier) => (
            <option key={tier} value={tier}>
              {ADMIN_TIER_LABEL[tier]}
            </option>
          ))}
        </select>
        <select aria-label="Status" defaultValue={query.status || ""} name="status">
          <option value="">Any status</option>
          {Object.entries(ADMIN_STATUS_LABEL)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
        </select>
        {segment ? <input name="seg" type="hidden" value={segment} /> : null}
        {tag ? <input name="tag" type="hidden" value={tag} /> : null}
        <button className="primary-action pressable" type="submit">
          Search
        </button>
      </form>

      {/* Automatic segments, then the team's own tags: one tap filters, a second tap clears. */}
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="me-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Segments</span>
          {ADMIN_SEGMENTS.map((item) => (
            <Link className={chip(segment === item.key)} href={href({ seg: segment === item.key ? undefined : item.key, page: undefined })} key={item.key}>
              {item.label}
              <span className={segment === item.key ? "text-white/80" : "text-[var(--muted)]"}>{segmentCount.get(item.key) || 0}</span>
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="me-1 text-[13px] font-bold uppercase tracking-[0.06em] text-[var(--muted)]">Tags</span>
          {allTags.length ? (
            allTags.map((item) => (
              <Link className={chip(tag === item)} href={href({ tag: tag === item ? undefined : item, page: undefined })} key={item}>
                #{item}
              </Link>
            ))
          ) : (
            <span className="text-[14px] font-medium text-[var(--muted)]">None yet. Tick businesses and choose Add tag.</span>
          )}
          {segment || tag ? (
            <Link className="ms-1 text-[14px] font-semibold text-[var(--primary)] hover:underline" href={href({ seg: undefined, tag: undefined, page: undefined })}>
              Clear
            </Link>
          ) : null}
        </div>
      </div>

      <BusinessesTable allMatchingIds={rows.map(({ business }) => business.id)} existingTags={allTags} rows={tableRows} statusLabels={ADMIN_STATUS_LABEL} />

      {pages > 1 ? (
        <nav aria-label="Pages" className="mt-4 flex items-center justify-center gap-3 text-[15px] font-semibold">
          {page > 1 ? <Link className="secondary-action pressable" href={href({ page: String(page - 1) })}>Previous</Link> : null}
          <span className="text-[var(--muted)]">
            Page {page} of {pages} · {rows.length} businesses
          </span>
          {page < pages ? <Link className="secondary-action pressable" href={href({ page: String(page + 1) })}>Next</Link> : null}
        </nav>
      ) : null}
    </AppShell>
  );
}
