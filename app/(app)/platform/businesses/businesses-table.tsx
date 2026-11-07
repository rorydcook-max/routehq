"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { adminBulkBusinesses, type BulkInput } from "@/app/actions/admin-bulk";
import { ADMIN_SEGMENTS } from "@/lib/admin-segments";

export type BusinessRow = {
  id: string;
  name: string;
  ownerEmail: string | null;
  country: string | null;
  plan: string;
  custom: boolean;
  wants: string | null;
  status: string;
  trialOrNext: string;
  trialSoon: boolean;
  vehicles: number;
  lastActive: string;
  joined: string;
  deleted: boolean;
  tags: string[];
  segments: string[];
};

const TONE: Record<string, string> = {
  active: "bg-[var(--success-light)] text-[var(--success)]",
  trial: "bg-[var(--info-light)] text-[var(--info)]",
  past_due: "bg-[var(--warning-light)] text-[var(--warning)]",
  expired: "bg-[var(--panel-tertiary)] text-[var(--muted)]",
  cancelled: "bg-[var(--danger-light)] text-[var(--danger)]"
};
const SEGMENT_LABEL = Object.fromEntries(ADMIN_SEGMENTS.map((item) => [item.key, item.label])) as Record<string, string>;
// Plan segments repeat the Plan column, so the row shows only the others.
const ROW_SEGMENTS = new Set(["trial_7", "no_vehicles", "inactive_14"]);
const PLANS = [
  { value: "business", label: "Business" },
  { value: "free", label: "Free" },
  { value: "pro", label: "Pro" },
  { value: "starter", label: "Starter" }
];

type Panel = "tag_add" | "tag_remove" | "plan" | "trial" | "delete" | null;

const plural = (count: number) => `${count} ${count === 1 ? "business" : "businesses"}`;

/**
 * The businesses table with row tick boxes, "select all" (this page, then every business that matches the filters)
 * and a bar of bulk actions that appears once something is ticked.
 */
