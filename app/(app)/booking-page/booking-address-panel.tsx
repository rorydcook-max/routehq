"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { checkOwnDomain, saveBookingSubdomain, saveOwnDomain } from "@/app/actions/booking-address";
import { cleanSubdomain, DNS_A_TARGET, DNS_CNAME_TARGET, isApexDomain, typingSubdomain } from "@/lib/booking-address";
import { RoveNameField } from "@/app/(app)/booking-page/rove-name-field";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Where customers book: the rove.rent address (always), then a subdomain (Pro and above) OR a custom domain
 * (Business plan). Labels and controls only (Rory, 7 Nov 2026).
 */
export function BookingAddressPanel({
  pathUrl,
  rootDomain,
  subdomain,
  subdomainUrl,
  domain,
  domainStatus,
  canSubdomain,
  canDomain,
  suggestion,
  onSaved
}: {
  /** After an address is saved (the Booking page tool reloads its preview). */
  onSaved?: () => void;
  pathUrl: string;
  rootDomain: string;
  subdomain: string | null;
  subdomainUrl: string | null;
  domain: string | null;
  domainStatus: string | null;
  canSubdomain: boolean;
  canDomain: boolean;
  suggestion: string;
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [label, setLabel] = useState(subdomain || "");
  const [own, setOwn] = useState(domain || "");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function copy(url: string) {
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(url);
        setTimeout(() => setCopied(null), 1500);
      })
      .catch(() => null);
  }

  function run(work: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const result = await work().catch(() => ({ ok: false, error: say("saveFailed") }));
      if (!result.ok) setError(result.error || say("saveFailed"));
      else {
        router.refresh();
        onSaved?.();
      }
    });
  }

  // A live address: one line with copy and open.
  const liveRow = (url: string) => (
    <div className="flex items-center gap-2 rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2.5">
      <p className="min-w-0 flex-1 break-all font-bold text-[var(--foreground)]">{url.replace(/^https?:\/\//, "")}</p>
      <button aria-label={say("pb_copy")} className="icon-action pressable" onClick={() => copy(url)} title={copied === url ? say("copied") : say("pb_copy")} type="button">
        <Copy size={17} />
      </button>
      <a aria-label={say("pb_open")} className="icon-action pressable" href={url} rel="noreferrer" target="_blank" title={say("pb_open")}>
        <ExternalLink size={17} />
      </a>
    </div>
  );

  const planLink = (text: string) => (
    <p className="font-medium text-[var(--foreground-secondary)]">
      {text}{" "}
      <Link className="font-semibold text-[var(--primary)]" href={"/settings/billing" as Route}>
        {say("ba_seePlans")}
      </Link>
    </p>
  );

  const apex = domain ? isApexDomain(domain) : false;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-semibold text-[var(--foreground)]">{say("rn_title")}</p>
        {/* The name after rove.rent/ is the business's to choose (Rory, 1 Nov 2026). */}
        <RoveNameField current={pathUrl.replace(/\/$/, "").split("/").pop() || ""} host={pathUrl.replace(/^https?:\/\//, "").replace(/\/[^/]*$/, "")} />
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-[var(--foreground)]">{say("ba_subLabel")}</p>
        {canSubdomain ? (
          <>
            <div className="flex max-w-md items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
              <input
                aria-label={say("ba_subLabel")}
                autoCapitalize="none"
                autoCorrect="off"
                className="min-w-0 flex-1 border-0 bg-transparent px-3 py-2.5 text-[16px] font-semibold"
                disabled={pending}
                onChange={(event) => setLabel(typingSubdomain(event.target.value))}
                placeholder={suggestion}
                spellCheck={false}
                value={label}
              />
              <span className="flex items-center bg-[var(--panel-secondary)] px-3 font-semibold text-[var(--muted)]">.{rootDomain}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="primary-action pressable" disabled={pending || !cleanSubdomain(label) || cleanSubdomain(label) === (subdomain || "")} onClick={() => run(() => saveBookingSubdomain({ value: label }))} type="button">
                {subdomain ? say("ba_change") : say("ba_claim")}
              </button>
              {subdomain ? (
                <button
                  className="secondary-action pressable"
                  disabled={pending}
                  onClick={() => {
                    setLabel("");
                    run(() => saveBookingSubdomain({ value: "" }));
                  }}
                  type="button"
                >
                  {say("ba_remove")}
                </button>
              ) : null}
            </div>
            {subdomain && subdomainUrl ? liveRow(subdomainUrl) : null}
          </>
        ) : (
          planLink(say("ba_subPlan", { example: `${suggestion}.${rootDomain}` }))
        )}
      </div>

      <div className="flex items-center gap-3 text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]">
        <span className="h-px flex-1 bg-[var(--border)]" />
        {say("ba_or")}
        <span className="h-px flex-1 bg-[var(--border)]" />
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-[var(--foreground)]">{say("ba_ownLabel")}</p>
        {canDomain ? (
          <>
            <input
              aria-label={say("ba_ownLabel")}
              autoCapitalize="none"
              autoCorrect="off"
              className="block w-full max-w-md"
              disabled={pending}
              onChange={(event) => setOwn(event.target.value)}
              placeholder="book.yourshop.com"
              spellCheck={false}
              value={own}
            />
            <div className="flex flex-wrap gap-2">
              <button className="primary-action pressable" disabled={pending || !own.trim() || own.trim().toLowerCase() === (domain || "")} onClick={() => run(() => saveOwnDomain({ value: own }))} type="button">
                {domain ? say("ba_change") : say("ba_ownConnect")}
              </button>
              {domain ? (
                <button
                  className="secondary-action pressable"
                  disabled={pending}
                  onClick={() => {
                    setOwn("");
                    run(() => saveOwnDomain({ value: "" }));
                  }}
                  type="button"
                >
                  {say("ba_remove")}
                </button>
              ) : null}
            </div>
            {domain ? (
              domainStatus === "live" ? (
                liveRow(`https://${domain}`)
              ) : (
                <div className="rounded-xl border border-[var(--border)] p-3.5">
                  <p className="font-bold text-[var(--foreground)]">{domainStatus === "waiting_team" ? say("ba_ownWaitingTeam", { domain }) : say("ba_ownWaitingDns", { domain })}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[15px]">
                    <dt className="font-sans font-semibold text-[var(--muted)]">{say("ba_dnsType")}</dt>
                    <dd className="font-bold">{apex ? "A" : "CNAME"}</dd>
                    <dt className="font-sans font-semibold text-[var(--muted)]">{say("ba_dnsName")}</dt>
                    <dd className="break-all font-bold">{apex ? "@" : domain.split(".")[0]}</dd>
                    <dt className="font-sans font-semibold text-[var(--muted)]">{say("ba_dnsValue")}</dt>
                    <dd className="break-all font-bold">{apex ? DNS_A_TARGET : DNS_CNAME_TARGET}</dd>
                  </dl>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button className="secondary-action pressable" disabled={pending} onClick={() => run(() => checkOwnDomain())} type="button">
                      <RefreshCw size={17} />
                      {say("ba_checkAgain")}
                    </button>
                  </div>
                </div>
              )
            ) : null}
          </>
        ) : (
          planLink(say("ba_ownPlan"))
        )}
      </div>
      {error ? <p className="font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
