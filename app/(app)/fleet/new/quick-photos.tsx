"use client";

import { Camera, Loader2, Sparkles, Undo2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { compressImage } from "@/lib/direct-upload-client";
import { AiPhotoTools, useAiPhotos, type AiPreview, type DraftDetails } from "@/components/ai-photos";

const MAX_PHOTOS = 8;

type Photo = { file: File; url: string; ai?: "generated" | "enhanced"; original?: File };

/** A data URL as a file, named so the server knows an AI-generated photo (app/actions/vehicles.ts uploadVehiclePhotos). */
async function fileFrom(dataUrl: string, name: string) {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/webp" });
}

const asDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Photos on the short Add vehicle form (setup). Made small on the phone and sent with the form, in the order chosen:
 * the first is the main photo. Kept under the size a form may be (about 4.5MB). AI can make a set from what's typed
 * above, or enhance the photos chosen (task build-img); kept results join the photos sent with the form.
 */
export function QuickPhotos() {
  const t = useTranslations("vehicleForm");
  const picker = useRef<HTMLInputElement>(null);
  const carrier = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [busy, setBusy] = useState(false);

  const field = (name: string) => String((carrier.current?.form?.elements.namedItem(name) as HTMLInputElement | null)?.value || "").trim();
  const ai = useAiPhotos({
    getDetails: (): DraftDetails => ({
      make: field("make"),
      model: field("model"),
      year: field("year"),
      color: field("color"),
      trim: field("trim"),
      body: field("bodyClass"),
      plate: field("registrationNumber"),
      kind: field("categoryCode") || "car"
    }),
    onKeepDraft: (preview: AiPreview) => void keepDraft(preview)
  });

  async function keepDraft(preview: AiPreview) {
    if (preview.kind === "enhance" && preview.sourceKey) {
      const file = await fileFrom(preview.url, `enhanced-${Date.now()}.webp`);
      setPhotos((list) => list.map((photo) => (photo.url === preview.sourceKey ? { file, url: URL.createObjectURL(file), ai: "enhanced", original: photo.file } : photo)));
      return;
    }
    const file = await fileFrom(preview.url, `ai-generated-${preview.angle || "photo"}-${Date.now()}.webp`);
    setPhotos((list) => (list.length >= MAX_PHOTOS ? list : [...list, { file, url: URL.createObjectURL(file), ai: "generated" }]));
  }

  function revert(photo: Photo) {
    if (!photo.original) return;
    const original = photo.original;
    setPhotos((list) => list.map((item) => (item === photo ? { file: original, url: URL.createObjectURL(original) } : item)));
  }

  async function enhanceAll() {
    const chosen = photos.filter((photo) => !photo.ai);
    ai.enhance(await Promise.all(chosen.map(async (photo) => ({ image: await asDataUrl(photo.file), sourceKey: photo.url }))));
  }

  // A field AI needs: focus it when it's typed in, else bring its section into view.
  function fixField(name: string) {
    const element = carrier.current?.form?.querySelector<HTMLInputElement>(`[name="${name}"]`);
    if (!element) return;
    if (element.type === "hidden") element.closest(".card")?.scrollIntoView({ behavior: "smooth", block: "center" });
    else {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus({ preventScroll: true });
    }
    ai.setMissing([]);
  }

  // The form sends whatever is in the hidden file box: keep it matching what is shown.
  useEffect(() => {
    if (!carrier.current) return;
    const transfer = new DataTransfer();
    photos.forEach((photo) => transfer.items.add(photo.file));
    carrier.current.files = transfer.files;
  }, [photos]);
  useEffect(() => () => photos.forEach((photo) => URL.revokeObjectURL(photo.url)), []); // eslint-disable-line react-hooks/exhaustive-deps

  async function add(files: File[]) {
    setBusy(true);
    const room = MAX_PHOTOS - photos.length;
    const added: Photo[] = [];
    for (const original of files.slice(0, room)) {
      const file = await compressImage(original, 1600, 0.78).catch(() => original);
      added.push({ file, url: URL.createObjectURL(file) });
    }
    setPhotos((list) => [...list, ...added]);
    setBusy(false);
  }

  return (
    <div>
      <span className="font-semibold text-[var(--foreground-secondary)]">{t("qp_title")}</span>
      <input
        accept="image/*"
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
      <input className="hidden" multiple name="vehiclePhotos" ref={carrier} type="file" />
      <div className="mt-1.5 grid grid-cols-4 gap-2">
        {photos.map((photo, index) => (
          <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--panel-secondary)]" key={photo.url}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="" className="h-full w-full object-cover" src={photo.url} />
            {index === 0 ? <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 text-[11px] font-bold text-white">{t("qp_main")}</span> : null}
            {photo.ai === "generated" ? (
              <span aria-label={ai.say("generated")} className="absolute bottom-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white" title={ai.say("generated")}>
                <Sparkles size={11} />
              </span>
            ) : photo.ai === "enhanced" && photo.original ? (
              <button aria-label={ai.say("revert")} className="absolute bottom-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white" onClick={() => revert(photo)} title={ai.say("revert")} type="button">
                <Undo2 size={13} />
              </button>
            ) : null}
            <button
              aria-label={t("qp_remove")}
              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
              onClick={() => setPhotos((list) => list.filter((entry) => entry !== photo))}
              type="button"
            >
              <X size={14} />
            </button>
          </div>
        ))}
        {photos.length < MAX_PHOTOS ? (
          <button
            className="pressable flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-[var(--border-strong)] text-[13px] font-semibold text-[var(--primary)]"
            disabled={busy}
            onClick={() => picker.current?.click()}
            type="button"
          >
            {busy ? <Loader2 className="animate-spin" size={20} /> : <Camera size={20} />}
            {t("qp_add")}
          </button>
        ) : null}
      </div>
      <AiPhotoTools ai={ai} compact onEnhanceAll={photos.some((photo) => !photo.ai) ? () => void enhanceAll() : undefined} onFixField={fixField} />
    </div>
  );
}
