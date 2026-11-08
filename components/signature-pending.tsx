"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PenLine } from "lucide-react";
import { resendInspectionSignatureLink } from "@/app/actions/inspection-signing";
import { isActionFailure } from "@/lib/action-result";

/** A handover or return report the customer hasn't signed yet (lib/inspection-signature.ts), with "Resend signature link". */
export function SignaturePending({ inspectionId }: { inspectionId: string }) {
  const t = useTranslations("inspection");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--warning)]">
          <PenLine size={15} />
          {t("waitingSignature")}
        </span>
        <button
          className="secondary-action pressable min-h-9 whitespace-nowrap px-3 text-xs disabled:opacity-50"
          disabled={isPending}
          onClick={() => {
            setError("");
            startTransition(async () => {
              const result = await resendInspectionSignatureLink(inspectionId);
              if (isActionFailure(result)) setError(result.actionError);
              else if (result.sent) setSent(true);
              // No chat or email to send it on: it waits in the booking's messages for the owner to send.
              else setError(t("signatureLinkNotSent"));
            });
          }}
          type="button"
        >
          {isPending ? t("submitting") : sent ? t("signatureLinkSent") : t("resendSignatureLink")}
        </button>
      </div>
      {error ? <p className="mt-1 text-sm font-semibold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
