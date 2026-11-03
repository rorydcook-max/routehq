"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Lock, Paperclip, Send, X } from "lucide-react";
import { prepareHelpdeskUploads, teamReply } from "@/app/actions/helpdesk";
import { uploadFormFiles } from "@/lib/direct-upload-client";
import type { SavedReply } from "@/lib/helpdesk-replies";
import { SUPPORT_ACCEPT, SUPPORT_BUCKET, SUPPORT_MAX_FILES, fileSizeLabel } from "@/lib/support-shared";

/**
 * The team's reply box. "Reply" goes to the customer; "Internal note" stays with the team (shaded in the transcript,
 * never shown to the customer, never alerts anyone). Files go straight from the browser to storage, as on the Help
 * page, so large ones are fine. Saved replies drop a ready-made text into the box to edit before sending.
 */
export function HelpdeskComposer({ threadId, savedReplies, customerLabel, note }: { threadId: string; savedReplies: SavedReply[]; customerLabel: string; note?: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [internal, setInternal] = useState(false);
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

  function insert(reply: SavedReply) {
    setBody((current) => (current.trim() ? `${current.trimEnd()}\n\n${reply.body}` : reply.body));
  }

  async function send() {
    if (busy || (!body.trim() && !files.length)) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("threadId", threadId);
      form.set("body", body);
      if (internal) form.set("internal", "1");
      files.forEach((file) => form.append("file", file));
      const ready = await uploadFormFiles(form, (requests) => prepareHelpdeskUploads(threadId, requests), (done, total) => setProgress(`Uploading ${done} of ${total}…`), SUPPORT_BUCKET);
      setProgress(null);
      const result = await teamReply(ready);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBody("");
      setFiles([]);
      router.refresh();
    } catch (failure: any) {
      setError(failure?.message || "Could not send. Please try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Message type">
        <button aria-checked={!internal} className={`pressable inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold ${!internal ? "bg-[var(--primary)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)]"}`} onClick={() => setInternal(false)} role="radio" type="button">
          <Send size={14} />
          Reply to {customerLabel}
        </button>
        <button aria-checked={internal} className={`pressable inline-flex min-h-9 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-bold ${internal ? "bg-[var(--warning)] text-white" : "bg-white text-[var(--foreground-secondary)] shadow-[0_0_0_1px_var(--border)]"}`} onClick={() => setInternal(true)} role="radio" type="button">
          <Lock size={14} />
          Internal note
        </button>
      </div>

      <label className="block">
        <span className="sr-only">{internal ? "Internal note" : "Reply"}</span>
        <textarea
          className={`block min-h-[130px] w-full resize-y ${internal ? "bg-[var(--warning-light)]" : ""}`}
          disabled={busy}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            // Ctrl/Cmd + Enter sends, for the team answering many conversations.
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void send();
            }
          }}
          placeholder={internal ? "Only the RoveHQ team sees this." : `Write to ${customerLabel}…`}
          value={body}
        />
      </label>
      {internal ? <p className="text-[14px] font-semibold text-[var(--warning)]">Internal note: never shown to the customer and nobody is alerted.</p> : note ? <p className="text-[14px] font-medium text-[var(--muted)]">{note}</p> : null}

      {files.length ? (
        <ul className="flex flex-wrap gap-2">
          {files.map((file, index) => (
            <li className="flex max-w-full items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--panel)] py-1 pl-3 pr-1.5 text-[14px] font-medium" key={`${file.name}-${index}`}>
              <span className="truncate">{file.name}</span>
              <span className="shrink-0 text-[var(--muted)]">{fileSizeLabel(file.size)}</span>
              <button aria-label={`Remove ${file.name}`} className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-[var(--panel-secondary)]" disabled={busy} onClick={() => setFiles((current) => current.filter((_, at) => at !== index))} type="button">
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
          Add files
        </button>
        {savedReplies.length ? (
          <label className="min-w-0">
            <span className="sr-only">Insert a saved reply</span>
            {/* A select resets to its label after each pick, so the same reply can be inserted again. */}
            <select
              className="min-h-10 max-w-[14rem]"
              disabled={busy}
              onChange={(event) => {
                const reply = savedReplies.find((item) => item.id === event.target.value);
                if (reply) insert(reply);
                event.target.value = "";
              }}
              value=""
            >
              <option value="">Saved replies…</option>
              {savedReplies.map((reply) => (
                <option key={reply.id} value={reply.id}>
                  {reply.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button className={`${internal ? "secondary-action" : "primary-action"} pressable ml-auto disabled:opacity-40`} disabled={busy || (!body.trim() && !files.length)} onClick={send} type="button">
          {internal ? <Lock size={17} /> : <Send size={17} />}
          {busy ? progress || "Sending…" : internal ? "Save note" : "Send reply"}
        </button>
      </div>
      {error ? <p className="font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
