"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Move, Sparkles, Trash2, Undo2, X } from "lucide-react";
import { AiPhotoTools, useAiPhotos } from "@/components/ai-photos";
import { removeVehiclePhoto as removeVehiclePhotoAction, reorderVehiclePhotos as reorderVehiclePhotosAction, uploadVehiclePhotos as uploadVehiclePhotosAction } from "@/app/actions/vehicles";
import type { VehicleDetailDocument } from "@/lib/vehicle-detail";
import { PhotoGallery } from "@/components/photo-gallery";
import { compressImage } from "@/lib/direct-upload-client";
import { refreshVehiclePhotos } from "@/components/vehicle-photo-store";
import { unwrap } from "@/lib/action-result";
import { shownError } from "@/lib/error-text";

// A save that fails hands back its reason (lib/action-error.ts); these throw it, for the catch blocks below to show.
const uploadVehiclePhotos = (...args: Parameters<typeof uploadVehiclePhotosAction>) => unwrap(uploadVehiclePhotosAction(...args));
const removeVehiclePhoto = (...args: Parameters<typeof removeVehiclePhotoAction>) => unwrap(removeVehiclePhotoAction(...args));
const reorderVehiclePhotos = (...args: Parameters<typeof reorderVehiclePhotosAction>) => unwrap(reorderVehiclePhotosAction(...args));

type VehiclePhotoManagerProps = {
  organizationId: string;
  vehicleId: string;
  vehicleLabel: string;
  photos: VehicleDetailDocument[];
  /** The drawing of the vehicle, shown until it has a photo. */
  art?: React.ReactNode;
};

type Say = (key: string, values?: Record<string, string | number>) => string;