export function BusinessesTable({ rows, allMatchingIds, existingTags, statusLabels }: { rows: BusinessRow[]; allMatchingIds: string[]; existingTags: string[]; statusLabels: Record<string, string> }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [panel, setPanel] = useState<Panel>(null);
  const [tag, setTag] = useState("");
  const [tier, setTier] = useState("starter");
  const [status, setStatus] = useState("");
  const [days, setDays] = useState("14");
  const [confirm, setConfirm] = useState("");
  const [includePaid, setIncludePaid] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [pending, start] = useTransition();
  const head = useRef<HTMLInputElement>(null);

  const pageIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const someOnPage = pageIds.some((id) => selected.has(id));
  const count = selected.size;
  const phrase = `Delete ${plural(count)}`;

  useEffect(() => {
    if (head.current) head.current.indeterminate = someOnPage && !allOnPage;
  }, [someOnPage, allOnPage]);

  // New filters: what was ticked may no longer be listed, so start again.
  useEffect(() => {
    setSelected(new Set());
    setPanel(null);
  }, [allMatchingIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  function run(input: BulkInput) {
    setResult(null);
    start(async () => {
      const outcome = await adminBulkBusinesses(input).catch(() => ({ ok: false, message: "Something went wrong. Please try again." }) as { ok: boolean; message: string; csv?: string });
      if ("csv" in outcome && outcome.csv) {
        const blob = new Blob([`﻿${outcome.csv}`], { type: "text/csv;charset=utf-8" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = `rovehq-businesses-${new Date().toISOString().slice(0, 10)}.csv`;
        link.click();
        URL.revokeObjectURL(link.href);
      }
      setResult({ ok: outcome.ok, message: outcome.message });
      if (outcome.ok && input.action !== "export") {
        setPanel(null);
        setConfirm("");
        if (input.action === "delete") setSelected(new Set());
      }
      router.refresh();
    });
  }

  const ids = [...selected];
  const barButton = (key: Exclude<Panel, null>, label: string, danger = false) => (
    <button
      aria-pressed={panel === key}
      className={`inline-flex min-h-10 items-center rounded-xl px-3 text-[14px] font-semibold ${panel === key ? (danger ? "bg-[var(--danger)] text-white" : "bg-[var(--primary)] text-white") : danger ? "text-[var(--danger)] hover:bg-[var(--danger-light)]" : "text-[var(--foreground)] hover:bg-[var(--panel-secondary)]"}`}
      onClick={() => {
        setResult(null);
        setPanel(panel === key ? null : key);
      }}
      type="button"
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-3">
      {count ? (
        <div className="card sticky top-2 z-20 space-y-3 border-2 border-[var(--primary)] p-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="me-2 font-bold text-[var(--foreground)]">{plural(count)} selected</span>
            {barButton("tag_add", "Add tag")}
            {barButton("tag_remove", "Remove tag")}
            {barButton("plan", "Change plan")}
            {barButton("trial", "Extend trial")}
            <button className="inline-flex min-h-10 items-center rounded-xl px-3 text-[14px] font-semibold text-[var(--foreground)] hover:bg-[var(--panel-secondary)]" disabled={pending} onClick={() => run({ action: "export", ids })} type="button">
              Export CSV
            </button>
            {barButton("delete", "Delete", true)}
            <button className="ms-auto text-[14px] font-semibold text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => { setSelected(new Set()); setPanel(null); setResult(null); }} type="button">
              Clear selection
            </button>
          </div>

          {panel === "tag_add" || panel === "tag_remove" ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run({ action: panel, ids, tag });
              }}
            >
              <input aria-label="Tag" className="w-56" list="admin-tags" maxLength={30} onChange={(event) => setTag(event.target.value)} placeholder="e.g. test, vip" value={tag} />
              <datalist id="admin-tags">
                {existingTags.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <button className="primary-action pressable" disabled={pending || !tag.trim()} type="submit">
                {pending ? "Saving…" : panel === "tag_add" ? `Add to ${plural(count)}` : `Remove from ${plural(count)}`}
              </button>
            </form>
          ) : null}

          {panel === "plan" ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run({ action: "plan", ids, tier, status });
              }}
            >
              <select aria-label="Plan" onChange={(event) => setTier(event.target.value)} value={tier}>
                {PLANS.map((plan) => (
                  <option key={plan.value} value={plan.value}>
                    {plan.label}
                  </option>
                ))}
              </select>
              <select aria-label="Status" onChange={(event) => setStatus(event.target.value)} value={status}>
                <option value="">Keep each status</option>
                {Object.entries(statusLabels)
                  .sort((a, b) => a[1].localeCompare(b[1]))
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
              <button className="primary-action pressable" disabled={pending} type="submit">
                {pending ? "Saving…" : `Change ${plural(count)}`}
              </button>
            </form>
          ) : null}

          {panel === "trial" ? (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                run({ action: "trial", ids, days: Number(days) });
              }}
            >
              <label className="flex items-center gap-2 font-semibold text-[var(--foreground-secondary)]">
                Add
                <input aria-label="Days" className="w-20" inputMode="numeric" max={365} min={1} onChange={(event) => setDays(event.target.value.replace(/\D/g, ""))} value={days} />
                days
              </label>
              <span className="text-[14px] font-medium text-[var(--muted)]">From today or the current end, whichever is later. An ended trial starts again.</span>
              <button className="primary-action pressable" disabled={pending || !Number(days)} type="submit">
                {pending ? "Saving…" : `Extend ${plural(count)}`}
              </button>
            </form>
          ) : null}

          {panel === "delete" ? (
            <form
              className="space-y-2 rounded-xl bg-[var(--danger-light)] p-3"
              onSubmit={(event) => {
                event.preventDefault();
                run({ action: "delete", ids, confirm, includePaid });
              }}
            >
              <p className="font-semibold text-[var(--foreground)]">
                This closes {plural(count)}, the same as Delete business on each one&apos;s page: their teams lose access and their booking pages go offline at
                once. Each can be restored from its page for 30 days, then deleted for good there. Each one gets its own line in the admin log.
              </p>
              <label className="block">
                <span className="text-[14px] font-semibold text-[var(--foreground-secondary)]">
                  Type <strong className="text-[var(--foreground)]">{phrase}</strong> to confirm
                </span>
                <input aria-label="Confirmation" autoComplete="off" className="mt-1 w-full max-w-sm" onChange={(event) => setConfirm(event.target.value)} value={confirm} />
              </label>
              <label className="checkbox-label !mb-0 text-[14px]">
                <input checked={includePaid} onChange={(event) => setIncludePaid(event.target.checked)} type="checkbox" />
                Also close businesses that have paid for time they haven&apos;t used yet
              </label>
              <button className="inline-flex min-h-11 items-center rounded-xl bg-[var(--danger)] px-4 font-semibold text-white disabled:opacity-50" disabled={pending || confirm.trim().toLowerCase() !== phrase.toLowerCase()} type="submit">
                {pending ? "Closing…" : phrase}
              </button>
            </form>
          ) : null}

          {result ? (
            <p className={`text-[14px] font-semibold ${result.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`} role="status">
              {result.message}
            </p>
          ) : null}
        </div>
      ) : result ? (
        <p className={`text-[14px] font-semibold ${result.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`} role="status">
          {result.message}
        </p>
      ) : null}

      {/* Everything on this page is ticked: offer every business that matches, as mail apps do. */}
      {allOnPage && allMatchingIds.length > pageIds.length ? (
        <p className="rounded-xl bg-[var(--panel-secondary)] px-4 py-2.5 text-center text-[14px] font-semibold text-[var(--foreground-secondary)]">
          {selected.size === allMatchingIds.length ? (
            <>
              All {allMatchingIds.length} matching businesses are selected.{" "}
              <button className="text-[var(--primary)] hover:underline" onClick={() => setSelected(new Set(pageIds))} type="button">
                Only this page
              </button>
            </>
          ) : (
            <>
              All {pageIds.length} on this page are selected.{" "}
              <button className="text-[var(--primary)] hover:underline" onClick={() => setSelected(new Set(allMatchingIds))} type="button">
                Select all {allMatchingIds.length} matching
              </button>
            </>
          )}
        </p>
      ) : null}

      <div className="card overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left">
            <thead>
              <tr>
                <th className="w-10 py-3 ps-4">
                  <input
                    aria-label={allOnPage ? "Unselect this page" : "Select this page"}
                    checked={allOnPage}
                    onChange={(event) =>
                      setSelected((current) => {
                        const next = new Set(current);
                        for (const id of pageIds) {
                          if (event.target.checked) next.add(id);
                          else next.delete(id);
                        }
                        return next;
                      })
                    }
                    ref={head}
                    type="checkbox"
                  />
                </th>
                <th className="px-4 py-3">Business</th>
                <th className="px-4 py-3">Plan</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Trial ends / next payment</th>
                <th className="px-4 py-3 text-right">Vehicles</th>
                <th className="px-4 py-3">Last sign-in</th>
                <th className="px-4 py-3">Joined</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center font-medium text-[var(--muted)]" colSpan={8}>
                    No businesses match.
                  </td>
                </tr>
              ) : (
                rows.map((b) => (
                  <tr className={selected.has(b.id) ? "bg-[var(--primary-light)]" : "hover:bg-[var(--panel-secondary)]"} key={b.id}>
                    <td className="py-3 ps-4 align-top">
                      <input aria-label={`Select ${b.name}`} checked={selected.has(b.id)} onChange={(event) => toggle(b.id, event.target.checked)} type="checkbox" />
                    </td>
                    <td className="px-4 py-3">
                      <Link className="block font-bold text-[var(--foreground)] hover:text-[var(--primary)]" href={`/platform/businesses/${b.id}` as Route}>
                        {b.name}
                        {b.deleted ? <span className="ms-2 text-[13px] font-bold text-[var(--danger)]">Deleted</span> : null}
                      </Link>
                      <span className="block text-[13px] font-medium text-[var(--muted)]">
                        {b.ownerEmail || "No owner"}
                        {b.country ? ` · ${b.country}` : ""}
                      </span>
                      {b.tags.length || b.segments.some((key) => ROW_SEGMENTS.has(key)) ? (
                        <span className="mt-1 flex flex-wrap gap-1">
                          {b.tags.map((item) => (
                            <span className="rounded-full border border-[var(--primary)] bg-[var(--panel)] px-2 py-0.5 text-[12px] font-bold text-[var(--primary)]" key={item}>
                              #{item}
                            </span>
                          ))}
                          {b.segments
                            .filter((key) => ROW_SEGMENTS.has(key))
                            .map((key) => (
                              <span className="rounded-full bg-[var(--panel-tertiary)] px-2 py-0.5 text-[12px] font-semibold text-[var(--foreground-secondary)]" key={key}>
                                {SEGMENT_LABEL[key]}
                              </span>
                            ))}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {b.plan}
                      {b.custom ? <span className="ms-1.5 text-[13px] font-bold text-[var(--primary)]">custom</span> : null}
                      {b.wants ? <span className="block text-[13px] font-bold text-[var(--warning)]">Wants {b.wants}</span> : null}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-bold ${TONE[b.status] || TONE.expired}`}>{statusLabels[b.status] || b.status}</span>
                    </td>
                    <td className={`px-4 py-3 text-[14px] font-medium ${b.trialSoon ? "font-bold text-[var(--warning)]" : "text-[var(--foreground-secondary)]"}`}>{b.trialOrNext}</td>
                    <td className="num px-4 py-3 text-right font-semibold">{b.vehicles}</td>
                    <td className="px-4 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">{b.lastActive}</td>
                    <td className="px-4 py-3 text-[14px] font-medium text-[var(--foreground-secondary)]">{b.joined}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
