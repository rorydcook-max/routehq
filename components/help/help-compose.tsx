"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, Send, X } from "lucide-react";
import { prepareSupportUploads, replySupportThread, startSupportThread } from "@/app/actions/support";
import { uploadFormFiles } from "@/lib/direct-upload-client";
import { PICKABLE_TOPICS, SUPPORT_ACCEPT, SUPPORT_BUCKET, SUPPORT_MAX_FILES, fileSizeLabel, type SupportTopic } from "@/lib/support-shared";

type Say = (key: string, values?: Record<string, string | number>) => string;

/**
 * Write to the Lokalfleet team (or, on the team page, back to a business), with files:
 * spreadsheets, photos of notebooks and registration books, PDFs. Files go straight
 * from the phone to storage, so large ones are fine.
 */
export function HelpCompose({
  mode,
  threadId,
  asTeam = false,
  initialTopic = "question",
  hints
}: {
  mode: "new" | "reply";
  threadId?: string;
  asTeam?: boolean;
  initialTopic?: SupportTopic;
  /** Extra line under the box for a topic, e.g. what the import service includes on their plan. */
  hints?: Partial<Record<SupportTopic, string>>;
}) {
  const say = useTranslations("help") as unknown as Say;
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [topic, setTopic] = useState<SupportTopic>(initialTopic);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function addFiles(list: FileList | null) {
    if (!list) return;
    // Copy the files now: clearing the input below empties the list it came in.
    const picked = Array.from(list);
    setFiles((current) => [...current, ...picked].slice(0, SUPPORT_MAX_FILES));
    if (input.current) input.current.value = "";
  }

  async function send() {
    if (busy) return;
    if (!body.trim() && !files.length) {
      setError(say("writeSomething"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("body", body);
      form.set("topic", topic);
      if (threadId) form.set("threadId", threadId);
      if (asTeam) form.set("asTeam", "1");
      files.forEach((file) => form.append("file", file));
      const ready = await uploadFormFiles(
        form,
        (requests) => prepareSupportUploads(requests, asTeam ? threadId : undefined),
        (done, total) => setProgress(say("uploading", { done, total })),
        SUPPORT_BUCKET
      );
      setProgress(null);
      const result = mode === "new" ? await startSupportThread(ready) : await replySupportThread(ready);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setFiles([]);
      if (mode === "new" && "id" in result) router.push(`/help/${result.id}`);
      else router.refresh();
    } catch (failure: any) {
      setError(failure?.message || say("sendFailed"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  const hint = hints?.[topic];
  return (
    <div className="space-y-3">
      {mode === "new" ? (
        <div>
          <p className="font-semibold text-[var(--foreground)]">{say("aboutLabel")}</p>
          <div className="chip-row mt-2 flex flex-wrap gap-2">
            {PICKABLE_TOPICS.map((value) => (
              <button
                aria-pressed={topic === value}
                className={`rounded-full border px-3.5 py-1.5 text-[15px] font-semibold ${topic === value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]"}`}
                key={value}
                onClick={() => setTopic(value)}
                type="button"
              >
                {say(`topic_${value}`)}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <label className="block">
        <span className="sr-only">{say("messageLabel")}</span>
        <textarea
          className="block min-h-[120px] w-full resize-y"
          disabled={busy}
          onChange={(event) => setBody(event.target.value)}
          placeholder={mode === "new" ? say(`placeholder_${topic}`) : asTeam ? say("placeholderTeam") : say("placeholderReply")}
          value={body}
        />
      </label>
      {hint ? <p className="rounded-xl bg-[var(--panel-secondary)] px-3.5 py-2.5 font-medium text-[var(--foreground-secondary)]">{hint}</p> : null}

      {files.length ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li className="flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] py-1 pl-3 pr-1.5 text-[14px] font-medium" key={`${file.name}-${index}`}>
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-[var(--muted)]">{fileSizeLabel(file.size)}</span>
              <button aria-label={say("removeFile", { name: file.name })} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-[var(--panel-secondary)]" disabled={busy} onClick={() => setFiles((current) => current.filter((_, at) => at !== index))} type="button">
                <X size={14} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <input accept={SUPPORT_ACCEPT} className="hidden" multiple onChange={(event) => addFiles(event.target.files)} ref={input} type="file" />
        <button className="secondary-action pressable" disabled={busy || files.length >= SUPPORT_MAX_FILES} onClick={() => input.current?.click()} type="button">
          <Paperclip size={17} />
          {say("addFiles")}
        </button>
        {/* Send stays disabled until there is something to send: words or a file. */}
        <button className="primary-action pressable disabled:opacity-40" disabled={busy || (!body.trim() && !files.length)} onClick={send} type="button">
          <Send size={17} />
          {busy ? progress || say("sending") : mode === "new" ? say("send") : say("sendReply")}
        </button>
      </div>
      {mode === "new" ? <p className="text-[14px] font-medium text-[var(--muted)]">{say("filesHint", { max: SUPPORT_MAX_FILES })}</p> : null}
      {error ? <p className="font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
