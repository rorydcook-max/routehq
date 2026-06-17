"use client";

import { useState, useTransition } from "react";
import { Copy, MessageCircle, RotateCcw } from "lucide-react";
import { resendBookingLink } from "@/app/actions/bookings";

const defaultAppUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");

export function BookingShareActions({
  organizationId,
  rentalId,
  currentUrl
}: {
  organizationId: string;
  rentalId: string;
  currentUrl: string | null;
}) {
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
    setMessage(copied ? "Booking link copied." : "Copy was blocked by the browser. Select the booking link above and press Ctrl+C.");
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

        if (channel === "copy") {
          const copied = await copyText(result.bookingUrl);
          setMessage(copied ? "Booking link copied and expiry extended." : "Booking link expiry extended. Copy was blocked by the browser, so select the link above and press Ctrl+C.");
          return;
        }

        if (navigator.share) {
          await navigator.share({ title: "Booking link", text: result.message, url: result.bookingUrl }).catch(() => undefined);
          setMessage("Booking link expiry extended.");
        } else if (result.whatsappUrl) {
          window.open(result.whatsappUrl, "_blank", "noopener,noreferrer");
          setMessage("Booking link expiry extended.");
        } else {
          const copied = await copyText(result.bookingUrl);
          setMessage(copied ? "Booking link copied and expiry extended." : "Booking link expiry extended. Copy was blocked by the browser, so select the link above and press Ctrl+C.");
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to resend booking link.");
      }
    });
  }

  return (
    <div className="space-y-3">
      {link ? (
        <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
          <p className="text-xs font-bold uppercase text-[#667085]">Customer booking link</p>
          <p className="mt-1 break-all text-sm font-bold text-[#10252b]">{link}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="pressable inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-black text-white disabled:opacity-70" disabled={isPending} onClick={() => resend("share")} type="button">
          {isPending ? <span className="spinner" /> : <MessageCircle size={18} />}
          Resend booking link
        </button>
        <button className="pressable inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[#d6e5e2] bg-white px-4 py-3 text-sm font-black text-[#344054] disabled:opacity-70" disabled={isPending || !link} onClick={copyCurrentLink} type="button">
          {isPending ? <RotateCcw size={18} /> : <Copy size={18} />}
          Copy link
        </button>
      </div>
      {message ? <p className="rounded-lg bg-[#eef8f6] p-3 text-sm font-bold text-[#0f766e]">{message}</p> : null}
    </div>
  );
}
