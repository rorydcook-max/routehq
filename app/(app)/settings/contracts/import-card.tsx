"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileUp, Loader2 } from "lucide-react";
import { chooseRoveAgreement, importContractFromChat, prepareContractImportUploads as prepareContractImportUploadsAction, startContractImport } from "@/app/actions/contract-import";
import { InfoTip } from "@/components/info-tip";
import { DOCX_TYPE, IMPORT_MAX_PAGES } from "@/lib/contract-import-template";
import { uploadFormFiles } from "@/lib/direct-upload-client";
import { SUPPORT_BUCKET } from "@/lib/support-shared";
import { unwrap } from "@/lib/action-result";
import { shownError } from "@/lib/error-text";

// A save that fails hands back its reason (lib/action-error.ts); these throw it, for the catch blocks below to show.
const prepareContractImportUploads = (...args: Parameters<typeof prepareContractImportUploadsAction>) => unwrap(prepareContractImportUploadsAction(...args));

type Say = (key: string, values?: Record<string, string | number>) => string;
const soft = "font-medium text-[var(--foreground-secondary)]";

/** Some phones and Windows give a Word file no type; the name says what it is, and the server checks the type. */
function typed(file: File) {
  if (file.type) return file;
  if (/\.docx$/i.test(file.name)) return new File([file], file.name, { type: DOCX_TYPE });
  if (/\.pdf$/i.test(file.name)) return new File([file], file.name, { type: "application/pdf" });
  return file;
}

/**
 * The side panel of Settings › Rental agreement (owner only, Rory 3 Nov 2026): "Have your own contract? Upload it".
 * Choosing the file starts the upload; RoveHQ reads it and opens the review screen. While the owner's own agreement
 * is in use, the panel says so, with "Review or edit it" and "Go back to the RoveHQ agreement". When the owner came
 * from the chat widget with a contract already sent there (?file=...), reading starts straight away.
 */
export function ContractImportCard({
  active,
  draft,
  handoffFile
}: {
  active: { id: string; title: string } | null;
  draft: { id: string; title: string } | null;
  handoffFile: string | null;
}) {
  const say = useTranslations("contractImport") as unknown as Say;
  const router = useRouter();
  const [stage, setStage] = useState<"idle" | "uploading" | "reading">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [switching, startSwitch] = useTransition();
  const startedHandoff = useRef(false);
  const input = useRef<HTMLInputElement>(null);

  function openReview(id: string) {
    router.push(`/settings/contracts/import/${id}` as Route);
  }

  // The chat handed over a file: read it once (a ref, so React's double effect in development doesn't read it twice).
  useEffect(() => {
    if (!handoffFile || startedHandoff.current) return;
    startedHandoff.current = true;
    setStage("reading");
    importContractFromChat(handoffFile)
      .then((result) => {
        if (result.ok) openReview(result.id);
        else {
          setError(result.error);
          setStage("idle");
        }
      })
      .catch(() => {
        setError(say("error"));
        setStage("idle");
      });
  }, [handoffFile]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Checks the picked files, then uploads them straight away (one tap: pick the file, RoveHQ reads it). */
  async function choose(list: FileList | null) {
    setError("");
    const files = Array.from(list || []).map(typed);
    if (input.current) input.current.value = "";
    if (!files.length) return;
    const single = files.find((file) => file.type === "application/pdf" || file.type === DOCX_TYPE);
    if (single && files.length > 1) return setError(say("oneFile"));
    if (files.length > IMPORT_MAX_PAGES) return setError(say("tooMany", { count: IMPORT_MAX_PAGES }));
    setStage("uploading");
    try {
      const form = new FormData();
      files.forEach((file) => form.append("file", file));
      const uploaded = await uploadFormFiles(form, prepareContractImportUploads, (done, total) => setProgress(say("uploadingCount", { done, total })), SUPPORT_BUCKET);
      setStage("reading");
      const result = await startContractImport(uploaded);
      if (result.ok) openReview(result.id);
      else {
        setError(result.error);
        setStage("idle");
      }
    } catch (caught) {
      setError(shownError(caught, say("error")));
      setStage("idle");
    }
  }

  const busy = stage !== "idle";
  const picker = (
    <input
      accept={`application/pdf,.pdf,${DOCX_TYPE},.docx,image/*`}
      className="sr-only"
      disabled={busy}
      multiple
      onChange={(event) => choose(event.target.files)}
      ref={input}
      tabIndex={-1}
      type="file"
    />
  );

  return (
    <section className="card p-4" aria-live="polite">
      {active ? (
        <>
          <h2 className="card-title">{say("activeTitle")}</h2>
          <p className={`mt-1 ${soft}`}>{say("activeShort", { title: active.title || say("yourAgreement") })}</p>
          <div className="mt-3 flex flex-col gap-2">
            <button className="secondary-action pressable" onClick={() => openReview(active.id)} type="button">
              {say("review")}
            </button>
            <button
              className="secondary-action pressable"
              disabled={switching}
              onClick={() =>
                startSwitch(async () => {
                  const result = await chooseRoveAgreement();
                  if (!result.ok) setError(result.error);
                  router.refresh();
                })
              }
              type="button"
            >
              {switching ? <Loader2 className="animate-spin" size={18} /> : null}
              {say("goBack")}
            </button>
          </div>
        </>
      ) : (
        <>
          <h2 className="card-title flex items-center gap-1.5">
            {say("panelTitle")}
            <InfoTip label={say("panelTitle")} text={say("hint", { count: IMPORT_MAX_PAGES })} />
          </h2>
        </>
      )}

      {busy ? (
        <p className="mt-3 flex items-center gap-2 font-semibold" role="status">
          <Loader2 className="shrink-0 animate-spin" size={18} />
          {stage === "uploading" ? progress || say("uploading") : say("reading")}
        </p>
      ) : (
        <button
          className={`${active ? "mt-2 w-full px-1 font-bold text-[var(--primary)]" : "primary-action mt-3 w-full"} pressable flex min-h-11 items-center justify-center gap-1.5`}
          onClick={() => input.current?.click()}
          type="button"
        >
          <FileUp size={18} />
          {active ? say("uploadAnother") : say("panelButton")}
        </button>
      )}
      {picker}

      {draft && !busy ? (
        <p className={`mt-3 text-sm ${soft}`}>
          {say("draftShort")}{" "}
          <button className="font-bold text-[var(--primary)] underline" onClick={() => openReview(draft.id)} type="button">
            {say("draftOpen")}
          </button>
        </p>
      ) : null}

      {error ? (
        <p className="mt-3 font-semibold text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
