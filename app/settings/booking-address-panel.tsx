"use client";

import Link from "next/link";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, ExternalLink, RefreshCw } from "lucide-react";
import { checkOwnDomain, saveBookingSubdomain, saveOwnDomain } from "@/app/actions/booking-address";
import { cleanSubdomain, DNS_A_TARGET, DNS_CNAME_TARGET, isApexDomain, typingSubdomain } from "@/lib/booking-address";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Where customers book: the RouteHQ address (always), theirshop.routehq.app (Pro and above)
 * and their own domain (Business plan).
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
  suggestion
}: {
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
      else router.refresh();
    });
  }

  const addressRow = (url: string, note?: string) => (
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <p className="break-all text-[16px] font-bold text-[var(--foreground)]">{url.replace(/^https?:\/\//, "")}</p>
      {note ? <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{note}</p> : null}
      <div className="mt-2.5 flex flex-wrap gap-2">
        <button className="secondary-action pressable" onClick={() => copy(url)} type="button">
          <Copy size={17} />
          {copied === url ? say("copied") : say("pb_copy")}
        </button>
        <a className="secondary-action pressable" href={url} rel="noreferrer" target="_blank">
          <ExternalLink size={17} />
          {say("pb_open")}
        </a>
      </div>
    </div>
  );

  const apex = domain ? isApexDomain(domain) : false;
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <p className="font-semibold text-[var(--foreground)]">{say("ba_routehq")}</p>
        {addressRow(pathUrl, say("ba_routehqNote"))}
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-[var(--foreground)]">{say("ba_subTitle")}</p>
        {canSubdomain ? (
          <>
            <p className="font-medium text-[var(--foreground-secondary)]">{say("ba_subBody")}</p>
            <div className="flex max-w-md items-stretch overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--panel)]">
              <input
                aria-label={say("ba_subTitle")}
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
            {subdomain && subdomainUrl ? addressRow(subdomainUrl, say("ba_subLive")) : null}
          </>
        ) : (
          <p className="font-medium text-[var(--foreground-secondary)]">
            {say("ba_subPlan", { example: `${suggestion}.${rootDomain}` })}{" "}
            <Link className="font-semibold text-[var(--primary)]" href={"/settings/billing" as Route}>
              {say("ba_seePlans")}
            </Link>
          </p>
        )}
      </div>

      <div className="space-y-2">
        <p className="font-semibold text-[var(--foreground)]">{say("ba_ownTitle")}</p>
        {canDomain ? (
          <>
            <p className="font-medium text-[var(--foreground-secondary)]">{say("ba_ownBody")}</p>
            <input
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
                addressRow(`https://${domain}`, say("ba_ownLive"))
              ) : (
                <div className="rounded-xl border border-[var(--border)] p-3.5">
                  <p className="font-bold text-[var(--foreground)]">{domainStatus === "waiting_team" ? say("ba_ownWaitingTeam", { domain }) : say("ba_ownWaitingDns", { domain })}</p>
                  <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("ba_dnsIntro")}</p>
                  <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-[15px]">
                    <dt className="font-sans font-semibold text-[var(--muted)]">{say("ba_dnsType")}</dt>
                    <dd className="font-bold">{apex ? "A" : "CNAME"}</dd>
                    <dt className="font-sans font-semibold text-[var(--muted)]">{say("ba_dnsName")}</dt>
                    <dd className="break-all font-bold">{apex ? "@" : domain.split(".")[0]}</dd>
                    <dt className="font-sans font-semibold text-[var(--muted)]">{say("ba_dnsValue")}</dt>
                    <dd className="break-all font-bold">{apex ? DNS_A_TARGET : DNS_CNAME_TARGET}</dd>
                  </dl>
                  <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("ba_dnsHelp")}</p>
                  <div className="mt-2.5 flex flex-wrap gap-2">
                    <button className="secondary-action pressable" disabled={pending} onClick={() => run(() => checkOwnDomain())} type="button">
                      <RefreshCw size={17} />
                      {say("ba_checkAgain")}
                    </button>
                    <Link className="secondary-action pressable" href={"/help?topic=domain" as Route}>
                      {say("ba_askUs")}
                    </Link>
                  </div>
                </div>
              )
            ) : null}
          </>
        ) : (
          <p className="font-medium text-[var(--foreground-secondary)]">
            {say("ba_ownPlan")}{" "}
            <Link className="font-semibold text-[var(--primary)]" href={"/settings/billing" as Route}>
              {say("ba_seePlans")}
            </Link>
          </p>
        )}
      </div>
      {error ? <p className="font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
