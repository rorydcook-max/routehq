"use client";

import { Camera, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { compressImage } from "@/lib/direct-upload-client";

const MAX_PHOTOS = 8;

/**
 * Photos on the short Add vehicle form (setup). Made small on the phone and sent with the form, in the order chosen:
 * the first is the main photo. Kept under the size a form may be (about 4.5MB).
 */
export function QuickPhotos() {
  const t = useTranslations("vehicleForm");
  const picker = useRef<HTMLInputElement>(null);
  const carrier = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Array<{ file: File; url: string }>>([]);
  const [busy, setBusy] = useState(false);

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
    const added: Array<{ file: File; url: string }> = [];
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
    </div>
  );
}
