"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const say = useTranslations("settingsPage") as unknown as (key: string, values?: Record<string, string>) => string;
  // What the business agrees to; the same sentence the agreement records.
  const authorisation = useTranslations("settings.contractsBranding") as unknown as (key: string) => string;
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
        setMessage({ text: say("sg_saved"), type: "success" });
        router.refresh();
      } catch {
        setMessage({ text: say("sg_failed"), type: "error" });
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
      setMessage({ text: say("sg_pick"), type: "error" });
      return;
    }
    if (!acknowledgementRef.current?.checked) {
      setMessage({ text: say("sg_tick"), type: "error" });
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
      setMessage({ text: say("sg_pick"), type: "error" });
      return;
    }
    if (!acknowledgementRef.current?.checked) {
      setMessage({ text: say("sg_tick"), type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("signature", file);
    fd.set("signature_authorisation_acknowledged", "true");
    fd.set("authorised_signatory_name", authorisedSignatoryName || "");
    fd.set("authorised_signatory_title", authorisedSignatoryTitle || "");
    submit(fd);
  }

  const fileInputClass = "max-w-full";

  const preview = signatureUrl ? (
    <img
      alt={orgName}
      className="h-12 w-32 rounded-lg border border-[var(--border)] bg-white object-contain p-2"
      src={signatureUrl}
    />
  ) : (
    <div className="flex h-12 w-32 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-light)] text-[var(--primary)]">
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
          <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{say("sg_title")}</p>
          <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("sg_body")}</p>
        </div>
      </div>
      {signatoryReady ? (
        <p className="font-medium text-[var(--foreground)]">{say("sg_as", { name: String(authorisedSignatoryName), title: String(authorisedSignatoryTitle) })}</p>
      ) : (
        <p className="rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">{say("sg_first")}</p>
      )}
      <label className="flex w-full cursor-pointer items-start gap-3 rounded-xl bg-white p-3 font-medium text-[var(--foreground)]">
        <input className="mt-0.5 h-5 w-5 shrink-0" disabled={!signatoryReady} ref={acknowledgementRef} type="checkbox" />
        <span>{authorisation("signatureAuthorisation")}</span>
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input accept="image/png,image/jpeg,image/webp" className={fileInputClass} data-keep-original disabled={!signatoryReady} ref={fileRef} type="file" />
        <button
          className="primary-action"
          disabled={isPending || !signatoryReady}
          onClick={signatureUrl ? handleReplace : undefined}
          type={signatureUrl ? "button" : "submit"}
        >
          {isPending ? say("lg_working") : signatureUrl ? say("sg_replace") : say("sg_upload")}
        </button>
        {signatureUrl ? (
          <button className="secondary-action" disabled={isPending} onClick={handleRemove} style={{ color: "var(--danger)" }} type="button">
            {say("pm_remove")}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className={`w-full font-bold ${message.type === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{message.text}</p>
      ) : null}
    </>
  );

  if (signatureUrl) {
    return <div className="flex flex-col gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5">{content}</div>;
  }

  return (
    <form className="flex flex-col gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5" onSubmit={handleUpload}>
      {content}
    </form>
  );
}
