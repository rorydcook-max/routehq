"use client";

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, Loader2, Sparkles, X } from "lucide-react";
import { dateFormat } from "@/lib/i18n/dates";
import { InfoTip } from "@/components/info-tip";

/**
 * AI vehicle photos (task build-img, 8 Nov 2026): "Generate with AI" and "Enhance" beside a vehicle's photos, on the
 * vehicle page's photo manager and the Add vehicle form. Results come back as previews to keep or discard, one at a
 * time with progress. The server side is app/api/vehicle-photos/ai.
 *
 * With `vehicleId`, previews are stored on the server and Keep adds (or, enhanced, replaces) the photo. Without one
 * (Add vehicle form) previews are data URLs and Keep hands them to `onKeepDraft` to send with the form.
 */

export type AiPreview = { key: string; kind: "generate" | "enhance"; url: string; path?: string; angle?: string; documentId?: string; sourceKey?: string };
type Left = { limit: number; left: number; resetsOn: string } | null;
type Say = (key: string, values?: Record<string, string | number>) => string;
export type DraftDetails = { make?: string; model?: string; year?: number | string | null; color?: string; trim?: string; body?: string; plate?: string; kind?: string };

const FIELDS = ["make", "model", "year", "color"] as const;
const STOPS = new Set(["no_provider", "billing", "quota", "signin", "forbidden", "missing"]);

