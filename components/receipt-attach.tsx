"use client";

import { Camera, Loader2, Paperclip } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { attachReceipt, receiptViewUrl } from "@/app/actions/receipts";
import { compressImage } from "@/lib/direct-upload-client";
import { toast } from "@/components/toast";

/** Makes a phone photo small enough to send (Vercel turns away anything over ~4.5MB before it arrives). PDFs go as they are. */
export async function smallReceipt(file: File): Promise<File> {
  if (!file.type.startsWith("image/") && !/\.(heic|heif|jpe?g|png|webp)$/i.test(file.name)) return file;
  try {
    return await compressImage(file, 2000, 0.82);
  } catch {
    return file;
  }
}

/** On an entry: see its receipt, or add one (Rory, 1 Nov 2026: "where can I upload a receipt for this transaction?"). */
export function ReceiptAttach({ transactionId, receiptDocumentId }: { transactionId: string; receiptDocumentId: string | null }) {
  const t = useTranslations("money");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [opening, setOpening] = useState(false);

  async function upload(original: File) {
    setBusy(true);
    try {
      const file = await smallReceipt(original);
      const body = new FormData();
      body.set("transactionId", transactionId);
      body.set("receipt", file, file.name || "receipt.jpg");
      const result = await attachReceipt(body);
      if (!result.ok) {
        toast({ message: result.error || t("rc_failed"), tone: "problem" });
        return;
      }
      toast({ message: t("rc_saved") });
      router.refresh();
    } catch {
      toast({ message: t("rc_failed"), tone: "problem" });
    } finally {
      setBusy(false);
    }
  }

  async function view() {
    if (!receiptDocumentId) return;
    // Opened before the wait, so phones don't block it as a pop-up.
    const tab = window.open("", "_blank");
    setOpening(true);
    const url = await receiptViewUrl(receiptDocumentId).catch(() => null);
    setOpening(false);
    if (url && tab) tab.location.href = url;
    else {
      tab?.close();
      toast({ message: t("rc_openFailed"), tone: "problem" });
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <input
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
        ref={input}
        type="file"
      />
      {receiptDocumentId ? (
        <button className="secondary-action pressable min-h-10 px-4 text-[14px]" disabled={opening} onClick={() => void view()} type="button">
          {opening ? <Loader2 className="animate-spin" size={16} /> : <Paperclip size={16} />}
          {t("rc_view")}
        </button>
      ) : null}
      <button className="secondary-action pressable min-h-10 px-4 text-[14px]" disabled={busy} onClick={() => input.current?.click()} type="button">
        {busy ? <Loader2 className="animate-spin" size={16} /> : <Camera size={16} />}
        {busy ? t("rc_saving") : receiptDocumentId ? t("rc_replace") : t("rc_add")}
      </button>
    </div>
  );
}
