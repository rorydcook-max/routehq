"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Camera, ImagePlus, Trash2, X } from "lucide-react";
import { removeVehiclePhoto, reorderVehiclePhotos, uploadVehiclePhotos } from "@/app/actions/vehicles";
import type { VehicleDetailDocument } from "@/lib/vehicle-detail";

type VehiclePhotoManagerProps = {
  organizationId: string;
  vehicleId: string;
  vehicleLabel: string;
  photos: VehicleDetailDocument[];
};

type Say = (key: string, values?: Record<string, string | number>) => string;

export function VehiclePhotoManager({ organizationId, vehicleId, vehicleLabel, photos }: VehiclePhotoManagerProps) {
  const say = useTranslations("vehiclePage") as unknown as Say;
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [orderedPhotos, setOrderedPhotos] = useState(photos);
  const [isPending, startTransition] = useTransition();
  const primaryPhoto = orderedPhotos[0];

  useEffect(() => {
    setOrderedPhotos(photos);
  }, [photos]);

  function persistPhotoOrder(nextPhotos: VehicleDetailDocument[]) {
    const formData = new FormData();
    formData.set("vehicleId", vehicleId);
    formData.set("organizationId", organizationId);
    formData.set("photoOrder", JSON.stringify(nextPhotos.map((photo) => photo.id)));
    setOrderedPhotos(nextPhotos);

    startTransition(async () => {
      try {
        await reorderVehiclePhotos(formData);
        setMessage(say("ph_orderSaved"));
        router.refresh();
      } catch {
        setMessage(say("ph_orderFailed"));
        setOrderedPhotos(photos);
      }
    });
  }

  // Dragging works with a mouse; "Make main photo" is the same thing by tap.
  function movePhoto(targetPhotoId: string) {
    if (!draggedPhotoId || draggedPhotoId === targetPhotoId) return;
    const fromIndex = orderedPhotos.findIndex((photo) => photo.id === draggedPhotoId);
    const toIndex = orderedPhotos.findIndex((photo) => photo.id === targetPhotoId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextPhotos = [...orderedPhotos];
    const [movedPhoto] = nextPhotos.splice(fromIndex, 1);
    nextPhotos.splice(toIndex, 0, movedPhoto);
    setDraggedPhotoId(null);
    persistPhotoOrder(nextPhotos);
  }

  function makeMain(photoId: string) {
    const photo = orderedPhotos.find((item) => item.id === photoId);
    if (!photo) return;
    persistPhotoOrder([photo, ...orderedPhotos.filter((item) => item.id !== photoId)]);
  }

  // Choosing photos uploads them straight away: no second button to find.
  function uploadChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    formData.set("vehicleId", vehicleId);
    formData.set("organizationId", organizationId);
    Array.from(files).forEach((file) => formData.append("vehiclePhotos", file));
    setMessage("");
    startTransition(async () => {
      try {
        await uploadVehiclePhotos(formData);
        setMessage(say("ph_updated"));
        router.refresh();
      } catch {
        setMessage(say("ph_uploadFailed"));
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    });
  }

  function remove(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        await removeVehiclePhoto(formData);
        const documentId = String(formData.get("documentId") || "");
        setOrderedPhotos((current) => current.filter((photo) => photo.id !== documentId));
        setMessage(say("ph_removed"));
        router.refresh();
      } catch {
        setMessage(say("ph_removeFailed"));
      }
    });
  }

  return (
    <>
      <button
        aria-label={say("ph_manageAria")}
        className="group relative flex min-h-[190px] w-full overflow-hidden rounded-2xl bg-[var(--panel-secondary)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {primaryPhoto?.url ? (
          <>
            <img alt={vehicleLabel} className="absolute inset-0 h-full w-full object-cover" src={primaryPhoto.url} />
            <span className="absolute bottom-3 right-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 font-bold text-[var(--foreground)] shadow-sm">
              <Camera size={17} />
              {say("ph_count", { count: orderedPhotos.length })}
            </span>
          </>
        ) : (
          <div className="flex w-full flex-col items-center justify-center gap-3 p-6 text-center">
            <p className="font-semibold text-[var(--foreground-secondary)]">{say("ph_none")}</p>
            <span className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-5 font-bold text-[var(--primary)]">
              <ImagePlus size={18} />
              {say("ph_add")}
            </span>
          </div>
        )}
      </button>

      {isOpen ? (
        <div aria-modal="true" className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 sm:items-center sm:px-4 sm:py-6" role="dialog">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div className="min-w-0">
                <h2 className="text-[20px] font-bold leading-tight text-[var(--foreground)]">{say("ph_title")}</h2>
                <p className="truncate font-medium text-[var(--foreground-secondary)]">{vehicleLabel}</p>
              </div>
              <button aria-label={say("ph_close")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground)]" onClick={() => setIsOpen(false)} type="button">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[calc(90vh-76px)] overflow-y-auto px-5 pb-6">
              <input accept="image/*" className="hidden" multiple onChange={(event) => uploadChosen(event.target.files)} ref={fileInputRef} type="file" />
              <button className="primary-action w-full" disabled={isPending} onClick={() => fileInputRef.current?.click()} type="button">
                <ImagePlus size={18} />
                {isPending ? say("saving") : say("ph_choose")}
              </button>
              <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{orderedPhotos.length > 1 ? say("ph_orderHint") : say("ph_hint")}</p>

              {message ? <p className="mt-3 rounded-xl bg-[var(--primary-light)] px-4 py-3 font-bold text-[var(--primary)]">{message}</p> : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {orderedPhotos.map((photo, index) => (
                  <div
                    className={`overflow-hidden rounded-2xl bg-[var(--panel-secondary)] ${draggedPhotoId === photo.id ? "opacity-60" : ""}`}
                    draggable
                    key={photo.id}
                    onDragEnd={() => setDraggedPhotoId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDragStart={(event) => {
                      setDraggedPhotoId(photo.id);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      movePhoto(photo.id);
                    }}
                  >
                    {photo.url ? <img alt="" className="h-44 w-full object-cover" src={photo.url} /> : <div className="h-44" />}
                    <div className="flex items-center justify-between gap-2 p-3">
                      {index === 0 ? (
                        <span className="font-bold text-[var(--foreground)]">{say("ph_main")}</span>
                      ) : (
                        <button className="min-h-[44px] rounded-full bg-white px-4 font-bold text-[var(--primary)]" disabled={isPending} onClick={() => makeMain(photo.id)} type="button">
                          {say("ph_makeMain")}
                        </button>
                      )}
                      <form action={remove}>
                        <input name="vehicleId" type="hidden" value={vehicleId} />
                        <input name="organizationId" type="hidden" value={organizationId} />
                        <input name="documentId" type="hidden" value={photo.id} />
                        <button className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-3 font-bold text-[var(--danger)]" disabled={isPending} type="submit">
                          <Trash2 size={17} />
                          {say("ph_remove")}
                        </button>
                      </form>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
