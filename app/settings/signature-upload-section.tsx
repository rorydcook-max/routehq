"use client";

import { useRef, useState, useTransition } from "react";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const acknowledgementRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateOwnerSignature(formData);
        setMessage({ text: say("sg_saved"), type: "success" });
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

  // With a signature already approved, the authorisation box only appears once Replace is pressed:
  // an unticked box next to "approved for use on …" looked like the approval was missing.
  const [replacing, setReplacing] = useState(false);

  function choose() {
    if (signatureUrl && !replacing) {
      setReplacing(true);
      return;
    }
    if (!acknowledgementRef.current?.checked) {
      setMessage({ text: say("sg_tick"), type: "error" });
      return;
    }
    fileRef.current?.click();
  }

  function picked() {
    if (!fileRef.current?.files?.[0]) return;
    handleReplace();
    fileRef.current.value = "";
  }

  const preview = signatureUrl ? (
    <img
      alt={orgName}
      className="stay-light h-16 w-40 shrink-0 rounded-xl bg-white object-contain p-2 ring-1 ring-[var(--border)]"
      src={signatureUrl}
    />
  ) : (
    <div aria-hidden="true" className="flex h-16 w-40 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-white text-sm font-semibold text-[var(--muted)]">
      {say("b_signature")}
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
          <h2 className="card-title">{say("sg_title")}</h2>
          <p className="mt-0.5 text-sm font-medium text-[var(--foreground-secondary)]">{say("sg_body")}</p>
        </div>
      </div>
      {signatoryReady ? (
        <p className="font-medium text-[var(--foreground)]">{say("sg_as", { name: String(authorisedSignatoryName), title: String(authorisedSignatoryTitle) })}</p>
      ) : (
        <p className="rounded-xl bg-[var(--warning-light)] px-4 py-3 font-medium text-[var(--foreground)]">{say("sg_first")}</p>
      )}
      {!signatureUrl || replacing ? (
        <label className="flex w-full cursor-pointer items-start gap-3 rounded-2xl bg-[var(--panel-secondary)] p-3.5 font-medium text-[var(--foreground)]">
          <input className="mt-0.5 h-5 w-5 shrink-0" disabled={!signatoryReady} ref={acknowledgementRef} type="checkbox" />
          <span>{authorisation("signatureAuthorisation")}</span>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input accept="image/png,image/jpeg,image/webp" className="sr-only" data-keep-original disabled={!signatoryReady} onChange={picked} ref={fileRef} tabIndex={-1} type="file" />
        <button className="primary-action whitespace-nowrap" disabled={isPending || !signatoryReady} onClick={choose} type="button">
          {isPending ? say("lg_working") : signatureUrl && !replacing ? say("sg_replace") : say("sg_upload")}
        </button>
        {signatureUrl && replacing ? (
          <button className="secondary-action" disabled={isPending} onClick={() => setReplacing(false)} type="button">
            {say("sg_keep")}
          </button>
        ) : signatureUrl ? (
          <button className="pressable min-h-11 rounded-full px-3 font-bold text-[var(--danger)] hover:bg-[var(--danger-light)]" disabled={isPending} onClick={handleRemove} type="button">
            {say("pm_remove")}
          </button>
        ) : null}
      </div>
      {message ? (
        <p className={`w-full font-bold ${message.type === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{message.text}</p>
      ) : null}
    </>
  );

  // Sits straight inside its card (no inset panel), so its title lines up with the other card titles.
  if (signatureUrl) {
    return <div className="flex flex-col gap-3">{content}</div>;
  }

  return (
    <form method="post" className="flex flex-col gap-3" onSubmit={handleUpload}>
      {content}
    </form>
  );
}
