"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FileUp, Loader2 } from "lucide-react";
import { chooseRoveAgreement, importContractFromChat, prepareContractImportUploads, startContractImport } from "@/app/actions/contract-import";
import { DOCX_TYPE, IMPORT_MAX_PAGES } from "@/lib/contract-import-template";
import { uploadFormFiles } from "@/lib/direct-upload-client";
import { SUPPORT_BUCKET } from "@/lib/support-shared";

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
 * "Use your own agreement" on Settings › Rental agreement (owner only). Upload a PDF, a Word file or photos of the
 * pages; RoveHQ reads it and opens the review screen. When the owner came from the chat widget with a contract
 * already sent there (?file=...), reading starts straight away.
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
  const [files, setFiles] = useState<File[]>([]);
  const [stage, setStage] = useState<"idle" | "uploading" | "reading">("idle");
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [switching, startSwitch] = useTransition();
  const startedHandoff = useRef(false);
  // Uploading is optional: while the RoveHQ agreement is in use, the form stays folded away until asked for.
  const [open, setOpen] = useState(Boolean(active || draft || handoffFile));

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

  function choose(list: FileList | null) {
    setError("");
    const picked = Array.from(list || []).map(typed);
    const single = picked.find((file) => file.type === "application/pdf" || file.type === DOCX_TYPE);
    if (single && picked.length > 1) {
      setError(say("oneFile"));
      return;
    }
    if (picked.length > IMPORT_MAX_PAGES) {
      setError(say("tooMany", { count: IMPORT_MAX_PAGES }));
      return;
    }
    setFiles(picked);
  }

  async function upload() {
    if (!files.length) return;
    setError("");
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
      setError(caught instanceof Error ? caught.message : say("error"));
      setStage("idle");
    }
  }

  const busy = stage !== "idle";

  if (!open) {
    return (
      <section className="card p-4">
        <h2 className="card-title">{say("optionalTitle")}</h2>
        <p className={`mt-1 ${soft}`}>{say("optionalBody")}</p>
        <button className="secondary-action pressable mt-3 w-full sm:w-auto" onClick={() => setOpen(true)} type="button">
          <FileUp size={18} />
          {say("optionalOpen")}
        </button>
      </section>
    );
  }

  return (
    <section className="card p-4">
      <h2 className="card-title">{active ? say("title") : say("optionalTitle")}</h2>
      {active ? (
        <>
          <p className={`mt-1 ${soft}`}>{say("activeBody", { title: active.title || say("yourAgreement") })}</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
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
              {say("goBack")}
            </button>
          </div>
        </>
      ) : (
        <p className={`mt-1 ${soft}`}>{say("body")}</p>
      )}

      {draft ? (
        <p className={`mt-3 text-sm ${soft}`}>
          {say("draftWaiting", { title: draft.title || say("yourAgreement") })}{" "}
          <button className="font-bold text-[var(--primary)] underline" onClick={() => openReview(draft.id)} type="button">
            {say("draftOpen")}
          </button>
        </p>
      ) : null}

      <div className="mt-3 space-y-3">
        <label className="block">
          <span className="font-semibold text-[var(--foreground-secondary)]">{active ? say("uploadAnother") : say("chooseLabel")}</span>
          <input
            accept={`application/pdf,.pdf,${DOCX_TYPE},.docx,image/*`}
            className="mt-1 block w-full"
            disabled={busy}
            multiple
            onChange={(event) => choose(event.target.files)}
            type="file"
          />
        </label>
        <p className={`text-sm ${soft}`}>{say("hint", { count: IMPORT_MAX_PAGES })}</p>
        {files.length ? <p className="text-sm">{files.map((file) => file.name).join(", ")}</p> : null}
        {busy ? (
          <p aria-live="polite" className="flex items-center gap-2 font-semibold" role="status">
            <Loader2 className="animate-spin" size={18} />
            {stage === "uploading" ? progress || say("uploading") : say("reading")}
          </p>
        ) : null}
        {error ? (
          <p className="font-semibold text-[var(--danger)]" role="alert">
            {error}
          </p>
        ) : null}
        <button className="primary-action pressable w-full sm:w-auto" disabled={busy || !files.length} onClick={upload} type="button">
          <FileUp size={18} />
          {say("upload")}
        </button>
      </div>
    </section>
  );
}
