"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Camera, Loader2 } from "lucide-react";
import { uploadCustomerDocumentQuick } from "@/app/actions/customers";
import { shownError } from "@/lib/error-text";
import { compressImage } from "@/lib/direct-upload-client";

/**
 * Passport and driving licence photos added straight from the booking (Rory, 1 Nov 2026: a rental that has
 * already started has no booking link, so there was nowhere to add them). On a phone each button opens the
 * camera or the photo library.
 */
export function QuickDocs({
  customerId,
  organizationId,
  onStatus
}: {
  customerId: string;
  organizationId: string;
  onStatus: (documentStatus: string) => void;
}) {
  const say = useTranslations("newBooking") as unknown as (key: string) => string;
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [, startTransition] = useTransition();

  function upload(category: string, file: File | undefined) {
    if (!file) return;
    setError("");
    setBusy(category);
    startTransition(async () => {
      const formData = new FormData();
      formData.set("customerId", customerId);
      formData.set("organizationId", organizationId);
      formData.set("category", category);
      formData.set("documentFile", await compressImage(file, 2000, 0.82));
      const result = await uploadCustomerDocumentQuick(formData).catch((caught) => ({ success: false, error: shownError(caught, say("docsFailed")), documentStatus: undefined }));
      setBusy("");
      if (!result.success) return setError(result.error || say("docsFailed"));
      setDone((current) => ({ ...current, [category]: true }));
      if (result.documentStatus) onStatus(result.documentStatus);
    });
  }

  const buttons = [
    { category: "passport", label: say("docsPassport") },
    { category: "driver_license", label: say("docsLicence") },
    // The third of the three a complete set needs (as on the booking link): a photo of the customer.
    { category: "selfie", label: say("docsSelfie") }
  ];

  return (
    <div className="grid grid-cols-2 gap-2 [&>label:nth-child(3)]:col-span-2">
      {buttons.map((button) => (
        <label
          // The words wrap onto a second line rather than being cut ("Driver's licen…" on a phone, final pre-release test, 8 Nov 2026).
          className={`pressable inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-[22px] border-2 px-3 py-1.5 text-center text-[15px] font-bold leading-tight ${
            done[button.category] ? "border-[var(--success)] text-[var(--success)]" : "border-[var(--primary)] bg-white text-[var(--primary)]"
          }`}
          key={button.category}
        >
          {busy === button.category ? <Loader2 className="shrink-0 animate-spin" size={18} /> : done[button.category] ? <CheckCircle2 className="shrink-0" size={18} /> : <Camera className="shrink-0" size={18} />}
          <span className="min-w-0">{button.label}</span>
          <input
            accept="image/*,application/pdf"
            className="sr-only"
            disabled={Boolean(busy)}
            onChange={(event) => {
              upload(button.category, event.target.files?.[0]);
              event.target.value = "";
            }}
            type="file"
          />
        </label>
      ))}
      {error ? <p className="col-span-2 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
