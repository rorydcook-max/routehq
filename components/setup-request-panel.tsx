"use client";

import { InfoTip } from "@/components/info-tip";
import { CheckCircle2, FileText, Loader2, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { submitSetupRequest, uploadSetupFile, type SetupFile } from "@/app/actions/setup-request";
import { compressImage } from "@/lib/direct-upload-client";

type Item = { name: string; state: "uploading" | "done" | "failed"; file?: SetupFile; preview?: string };

/**
 * "Send us your records, we'll set it up" (Rory, 2 Nov 2026): photos of the notebook or whiteboard, spreadsheets,
 * chat exports, plus a note. RoveHQ brings it all in (the AI reads it, a person checks it) and tells them when it's done.
 */
export function SetupRequestPanel() {
  const t = useTranslations("setupRequest");
  const picker = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function add(files: File[]) {
    for (const original of files.slice(0, 30 - items.length)) {
      const image = original.type.startsWith("image/");
      const preview = image ? URL.createObjectURL(original) : undefined;
      setItems((list) => [...list, { name: original.name, state: "uploading", preview }]);
      const file = image ? await compressImage(original, 2000, 0.82).catch(() => original) : original;
      const form = new FormData();
      form.set("file", file, original.name);
      const result = await uploadSetupFile(form).catch(() => ({ ok: false as const, error: "upload_failed" }));
      setItems((list) => list.map((item) => (item.name === original.name && item.state === "uploading" ? { ...item, state: result.ok ? "done" : "failed", file: result.ok ? result.file : undefined } : item)));
      if (!result.ok && result.error === "too_big") setError(t("tooBig", { name: original.name }));
    }
  }

  async function send() {
    const files = items.filter((item) => item.file).map((item) => item.file as SetupFile);
    if (!files.length && !note.trim()) return;
    setSending(true);
    setError("");
    const result = await submitSetupRequest({ note, files }).catch(() => ({ ok: false }));
    setSending(false);
    if (result.ok) setSent(true);
    else setError(t("failed"));
  }

  if (sent) {
    return (
      <div className="flex items-start gap-3 rounded-xl bg-[var(--success-light)] p-4">
        <CheckCircle2 className="mt-0.5 shrink-0 text-[var(--success)]" size={22} />
        <div>
          <p className="font-bold text-[var(--foreground)]">{t("sentTitle")}</p>
          <p className="font-medium text-[var(--foreground-secondary)]">{t("sentBody")}</p>
        </div>
      </div>
    );
  }

  const uploading = items.some((item) => item.state === "uploading");
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
      <p className="flex items-center gap-1.5 font-bold text-[var(--foreground)]">
        {t("title")}
        <InfoTip label={t("title")} text={t("body")} />
      </p>
      <input
        accept="image/*,application/pdf,.xlsx,.xls,.csv,.txt,.ics,.numbers"
        className="hidden"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files || []);
          event.target.value = "";
          if (files.length) void add(files);
        }}
        ref={picker}
        type="file"
      />
      {items.length ? (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {items.map((item, index) => (
            <li className="relative aspect-square overflow-hidden rounded-xl bg-[var(--panel-secondary)]" key={`${item.name}-${index}`}>
              {item.preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className={`h-full w-full object-cover ${item.state === "uploading" ? "opacity-50" : ""}`} src={item.preview} />
              ) : (
                <span className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-center text-[11px] font-semibold text-[var(--foreground-secondary)]">
                  <FileText size={18} />
                  <span className="line-clamp-2 break-all">{item.name}</span>
                </span>
              )}
              {item.state === "uploading" ? <Loader2 className="absolute inset-0 m-auto animate-spin text-[var(--primary)]" size={20} /> : null}
              {item.state === "failed" ? <span className="absolute inset-x-0 bottom-0 bg-[var(--danger)] text-center text-[11px] font-bold text-white">{t("notSent")}</span> : null}
              <button aria-label={t("remove")} className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white" onClick={() => setItems((list) => list.filter((_, i) => i !== index))} type="button">
                <X size={13} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <button className="secondary-action pressable mt-3 w-full justify-center" onClick={() => picker.current?.click()} type="button">
        <Paperclip size={17} />
        {items.length ? t("addMore") : t("addFiles")}
      </button>
      <label className="mt-3 block">
        <span className="font-semibold text-[var(--foreground-secondary)]">{t("noteLabel")}</span>
        <textarea className="mt-1 w-full" onChange={(event) => setNote(event.target.value)} placeholder={t("notePlaceholder")} rows={3} value={note} />
      </label>
      {error ? <p className="mt-2 font-semibold text-[var(--danger)]">{error}</p> : null}
      <button className="primary-action pressable mt-3 w-full justify-center" disabled={sending || uploading || (!items.some((item) => item.file) && !note.trim())} onClick={() => void send()} type="button">
        {sending ? <Loader2 className="animate-spin" size={18} /> : null}
        {t("send")}
      </button>
    </div>
  );
}
