"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { createLineLinkCode, lineConnectionStatus } from "@/app/actions/settings";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Connect LINE in two taps: add the RouteHQ account as a friend, then send it
 * a one-time code. The webhook links whoever sends the code, and this panel
 * notices and refreshes the page.
 */
export function LineConnectPanel({ organizationId, lineOaId }: { organizationId: string; lineOaId: string }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
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
    setFailed(false);
    startTransition(async () => {
      const result = await createLineLinkCode(organizationId).catch(() => ({ ok: false as const }));
      if (result.ok) setCode(result.code);
      else setFailed(true);
    });
  }

  const oa = lineOaId || "@routehq";
  const sendUrl = code ? `https://line.me/R/oaMessage/${encodeURIComponent(oa)}/?${encodeURIComponent(code)}` : "";

  return (
    <div className="mt-3 space-y-4 rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <div className="space-y-2">
        <p className="text-[16px] font-bold text-[var(--foreground)]">{say("lc_step1")}</p>
        <p className="font-medium text-[var(--foreground-secondary)]">{say("lc_step1Body", { account: oa })}</p>
        <a className="secondary-action pressable" href={`https://line.me/R/ti/p/${encodeURIComponent(oa)}`} rel="noreferrer" target="_blank">
          {say("lc_addFriend")}
        </a>
      </div>

      <div className="space-y-2">
        <p className="text-[16px] font-bold text-[var(--foreground)]">{say("lc_step2")}</p>
        {code ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-xl bg-white px-4 py-2 font-mono text-[20px] font-bold tracking-wider text-[var(--foreground)]">{code}</span>
              <button
                className="secondary-action pressable"
                onClick={() => {
                  navigator.clipboard
                    ?.writeText(code)
                    .then(() => setCopied(true))
                    .catch(() => null);
                }}
                type="button"
              >
                {copied ? say("copied") : say("copy")}
              </button>
              <a className="primary-action pressable" href={sendUrl} rel="noreferrer" target="_blank">
                {say("lc_send")}
              </a>
            </div>
            <p className="font-medium text-[var(--foreground-secondary)]">{say("lc_sendBody", { account: oa })}</p>
          </>
        ) : (
          <button className="primary-action pressable" disabled={isPending} onClick={getCode} type="button">
            {isPending ? say("lc_creating") : say("lc_getCode")}
          </button>
        )}
        {failed ? <p className="font-bold text-[var(--danger)]">{say("lc_failed")}</p> : null}
      </div>
    </div>
  );
}
