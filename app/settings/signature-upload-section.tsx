"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateOwnerSignature } from "@/app/actions/settings";

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

  const content = (
    <>
      <div className="flex items-center gap-3">
        {preview}
        <div>
          <p className="text-[13px] font-bold text-[#172026]">Operator signature</p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">Auto-applied to all contracts. PNG, JPG, SVG or WebP, max 2MB.</p>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        {signatureUrl ? (
          <button className="secondary-action w-full sm:w-auto" disabled={isPending} onClick={handleRemove} type="button">
            {isPending ? "Removing..." : "Remove"}
          </button>
        ) : null}
        <input accept="image/png,image/jpeg,image/webp" className={fileInputClass} ref={fileRef} type="file" />
        <button className="primary-action w-full sm:w-auto" disabled={isPending} onClick={signatureUrl ? handleReplace : undefined} type={signatureUrl ? "button" : "submit"}>
          {isPending ? "Uploading..." : signatureUrl ? "Replace" : "Upload signature"}
        </button>
      </div>
      <label className="flex w-full items-start gap-2 rounded-lg border border-[#d6e5e2] bg-white p-2 text-[11px] leading-4 text-[#344054]">
        <input className="mt-0.5" ref={acknowledgementRef} type="checkbox" />
        <span>
          I authorise this electronic signature to be applied to rental agreements and related rental documents issued by this business through authorised users of this RouteHQ account.
        </span>
      </label>
      {message ? (
        <p className={`w-full text-xs ${message.type === "error" ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{message.text}</p>
      ) : null}
    </>
  );

  if (signatureUrl) {
    return <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:flex-row sm:items-center sm:justify-between">{content}</div>;
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:flex-row sm:items-center sm:justify-between" onSubmit={handleUpload}>
      {content}
    </form>
  );
}
