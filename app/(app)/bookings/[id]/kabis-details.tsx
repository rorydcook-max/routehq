"use client";

import { useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink } from "lucide-react";
import type { KabisField } from "@/lib/kabis";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Türkiye: the booking's KABİS entry (lib/kabis.ts), one line per field the police portal asks for, each with a copy
 * button, and "Copy all" for pasting into notes. RoveHQ can't submit it (there is no public API), so this makes typing it
 * into the portal a matter of seconds. Shown only for businesses in Türkiye.
 */
export function KabisDetails({ fields, portalUrl, customerId }: { fields: KabisField[]; portalUrl: string; customerId: string | null }) {
  const say = useTranslations("booking") as unknown as Say;
  const [copied, setCopied] = useState<string | null>(null);
  const missing = fields.filter((field) => field.missing).length;

  async function copy(id: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
    } catch {
      setCopied(null);
    }
  }
  const all = fields
    .filter((field) => field.value)
    .map((field) => `${say(`kabis_${field.key}`)}: ${field.value}`)
    .join("\n");

  return (
    <details className="card scroll-mt-4 p-4" id="kabis" open={missing > 0}>
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
        <span>
          <span className="block text-[17px] font-bold text-[var(--foreground)]">{say("kabis_title")}</span>
          <span className={`block font-semibold ${missing ? "text-[var(--warning)]" : "text-[var(--muted)]"}`}>
            {missing ? say("kabis_missing", { count: missing }) : say("kabis_ready")}
          </span>
        </span>
        <span aria-hidden="true" className="ti ti-chevron-down mt-1 text-[var(--muted)]" />
      </summary>
      <p className="mt-2 text-[14px] text-[var(--foreground-secondary)]">{say("kabis_why")}</p>
      <dl className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-white">
        {fields.map((field) => (
          <div className="flex min-h-11 items-center gap-2 px-3 py-1.5" key={field.key}>
            <dt className="w-[42%] shrink-0 text-[14px] font-semibold text-[var(--muted)]">{say(`kabis_${field.key}`)}</dt>
            <dd className={`min-w-0 flex-1 text-[15px] font-semibold [overflow-wrap:anywhere] ${field.missing ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>
              {field.value ? <bdi>{field.value}</bdi> : field.missing ? say("kabis_notSet") : "–"}
            </dd>
            {field.value ? (
              <button aria-label={say("kabis_copyOne", { label: say(`kabis_${field.key}`) })} className="secondary-action pressable min-h-9 shrink-0 px-2.5" onClick={() => copy(field.key, field.value)} type="button">
                {copied === field.key ? <Check size={16} /> : <Copy size={16} />}
              </button>
            ) : null}
          </div>
        ))}
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="primary-action pressable min-h-11 px-3 text-sm" href={portalUrl} rel="noreferrer" target="_blank">
          <ExternalLink size={16} />
          {say("kabis_openPortal")}
        </a>
        <button className="secondary-action pressable min-h-11 px-3 text-sm" disabled={!all} onClick={() => copy("all", all)} type="button">
          {copied === "all" ? <Check size={16} /> : <Copy size={16} />}
          {copied === "all" ? say("kabis_copied") : say("kabis_copyAll")}
        </button>
        {missing && customerId ? (
          <Link className="secondary-action pressable min-h-11 px-3 text-sm" href={`/customers/${customerId}#details` as Route}>
            {say("kabis_fillIn")}
          </Link>
        ) : null}
      </div>
    </details>
  );
}
