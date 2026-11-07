"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, Star } from "lucide-react";
import { requestRentalReview } from "@/app/actions/reviews";

const buttonClass =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-full border-2 border-[var(--border-strong)] bg-white px-3 py-2 text-center font-bold leading-tight text-[var(--foreground)] disabled:opacity-60";

async function copyText(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Some embedded browsers deny Clipboard API writes; fall back below.
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}

/**
 * "Ask for a review" on a returned rental (Rory, 7 Nov 2026): sends the review link on the renter's usual channel
 * (lib/customer-messages.ts) and "Copy link" for sending it by hand. Both make the link if the daily job hasn't.
 * Rendered straight into the booking's "More" button grid, so each control is a direct <button>.
 */
export function ReviewRequestButtons({ rentalId, initialUrl }: { rentalId: string; initialUrl: string | null }) {
  const say = useTranslations("booking") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [url, setUrl] = useState(initialUrl);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<"ask" | "copy" | null>(null);
  const [, startTransition] = useTransition();

  function ask() {
    setError("");
    setBusy("ask");
    startTransition(async () => {
      const result = await requestRentalReview(rentalId, true);
      setBusy(null);
      if (!result.ok) return setError(result.error);
      setUrl(result.url);
      setSent(result.sent);
    });
  }

  async function copy() {
    setError("");
    let link = url;
    if (!link) {
      setBusy("copy");
      const result = await requestRentalReview(rentalId, false);
      setBusy(null);
      if (!result.ok) return setError(result.error);
      link = result.url;
      setUrl(link);
    }
    if (await copyText(link)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setError(say("share_copyBlocked"));
    }
  }

  return (
    <>
      <button className={buttonClass} disabled={busy !== null || sent} onClick={ask} title={error || undefined} type="button">
        <Star aria-hidden="true" className="h-4 w-4" />
        {busy === "ask" ? say("sending") : sent ? say("review_sent") : say("review_ask")}
      </button>
      <button className={buttonClass} disabled={busy !== null} onClick={copy} title={error || undefined} type="button">
        <Copy aria-hidden="true" className="h-4 w-4" />
        {copied ? say("al_copied") : say("share_copy")}
      </button>
      {error ? (
        <p className="col-span-2 text-xs font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
