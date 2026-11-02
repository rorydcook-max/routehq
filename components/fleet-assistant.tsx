"use client";

import { Camera, Check, Loader2, Mic, Send, Sparkles, Square, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { addAssistantVehicles, askFleetAssistant, type AssistantTurn, type DraftVehicle } from "@/app/actions/fleet-assistant";
import { uploadVehiclePhotos } from "@/app/actions/vehicles";
import { compressImage } from "@/lib/direct-upload-client";

type Photo = { file: File; url: string };

/** Speech to text in the browser's own engine, in the person's language. */
const SPEECH_LANG: Record<string, string> = {
  en: "en-GB", th: "th-TH", de: "de-DE", es: "es-ES", fr: "fr-FR", fil: "fil-PH", he: "he-IL", hi: "hi-IN", id: "id-ID", ja: "ja-JP", ko: "ko-KR",
  lo: "lo-LA", ms: "ms-MY", my: "my-MM", nb: "nb-NO", pt: "pt-PT", ru: "ru-RU", si: "si-LK", sv: "sv-SE", ta: "ta-IN", vi: "vi-VN", zh: "zh-CN", "zh-TW": "zh-TW"
};

function toDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Add vehicles by talking to an assistant (Rory, 2 Nov 2026): type, speak or send photos; it keeps a list; one tap adds them,
 * photos included. Nothing is saved until Add is tapped.
 */
export function FleetAssistant({ organizationId, currency = "THB", onAdded }: { organizationId: string; currency?: string; onAdded?: (count: number) => void }) {
  const t = useTranslations("fleetAssistant");
  const locale = useLocale();
  const [turns, setTurns] = useState<AssistantTurn[]>([]);
  const [shownTurns, setShownTurns] = useState<Array<AssistantTurn & { photos?: string[] }>>([{ role: "assistant", text: t("hello") }]);
  const [draft, setDraft] = useState<DraftVehicle[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [pending, setPending] = useState<Photo[]>([]);
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [adding, setAdding] = useState(false);
  const [listening, setListening] = useState(false);
  const [speechOk, setSpeechOk] = useState(false);
  const recognition = useRef<any>(null);
  const picker = useRef<HTMLInputElement>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSpeechOk(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [shownTurns, thinking]);

  const money = (value?: number | null) => (value ? `${currency === "THB" ? "฿" : `${currency} `}${Math.round(value).toLocaleString("en-US")}` : "");

  async function pick(files: File[]) {
    const room = 4 - pending.length;
    const added: Photo[] = [];
    for (const original of files.slice(0, Math.max(0, room))) {
      const file = await compressImage(original, 1600, 0.78).catch(() => original);
      added.push({ file, url: URL.createObjectURL(file) });
    }
    setPending((list) => [...list, ...added]);
  }

  async function send() {
    const message = text.trim();
    if ((!message && pending.length === 0) || thinking) return;
    const sending = pending;
    const userTurn: AssistantTurn = { role: "user", text: message || t("photosOnly") };
    const nextTurns = [...turns, userTurn];
    setShownTurns((list) => [...list, { ...userTurn, photos: sending.map((photo) => photo.url) }]);
    setText("");
    setPending([]);
    setThinking(true);
    // The model sees smaller copies; the full photos are kept for the vehicles.
    const images = await Promise.all(sending.map(async (photo) => toDataUrl(await compressImage(photo.file, 1024, 0.7).catch(() => photo.file)))).catch(() => [] as string[]);
    const result = await askFleetAssistant({ turns: nextTurns, images, photosBefore: photos.length, draft, locale }).catch(() => ({ ok: false as const, error: "failed" }));
    setPhotos((list) => [...list, ...sending]);
    setThinking(false);
    if (!result.ok) {
      setShownTurns((list) => [...list, { role: "assistant", text: result.error === "unavailable" ? t("unavailable") : t("failed") }]);
      setTurns(nextTurns);
      return;
    }
    setTurns([...nextTurns, { role: "assistant", text: result.reply }]);
    setShownTurns((list) => [...list, { role: "assistant", text: result.reply }]);
    setDraft(result.draft);
  }

  function toggleMic() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Engine = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Engine) return;
    const engine = new Engine();
    engine.lang = SPEECH_LANG[locale] || "en-GB";
    engine.interimResults = true;
    engine.continuous = true;
    const before = text ? `${text.trim()} ` : "";
    engine.onresult = (event: any) => {
      let heard = "";
      for (let i = 0; i < event.results.length; i++) heard += event.results[i][0].transcript;
      setText(before + heard);
    };
    engine.onend = () => setListening(false);
    engine.onerror = () => setListening(false);
    recognition.current = engine;
    setListening(true);
    engine.start();
  }

  async function addAll() {
    const ready = draft.filter((vehicle) => vehicle.make && vehicle.model);
    if (!ready.length || adding) return;
    setAdding(true);
    const result = await addAssistantVehicles(ready).catch(() => ({ ok: false as const, error: "add_failed", ids: [] as string[] }));
    // Each vehicle's photos, one at a time (a phone photo per request stays well under the size limit).
    for (let index = 0; index < result.ids.length; index++) {
      const numbers = ready[index]?.photos || [];
      for (const number of numbers) {
        const photo = photos[number - 1];
        if (!photo) continue;
        const form = new FormData();
        form.set("vehicleId", result.ids[index]);
        form.set("organizationId", organizationId);
        form.append("vehiclePhotos", photo.file, photo.file.name || "photo.jpg");
        await uploadVehiclePhotos(form).catch(() => null);
      }
    }
    setAdding(false);
    const count = result.ids.length;
    if (count) {
      setDraft((list) => list.filter((vehicle) => !ready.includes(vehicle)));
      setShownTurns((list) => [...list, { role: "assistant", text: t("added", { count }) }]);
      onAdded?.(count);
    }
    if (!result.ok) setShownTurns((list) => [...list, { role: "assistant", text: t("addFailed") }]);
  }

  const readyCount = draft.filter((vehicle) => vehicle.make && vehicle.model).length;

  return (
    <div className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
          <Sparkles size={17} />
        </span>
        <div className="min-w-0">
          <p className="font-bold leading-tight text-[var(--foreground)]">{t("title")}</p>
          <p className="text-[13px] text-[var(--muted)]">{t("subtitle")}</p>
        </div>
      </div>

      <div className="max-h-[46vh] min-h-[180px] space-y-2 overflow-y-auto px-3 py-3">
        {shownTurns.map((turn, index) => (
          <div className={`flex ${turn.role === "user" ? "justify-end" : "justify-start"}`} key={index}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-[15px] leading-snug ${turn.role === "user" ? "bg-[var(--primary)] text-white" : "bg-[var(--panel-secondary)] text-[var(--foreground)]"}`}>
              {turn.photos?.length ? (
                <div className="mb-1.5 flex gap-1">
                  {turn.photos.map((url) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img alt="" className="h-14 w-14 rounded-lg object-cover" key={url} src={url} />
                  ))}
                </div>
              ) : null}
              {turn.text}
            </div>
          </div>
        ))}
        {thinking ? (
          <div className="flex justify-start">
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--panel-secondary)] px-3.5 py-2 text-[15px] text-[var(--muted)]">
              <Loader2 className="animate-spin" size={15} />
              {t("thinking")}
            </div>
          </div>
        ) : null}
        <div ref={bottom} />
      </div>

      {draft.length ? (
        <div className="border-t border-[var(--border)] px-3 py-3">
          <p className="px-1 text-[13px] font-bold uppercase tracking-wide text-[var(--muted)]">{t("listTitle", { count: draft.length })}</p>
          <ul className="mt-2 space-y-1.5">
            {draft.map((vehicle, index) => (
              <li className="flex items-center gap-2.5 rounded-xl bg-[var(--panel-secondary)] px-3 py-2" key={index}>
                {vehicle.photos?.[0] && photos[vehicle.photos[0] - 1] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" src={photos[vehicle.photos[0] - 1].url} />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--panel)] text-[var(--muted)]">
                    <Check size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-[var(--foreground)]">{[vehicle.make, vehicle.model, vehicle.variant, vehicle.year].filter(Boolean).join(" ") || t("unnamed")}</p>
                  <p className="truncate text-[13px] text-[var(--muted)]">
                    {[vehicle.plate, vehicle.colour, vehicle.monthlyRate ? t("perMonth", { price: money(vehicle.monthlyRate) }) : vehicle.dailyRate ? t("perDay", { price: money(vehicle.dailyRate) }) : ""].filter(Boolean).join(" · ") || t("noDetails")}
                  </p>
                </div>
                <button aria-label={t("remove")} className="pressable flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--muted)]" onClick={() => setDraft((list) => list.filter((_, i) => i !== index))} type="button">
                  <X size={16} />
                </button>
              </li>
            ))}
          </ul>
          <button className="primary-action pressable mt-3 w-full justify-center" disabled={!readyCount || adding} onClick={() => void addAll()} type="button">
            {adding ? <Loader2 className="animate-spin" size={18} /> : null}
            {adding ? t("adding") : t("addButton", { count: readyCount })}
          </button>
        </div>
      ) : null}

      <div className="border-t border-[var(--border)] p-2.5">
        {pending.length ? (
          <div className="mb-2 flex gap-1.5 px-1">
            {pending.map((photo) => (
              <div className="relative" key={photo.url}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className="h-14 w-14 rounded-lg object-cover" src={photo.url} />
                <button aria-label={t("remove")} className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white" onClick={() => setPending((list) => list.filter((entry) => entry !== photo))} type="button">
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>
        ) : null}
        <input
          accept="image/*"
          className="hidden"
          multiple
          onChange={(event) => {
            const files = Array.from(event.target.files || []);
            event.target.value = "";
            if (files.length) void pick(files);
          }}
          ref={picker}
          type="file"
        />
        <div className="flex items-end gap-1.5">
          <button aria-label={t("addPhoto")} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--primary)]" disabled={pending.length >= 4} onClick={() => picker.current?.click()} type="button">
            <Camera size={19} />
          </button>
          {speechOk ? (
            <button aria-label={listening ? t("stopTalking") : t("talk")} aria-pressed={listening} className={`pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${listening ? "bg-[var(--danger)] text-white" : "bg-[var(--panel-secondary)] text-[var(--primary)]"}`} onClick={toggleMic} type="button">
              {listening ? <Square size={16} /> : <Mic size={19} />}
            </button>
          ) : null}
          <textarea
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl px-3 py-2.5 text-[15px]"
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            placeholder={listening ? t("listening") : t("placeholder")}
            rows={1}
            value={text}
          />
          <button aria-label={t("send")} className="pressable flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--primary)] text-white disabled:opacity-50" disabled={thinking || (!text.trim() && !pending.length)} onClick={() => void send()} type="button">
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
