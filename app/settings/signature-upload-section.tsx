"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerSignature } from "@/app/actions/settings";
import { SIGNATURE_AUTHORISATION_TEXT } from "@/lib/signature-authorisation";

export function SignatureUploadSection({
  authorisedSignatoryName,
  authorisedSignatoryTitle,
  signatureUrl,
  orgName
}: {
  authorisedSignatoryName?: string | null;
  authorisedSignatoryTitle?: string | null;
  signatureUrl: string | null | undefined;
  orgName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const acknowledgementRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateOwnerSignature(formData);
        setMessage({ text: "Signature saved. All new contracts will be auto-signed.", type: "success" });
        router.refresh();
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : "Failed to update signature.", type: "error" });
      }
    });
  }

  function handleRemove() {
    const fd = new FormData();
    fd.set("remove_signature", "true");
    submit(fd);
  }

  function handleReplace() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ text: "Please select an image file.", type: "error" });
      return;
    }
    if (!acknowledgementRef.current?.checked) {
      setMessage({ text: "Please accept the signature authorisation before saving a new signature.", type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("signature", file);
    fd.set("signature_authorisation_acknowledged", "true");
    fd.set("authorised_signatory_name", authorisedSignatoryName || "");
    fd.set("authorised_signatory_title", authorisedSignatoryTitle || "");
    submit(fd);
  }

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ text: "Please select an image file.", type: "error" });
      return;
    }
    if (!acknowledgementRef.current?.checked) {
      setMessage({ text: "Please accept the signature authorisation before saving a new signature.", type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("signature", file);
    fd.set("signature_authorisation_acknowledged", "true");
    fd.set("authorised_signatory_name", authorisedSignatoryName || "");
    fd.set("authorised_signatory_title", authorisedSignatoryTitle || "");
    submit(fd);
  }

  const fileInputClass = "max-w-52 text-xs text-[#667085] file:mr-2 file:rounded-lg file:border-0 file:bg-[#ecfeff] file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-[#0e7490]";

  const preview = signatureUrl ? (
    <img
      alt={`${orgName} operator signature`}
      className="h-12 w-32 rounded-lg border border-[var(--border)] bg-white object-contain p-2"
      src={signatureUrl}
    />
  ) : (
    <div className="flex h-12 w-32 shrink-0 items-center justify-center rounded-lg bg-[#ecfeff] text-[#0e7490]">
      <span className="ti ti-signature text-lg" aria-hidden="true" />
    </div>
  );

  // The signature is recorded as the saved signatory's, so their name and
  // title must be saved first.
  const signatoryReady = Boolean(authorisedSignatoryName?.trim() && authorisedSignatoryTitle?.trim());

  const content = (
    <>
      <div className="flex items-center gap-3">
        {preview}
        <div className="min-w-0">
          <p className="text-[13px] font-bold text-[#172026]">Authorised signature</p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">
            Applied automatically to each agreement when a customer signs online. PNG, JPG or WebP, max 2 MB.
          </p>
        </div>
      </div>
      {signatoryReady ? (
        <p className="text-[11px] leading-4 text-[#344054]">
          Signing as <strong>{authorisedSignatoryName}</strong>, {authorisedSignatoryTitle}.
        </p>
      ) : (
        <p className="rounded-lg border border-[#fbbf24] bg-[#fffbeb] p-2 text-[11px] font-bold leading-4 text-[#92400e]">
          First save the authorised signatory&apos;s full name and job title above. The signature is recorded as theirs.
        </p>
      )}
      <label className="flex w-full items-start gap-2 rounded-lg border border-[#d6e5e2] bg-white p-2 text-[11px] leading-4 text-[#344054]">
        <input className="mt-0.5 shrink-0" disabled={!signatoryReady} ref={acknowledgementRef} type="checkbox" />
        <span>{SIGNATURE_AUTHORISATION_TEXT}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input accept="image/png,image/jpeg,image/webp" className={fileInputClass} data-keep-original disabled={!signatoryReady} ref={fileRef} type="file" />
        <button
          className="primary-action"
          disabled={isPending || !signatoryReady}
          onClick={signatureUrl ? handleReplace : undefined}
          type={signatureUrl ? "button" : "submit"}
        >
          {isPending ? "Uploading..." : signatureUrl ? "Replace signature" : "Upload signature"}
        </button>
        {signatureUrl ? (
          <button className="secondary-action" disabled={isPending} onClick={handleRemove} type="button">
            {isPending ? "Removing..." : "Remove"}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className={`w-full text-xs ${message.type === "error" ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{message.text}</p>
      ) : null}
    </>
  );

  if (signatureUrl) {
    return <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3">{content}</div>;
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3" onSubmit={handleUpload}>
      {content}
    </form>
  );
}