async function call(body: Record<string, unknown>) {
  const response = await fetch("/api/vehicle-photos/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json().catch(() => ({ error: "failed" }));
  return { ok: response.ok && !payload.error, ...payload } as Record<string, any> & { ok: boolean };
}

export function useAiPhotos({ vehicleId, getDetails, onChanged, onKeepDraft }: { vehicleId?: string; getDetails?: () => DraftDetails; onChanged?: () => void; onKeepDraft?: (preview: AiPreview) => void }) {
  const say = useTranslations("aiPhotos") as unknown as Say;
  const locale = useLocale();
  const [progress, setProgress] = useState<{ mode: "generate" | "enhance"; done: number; total: number } | null>(null);
  const [previews, setPreviews] = useState<AiPreview[]>([]);
  const [message, setMessage] = useState("");
  const [missing, setMissing] = useState<string[]>([]);
  const [left, setLeft] = useState<Left>(null);
  const [saving, setSaving] = useState<string | null>(null);

  function explain(code: string, data: Record<string, any> = {}) {
    // resetsOn is a yyyy-mm-dd day: shown as a date in the reader's language, not as the raw ISO text.
    if (code === "quota") return data.left?.resetsOn ? say("err_quota", { date: dateFormat(locale, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${data.left.resetsOn}T00:00:00Z`)) }) : say("err_quotaNow");
    if (code === "no_provider" || code === "billing") return say("err_unavailable");
    if (code === "busy") return say("err_busy");
    if (code === "refused") return say("err_refused");
    return say("err_failed");
  }

  async function generate() {
    setMessage("");
    setMissing([]);
    const details = getDetails?.() || {};
    const status = await call({ action: "status", vehicleId, details: { kind: details.kind } });
    if (!status.ok) return setMessage(explain(status.error));
    setLeft(status.left);
    const absent: string[] = vehicleId ? status.missing || [] : FIELDS.filter((field) => !String(details[field] ?? "").trim());
    if (absent.length) return setMissing(absent);
    if (!status.configured) return setMessage(explain("no_provider"));
    const angles: string[] = status.angles || [];
    if (status.left && status.left.left < 1) return setMessage(explain("quota", status));
    setProgress({ mode: "generate", done: 0, total: angles.length });
    for (const [index, angle] of angles.entries()) {
      const result = await call({ action: "generate", vehicleId, angle, details: vehicleId ? undefined : details });
      if (result.left !== undefined) setLeft(result.left);
      if (!result.ok) {
        if (result.error === "missing") setMissing(result.missing || []);
        else setMessage(explain(result.error, result));
        if (STOPS.has(result.error) || result.error === "busy" || result.error === "failed") break;
      } else {
        setPreviews((list) => [...list, { key: `${Date.now()}-${angle}`, kind: "generate", url: result.url || result.dataUrl, path: result.path, angle }]);
      }
      setProgress({ mode: "generate", done: index + 1, total: angles.length });
    }
    setProgress(null);
  }

  /** Enhances photos: stored ones by document id, or (Add vehicle form) a data URL. */
  async function enhance(items: Array<{ documentId?: string; image?: string; sourceKey?: string }>) {
    if (!items.length) return;
    setMessage("");
    setProgress({ mode: "enhance", done: 0, total: items.length });
    for (const [index, item] of items.entries()) {
      const result = await call({ action: "enhance", vehicleId, documentId: item.documentId, image: item.image });
      if (result.left !== undefined) setLeft(result.left);
      if (!result.ok) {
        setMessage(explain(result.error, result));
        if (STOPS.has(result.error) || result.error === "busy") break;
      } else {
        setPreviews((list) => [...list, { key: `${Date.now()}-${index}`, kind: "enhance", url: result.url || result.dataUrl, path: result.path, documentId: result.documentId, sourceKey: item.sourceKey }]);
      }
      setProgress({ mode: "enhance", done: index + 1, total: items.length });
    }
    setProgress(null);
  }

  async function keep(preview: AiPreview) {
    if (!vehicleId) {
      onKeepDraft?.(preview);
      setPreviews((list) => list.filter((item) => item.key !== preview.key));
      return;
    }
    setSaving(preview.key);
    const result = await call({ action: "keep", vehicleId, path: preview.path, documentId: preview.documentId });
    setSaving(null);
    if (!result.ok) return setMessage(explain(result.error));
    setPreviews((list) => list.filter((item) => item.key !== preview.key));
    onChanged?.();
  }

  async function keepAll() {
    for (const preview of previews) await keep(preview);
  }

  async function discard(preview: AiPreview) {
    setPreviews((list) => list.filter((item) => item.key !== preview.key));
    if (vehicleId && preview.path) await call({ action: "discard", vehicleId, path: preview.path });
  }

  async function revert(documentId: string) {
    setMessage("");
    setSaving(documentId);
    const result = await call({ action: "revert", vehicleId, documentId });
    setSaving(null);
    if (!result.ok) return setMessage(explain(result.error));
    onChanged?.();
  }

  return { say, progress, previews, message, missing, left, saving, busy: Boolean(progress), generate, enhance, keep, keepAll, discard, revert, setMissing };
}

export type AiPhotos = ReturnType<typeof useAiPhotos>;

/** The two actions, progress, messages and the previews to keep or discard. `onEnhanceAll` is left out when there's nothing to enhance. */
export function AiPhotoTools({ ai, onEnhanceAll, editHref, onFixField, compact = false }: { ai: AiPhotos; onEnhanceAll?: () => void; editHref?: string; onFixField?: (field: string) => void; compact?: boolean }) {
  const { say } = ai;
  const button = `secondary-action pressable inline-flex min-h-11 w-full min-w-0 items-center justify-center gap-1.5 whitespace-nowrap px-3 text-[14px] sm:text-[15px] ${compact ? "sm:text-[14px]" : ""}`;
  const icon = "shrink-0";
  return (
    <div className="mt-3">
      {/* The two actions side by side at every width, centred, with the (i) after them (Rory, 8 Nov 2026: the stacked
          buttons sat off-centre and the hover-only tip didn't open on a phone). */}
      <div className="flex items-center gap-1">
        <div className={`grid flex-1 gap-2 ${onEnhanceAll ? "grid-cols-2" : ""}`}>
        <button className={button} disabled={ai.busy} onClick={() => void ai.generate()} type="button">
          <Sparkles aria-hidden="true" className={icon} size={17} />
          {say("generate")}
        </button>
        {onEnhanceAll ? (
          <button className={button} disabled={ai.busy} onClick={onEnhanceAll} type="button">
            <Sparkles aria-hidden="true" className={icon} size={17} />
            {say("enhanceAll")}
          </button>
        ) : null}
        </div>
        <InfoTip className="shrink-0" label={say("infoLabel")} text={say("info")} />
      </div>
      {ai.left && ai.left.left <= 10 ? <p className="mt-1.5 text-[13px] font-semibold text-[var(--foreground-secondary)]">{say("left", { count: ai.left.left })}</p> : null}

      {ai.missing.length ? (
        <div className="mt-3 rounded-xl bg-[var(--warning-light)] px-4 py-3 text-[14px] font-semibold text-[var(--foreground)]">
          <p>{say("missing")}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {ai.missing.map((field) =>
              onFixField ? (
                <button className="rounded-full bg-white px-3 py-1.5 font-bold text-[var(--primary)] shadow-sm" key={field} onClick={() => onFixField(field)} type="button">
                  {say(`f_${field}`)}
                </button>
              ) : (
                <span className="rounded-full bg-white px-3 py-1.5 font-bold text-[var(--foreground)] shadow-sm" key={field}>
                  {say(`f_${field}`)}
                </span>
              )
            )}
            {editHref ? (
              <Link className="rounded-full px-2 py-1.5 font-bold text-[var(--primary)] underline underline-offset-2" href={editHref as any}>
                {say("editVehicle")}
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}

      {ai.progress ? (
        <div aria-live="polite" className="mt-3 rounded-xl bg-[var(--panel-secondary)] px-4 py-3">
          <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--foreground)]">
            <Loader2 className="animate-spin" size={16} />
            {say(ai.progress.mode === "generate" ? "generating" : "enhancing", { done: Math.min(ai.progress.done + 1, ai.progress.total), total: ai.progress.total })}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
            <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${Math.max(6, (ai.progress.done / ai.progress.total) * 100)}%` }} />
          </div>
        </div>
      ) : null}

      {ai.message ? <p className="mt-3 rounded-xl bg-[var(--panel-secondary)] px-4 py-3 text-[14px] font-bold text-[var(--foreground)]">{ai.message}</p> : null}

      {ai.previews.length ? (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-bold text-[var(--foreground)]">{say("results")}</h3>
            {ai.previews.length > 1 ? (
              <button className="min-h-11 px-2 text-[14px] font-bold text-[var(--primary)]" disabled={Boolean(ai.saving)} onClick={() => void ai.keepAll()} type="button">
                {say("keepAll")}
              </button>
            ) : null}
          </div>
          <div className={`mt-2 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
            {ai.previews.map((preview) => (
              <div className="overflow-hidden rounded-2xl bg-[var(--panel-secondary)] ring-2 ring-[var(--primary)]/25" key={preview.key}>
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img alt="" className="aspect-[3/2] w-full object-cover" height={400} src={preview.url} width={600} />
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-semibold text-white">
                    <Sparkles aria-hidden="true" size={11} />
                    {preview.kind === "enhance" ? say("enhanced") : preview.angle ? say(`a_${preview.angle}`) : say("generated")}
                  </span>
                </div>
                <div className="grid grid-cols-2">
                  <button className="flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-bold text-[var(--foreground-secondary)]" disabled={ai.saving === preview.key} onClick={() => void ai.discard(preview)} type="button">
                    <X size={16} />
                    {say("discard")}
                  </button>
                  <button className="flex min-h-11 items-center justify-center gap-1.5 text-[14px] font-bold text-[var(--primary)]" disabled={ai.saving === preview.key} onClick={() => void ai.keep(preview)} type="button">
                    {ai.saving === preview.key ? <Loader2 className="animate-spin" size={16} /> : <Check size={16} />}
                    {say("keep")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
