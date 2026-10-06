"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Copy, MessageCircle, RotateCcw } from "lucide-react";
import { resendBookingLink } from "@/app/actions/bookings";

const defaultAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function BookingShareActions({
  organizationId,
  rentalId,
  currentUrl,
  formDone = false
}: {
  organizationId: string;
  rentalId: string;
  currentUrl: string | null;
  /** The customer has finished the booking form, so the link is now their own page (payments, extending, returning). */
  formDone?: boolean;
}) {
  const say = useTranslations("booking") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const [message, setMessage] = useState("");
  const [link, setLink] = useState(currentUrl || "");
  const [isPending, startTransition] = useTransition();

  async function copyText(text: string) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Some embedded browsers deny Clipboard API writes even from a click.
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    textarea.style.top = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();

    try {
      return document.execCommand("copy");
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }

  async function copyCurrentLink() {
    if (!link) {
      resend("copy");
      return;
    }

    const copied = await copyText(link);
    setMessage(copied ? say("share_copied") : say("share_copyBlocked"));
  }

  function resend(channel: "share" | "copy") {
    setMessage("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("organizationId", organizationId);
        formData.set("rentalId", rentalId);
        formData.set("baseUrl", defaultAppUrl || window.location.origin);
        const result = await resendBookingLink(formData);
        setLink(result.bookingUrl);
        const done = result.created ? say("share_created") : say("share_renewed");
        const copyBlocked = ` ${say("share_blockedShort")}`;

        if (channel === "copy") {
          const copied = await copyText(result.bookingUrl);
          setMessage(copied ? `${done} ${say("share_copiedShort")}` : `${done}${copyBlocked}`);
          return;
        }

        if (navigator.share) {
          await navigator.share({ title: say("share_title"), text: result.message, url: result.bookingUrl }).catch(() => undefined);
          setMessage(done);
        } else if (result.whatsappUrl) {
          window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
          setMessage(done);
        } else {
          const copied = await copyText(result.bookingUrl);
          setMessage(copied ? `${done} ${say("share_copiedShort")}` : `${done}${copyBlocked}`);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : say("share_failed"));
      }
    });
  }

  return (
    <div className="space-y-3">
      {link ? (
        <div className="rounded-lg border border-[var(--border)] bg-white p-3">
          <p className="text-xs font-bold uppercase text-[var(--muted)]">{formDone ? say("share_pageLabel") : say("share_linkLabel")}</p>
          <p className="mt-1 break-all text-sm font-bold text-[var(--foreground)]">{link}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className={`pressable inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold disabled:opacity-70 ${formDone ? "border border-[var(--border)] bg-white text-[var(--foreground-secondary)]" : "bg-[var(--primary)] text-white"}`} disabled={isPending} onClick={() => resend("share")} type="button">
          {isPending ? <span className="spinner" /> : <MessageCircle size={18} />}
          {!link ? say("share_create") : formDone ? say("share_sendPage") : say("share_resend")}
        </button>
        <button className="pressable inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-sm font-semibold text-[var(--foreground-secondary)] disabled:opacity-70" disabled={isPending || !link} onClick={copyCurrentLink} type="button">
          {isPending ? <RotateCcw size={18} /> : <Copy size={18} />}
          {say("share_copy")}
        </button>
      </div>
      {message ? <p className="rounded-lg bg-[#fbfaf8] p-3 text-sm font-bold text-[var(--primary)]">{message}</p> : null}
    </div>
  );
}