export function VehiclePhotoManager({ organizationId, vehicleId, vehicleLabel, photos, art }: VehiclePhotoManagerProps) {
  const say = useTranslations("vehiclePage") as unknown as Say;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [draggedPhotoId, setDraggedPhotoId] = useState<string | null>(null);
  const [orderedPhotos, setOrderedPhotos] = useState(photos);
  const [isPending, startTransition] = useTransition();
  const primaryPhoto = orderedPhotos[0];
  const router = useRouter();
  // AI photos: generated sets and enhanced copies come back as previews; kept ones join the photos (task build-img).
  const ai = useAiPhotos({
    vehicleId,
    onChanged: () => {
      refreshVehiclePhotos();
      router.refresh();
    }
  });
  const enhanceable = orderedPhotos.filter((photo) => photo.extractedData?.ai_generated !== true && photo.extractedData?.enhanced !== true);

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
        refreshVehiclePhotos();
        setMessage(say("ph_orderSaved"));
      } catch (caught) {
        setMessage(shownError(caught, say("ph_orderFailed")));
        setOrderedPhotos(photos);
      }
    });
  }

  // Dragging by the arrows handle, with a finger or a mouse (pointer events: the browser's own drag-and-drop does
  // nothing on a phone). The photos move as you go; the new order is saved when you let go.
  const orderRef = useRef(orderedPhotos);
  orderRef.current = orderedPhotos;
  const dragStart = useRef<{ id: string; order: string } | null>(null);

  // The page listens while dragging, not the handle: the handle's tile moves in the page as photos swap places,
  // and a moved element loses the finger.
  function startDrag(event: React.PointerEvent<HTMLElement>, photoId: string) {
    event.preventDefault();
    const list = event.currentTarget.closest(".overflow-y-auto");
    dragStart.current = { id: photoId, order: orderRef.current.map((photo) => photo.id).join(",") };
    setDraggedPhotoId(photoId);
    const move = (moveEvent: PointerEvent) => {
      moveEvent.preventDefault();
      dragOver(moveEvent, list);
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      endDrag();
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  function dragOver(event: PointerEvent, list: Element | null) {
    const dragging = dragStart.current;
    if (!dragging) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-photo-id]")?.getAttribute("data-photo-id");
    if (target && target !== dragging.id) {
      setOrderedPhotos((current) => {
        const from = current.findIndex((photo) => photo.id === dragging.id);
        const to = current.findIndex((photo) => photo.id === target);
        if (from < 0 || to < 0) return current;
        const next = [...current];
        const [moved] = next.splice(from, 1);
        next.splice(to, 0, moved);
        return next;
      });
    }
    // Near the top or bottom of the list, it scrolls along.
    if (list) {
      const box = list.getBoundingClientRect();
      if (event.clientY < box.top + 60) list.scrollBy(0, -14);
      else if (event.clientY > box.bottom - 60) list.scrollBy(0, 14);
    }
  }

  function endDrag() {
    const dragging = dragStart.current;
    dragStart.current = null;
    setDraggedPhotoId(null);
    if (dragging && orderRef.current.map((photo) => photo.id).join(",") !== dragging.order) persistPhotoOrder(orderRef.current);
  }

  function makeMain(photoId: string) {
    const photo = orderedPhotos.find((item) => item.id === photoId);
    if (!photo) return;
    persistPhotoOrder([photo, ...orderedPhotos.filter((item) => item.id !== photoId)]);
  }

  // Choosing photos uploads them straight away: no second button to find.
  function uploadChosen(files: FileList | null) {
    if (!files || files.length === 0) return;
    const chosen = Array.from(files);
    setMessage("");
    startTransition(async () => {
      // Made smaller in the browser, then sent one at a time, so no request goes over the server's size limit
      // (Rory, 1 Nov 2026: iPhone photos failed). One that fails doesn't stop the rest.
      let failed = 0;
      try {
        for (const original of chosen) {
          const formData = new FormData();
          formData.set("vehicleId", vehicleId);
          formData.set("organizationId", organizationId);
          formData.append("vehiclePhotos", await compressImage(original, 2000, 0.82));
          try {
            await uploadVehiclePhotos(formData);
          } catch {
            failed += 1;
          }
        }
        refreshVehiclePhotos();
        setMessage(failed === chosen.length ? say("ph_uploadFailed") : say("ph_updated"));
      } catch (caught) {
        setMessage(shownError(caught, say("ph_uploadFailed")));
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
        refreshVehiclePhotos();
        const documentId = String(formData.get("documentId") || "");
        setOrderedPhotos((current) => current.filter((photo) => photo.id !== documentId));
        setMessage(say("ph_removed"));
      } catch (caught) {
        setMessage(shownError(caught, say("ph_removeFailed")));
      }
    });
  }

  const photoUrls = orderedPhotos.map((photo) => photo.url).filter(Boolean) as string[];

  return (
    <>
      {primaryPhoto?.url ? (
        // The main photo large with the next ones as thumbnails; tapping one opens it full screen. Editing is its own button.
        <PhotoGallery
          alt={vehicleLabel}
          overlay={
            <button
              aria-label={say("ph_manageAria")}
              className="absolute bottom-3 right-3 inline-flex min-h-[40px] items-center gap-1.5 rounded-full bg-white px-4 font-bold text-[var(--foreground)] shadow-sm"
              onClick={() => setIsOpen(true)}
              type="button"
            >
              <Camera size={17} />
              {say("ph_count", { count: orderedPhotos.length })}
            </button>
          }
          photos={photoUrls}
        />
      ) : (
      <button
        aria-label={say("ph_manageAria")}
        className="group relative flex aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[var(--panel-secondary)] text-left focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {(
          art ? (
            <>
              {/* The drawing sits a little high so the button doesn't cover a wheel. */}
              <span className="absolute inset-0 flex [&>span]:pb-12">{art}</span>
              <span className="absolute bottom-3 right-3 inline-flex min-h-[44px] items-center gap-2 rounded-full bg-white px-4 font-bold text-[var(--primary)] shadow-sm">
                <ImagePlus size={18} />
                {say("ph_add")}
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
          )
        )}
      </button>
      )}

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

              {message ? <p className="mt-3 rounded-xl bg-[var(--primary-light)] px-4 py-3 font-bold text-[var(--primary)]">{message}</p> : null}

              <AiPhotoTools
                ai={ai}
                editHref={`/fleet/${vehicleId}/edit`}
                onEnhanceAll={enhanceable.length ? () => void ai.enhance(enhanceable.map((photo) => ({ documentId: photo.id }))) : undefined}
              />

              {/* Two to a row, so most of a car's photos are on screen at once and can be dragged into order with a finger
                  or the mouse (Rory, 1 Nov 2026: dragging only worked with a mouse). Hold the arrows and move. */}
              <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {orderedPhotos.map((photo, index) => (
                  <div
                    className={`overflow-hidden rounded-2xl bg-[var(--panel-secondary)] transition-opacity ${draggedPhotoId === photo.id ? "opacity-50 ring-2 ring-[var(--primary)]" : ""}`}
                    data-photo-id={photo.id}
                    key={photo.id}
                  >
                    <div className="relative">
                      {photo.url ? <img alt="" className="pointer-events-none aspect-[4/3] w-full select-none object-cover" draggable={false} src={photo.url} /> : <div className="aspect-[4/3]" />}
                      {index === 0 ? (
                        <span className="absolute bottom-2 left-2 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-[var(--foreground)] shadow-sm">{say("ph_main")}</span>
                      ) : null}
                      {orderedPhotos.length > 1 ? (
                        <span
                          aria-label={say("ph_orderHint")}
                          className="absolute left-2 top-2 flex h-11 w-11 cursor-grab touch-none select-none items-center justify-center rounded-full bg-white/95 text-[var(--foreground)] shadow-sm active:cursor-grabbing"
                          onPointerDown={(event) => startDrag(event, photo.id)}
                          role="button"
                        >
                          <Move size={20} />
                        </span>
                      ) : null}
                      <form action={remove} className="absolute right-2 top-2">
                        <input name="vehicleId" type="hidden" value={vehicleId} />
                        <input name="organizationId" type="hidden" value={organizationId} />
                        <input name="documentId" type="hidden" value={photo.id} />
                        <button aria-label={say("ph_remove")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--danger)] shadow-sm" disabled={isPending} type="submit">
                          <Trash2 size={18} />
                        </button>
                      </form>
                      {/* AI: a generated photo says so; an enhanced one can go back to its original; any other can be enhanced. */}
                      {photo.extractedData?.ai_generated === true ? (
                        <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white" title={ai.say("generated")}>
                          <Sparkles aria-hidden="true" size={15} />
                          <span className="sr-only">{ai.say("generated")}</span>
                        </span>
                      ) : photo.extractedData?.enhanced === true ? (
                        <button
                          aria-label={ai.say("revert")}
                          className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--foreground)] shadow-sm"
                          disabled={ai.busy || ai.saving === photo.id}
                          onClick={() => void ai.revert(photo.id)}
                          title={ai.say("revert")}
                          type="button"
                        >
                          <Undo2 size={18} />
                        </button>
                      ) : (
                        <button
                          aria-label={ai.say("enhance")}
                          className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-[var(--primary)] shadow-sm"
                          disabled={ai.busy}
                          onClick={() => void ai.enhance([{ documentId: photo.id }])}
                          title={ai.say("enhance")}
                          type="button"
                        >
                          <Sparkles size={18} />
                        </button>
                      )}
                    </div>
                    {index > 0 ? (
                      <button className="block min-h-11 w-full px-2 text-sm font-bold text-[var(--primary)]" disabled={isPending} onClick={() => makeMain(photo.id)} type="button">
                        {say("ph_makeMain")}
                      </button>
                    ) : (
                      <div className="min-h-11" />
                    )}
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
