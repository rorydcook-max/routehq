"use client";

import { InfoTip } from "@/components/info-tip";
import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { updateOwnerSignature as updateOwnerSignatureAction } from "@/app/actions/settings";
import { SignaturePad } from "@/components/signature-pad";
import { unwrap } from "@/lib/action-result";
import { shownError } from "@/lib/error-text";

// A save that fails hands back its reason (lib/action-error.ts); these throw it, for the catch blocks below to show.
const updateOwnerSignature = (...args: Parameters<typeof updateOwnerSignatureAction>) => unwrap(updateOwnerSignatureAction(...args));

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
      } catch (caught) {
        setMessage({ text: shownError(caught, say("sg_failed")), type: "error" });
      }
    });
  }

  function handleRemove() {
    setJustSaved("");
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

  // The drawn signature, saved as a PNG the same way an uploaded one is.
  const [drawn, setDrawn] = useState("");
  const [padKey, setPadKey] = useState(0);
  // The signature just saved shows straight away, before the page's own copy is fetched again.
  const [justSaved, setJustSaved] = useState("");
  const router = useRouter();
  function saveDrawn() {
    if (!acknowledgementRef.current?.checked) {
      setMessage({ text: say("sg_tick"), type: "error" });
      return;
    }
    if (!drawn) {
      setMessage({ text: say("sig_needSignature"), type: "error" });
      return;
    }
    startTransition(async () => {
      try {
        const blob = await (await fetch(drawn)).blob();
        const fd = new FormData();
        fd.set("signature", new File([blob], "signature.png", { type: "image/png" }));
        fd.set("signature_authorisation_acknowledged", "true");
        fd.set("authorised_signatory_name", authorisedSignatoryName || "");
        fd.set("authorised_signatory_title", authorisedSignatoryTitle || "");
        await updateOwnerSignature(fd);
        setMessage({ text: say("sg_saved"), type: "success" });
        setJustSaved(drawn);
        setReplacing(false);
        setDrawn("");
        router.refresh();
        setPadKey((value) => value + 1);
      } catch (caught) {
        setMessage({ text: shownError(caught, say("sg_failed")), type: "error" });
      }
    });
  }

  function picked() {
    if (!fileRef.current?.files?.[0]) return;
    setJustSaved(URL.createObjectURL(fileRef.current.files[0]));
    handleReplace();
    fileRef.current.value = "";
  }

  const preview = signatureUrl || justSaved ? (
    <img
      alt={orgName}
      className="stay-light h-16 w-40 shrink-0 rounded-xl bg-white object-contain p-2 ring-1 ring-[var(--border)]"
      src={justSaved || signatureUrl || ""}
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
      {/* Phones: the title and its line first, the signature under them, so the words aren't squeezed into a narrow column. */}
      <div className="flex flex-col-reverse items-start gap-3 sm:flex-row sm:items-center">
        {preview}
        <div className="min-w-0">
          <h2 className="card-title flex items-center gap-1.5">
            {say("sg_title")}
            <InfoTip label={say("sg_title")} text={say("sg_body")} />
          </h2>
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
      {/* Signed with a finger (or the mouse) right here; a photo of a paper signature is the other way (Rory, 1 Nov 2026). */}
      {(!signatureUrl || replacing) && signatoryReady ? (
        <div className="stay-light w-full max-w-md">
          <SignaturePad clearLabel={say("sig_clear")} hint={say("sig_hint")} key={padKey} onChange={setDrawn} />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <input accept="image/png,image/jpeg,image/webp" className="sr-only" data-keep-original disabled={!signatoryReady} onChange={picked} ref={fileRef} tabIndex={-1} type="file" />
        {!signatureUrl || replacing ? (
          <>
            <button className="primary-action whitespace-nowrap" disabled={isPending || !signatoryReady} onClick={saveDrawn} type="button">
              {isPending ? say("lg_working") : say("sig_save")}
            </button>
            <button className="secondary-action whitespace-nowrap" disabled={isPending || !signatoryReady} onClick={choose} type="button">
              {say("sig_usePhoto")}
            </button>
          </>
        ) : (
          <button className="primary-action whitespace-nowrap" disabled={isPending || !signatoryReady} onClick={choose} type="button">
            {say("sg_replace")}
          </button>
        )}
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
