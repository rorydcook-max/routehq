"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createLineLinkCode, lineConnectionStatus } from "@/app/actions/settings";

/**
 * Connect LINE in two taps: add the RouteHQ account as a friend, then send it
 * a one-time code. The webhook links whoever sends the code, and this panel
 * notices and refreshes the page.
 */
export function LineConnectPanel({ organizationId, lineOaId }: { organizationId: string; lineOaId: string }) {
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  // While a code is showing, check every few seconds whether it has been sent.
  useEffect(() => {
    if (!code) return;
    const timer = window.setInterval(async () => {
      try {
        const status = await lineConnectionStatus(organizationId);
        if (status.connected) {
          window.clearInterval(timer);
          router.refresh();
        }
      } catch {
        // keep waiting
      }
    }, 4000);
    return () => window.clearInterval(timer);
  }, [code, organizationId, router]);

  function getCode() {
    setError(null);
    startTransition(async () => {
      const result = await createLineLinkCode(organizationId);
      if (result.ok) setCode(result.code);
      else setError(result.error);
    });
  }

  const oa = lineOaId || "@routehq";
  const sendUrl = code ? `https://line.me/R/oaMessage/${encodeURIComponent(oa)}/?${encodeURIComponent(code)}` : "";

  return (
    <div className="mt-3 space-y-4 rounded-lg border border-[#dfe4ea] p-3">
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0f766e]">Step 1 · Add RouteHQ on LINE</p>
        <p className="text-sm text-[#344054]">
          Add <span className="font-mono font-semibold">{oa}</span> as a friend in LINE.
        </p>
        <a
          className="inline-flex items-center gap-2 rounded-lg border border-[#06c755] px-3 py-2 text-sm font-semibold text-[#06a347] hover:bg-[#f0fdf4]"
          href={`https://line.me/R/ti/p/${encodeURIComponent(oa)}`}
          rel="noreferrer"
          target="_blank"
        >
          Add friend in LINE
        </a>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#0f766e]">Step 2 · Send your connection code</p>
        {code ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-[#dfe4ea] bg-[#f8fafc] px-3 py-2 font-mono text-lg font-bold tracking-wider text-[#172026]">{code}</span>
              <button
                className="rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 text-sm font-semibold text-[#344054]"
                onClick={() => {
                  navigator.clipboard?.writeText(code).then(() => setCopied(true)).catch(() => null);
                }}
                type="button"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <a className="primary-action pressable min-h-10 px-4 text-sm" href={sendUrl} rel="noreferrer" target="_blank">
                Send in LINE
              </a>
            </div>
            <p className="text-xs text-[#667085]">
              Send this code to {oa} in LINE (the button opens the chat with it filled in). This page updates by itself once it arrives. The code works for 30 minutes.
            </p>
          </>
        ) : (
          <button className="primary-action pressable min-h-10 px-4 text-sm" disabled={isPending} onClick={getCode} type="button">
            {isPending ? "Creating code…" : "Get a connection code"}
          </button>
        )}
        {error ? <p className="text-xs font-semibold text-[#dc2626]">{error}</p> : null}
      </div>
    </div>
  );
}
