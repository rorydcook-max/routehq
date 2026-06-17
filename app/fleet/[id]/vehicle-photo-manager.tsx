"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera, GripVertical, ImagePlus, Trash2, X } from "lucide-react";
import { removeVehiclePhoto, reorderVehiclePhotos, uploadVehiclePhotos } from "@/app/actions/vehicles";
import type { VehicleDetailDocument } from "@/lib/vehicle-detail";

type VehiclePhotoManagerProps = {
  organizationId: string;
  vehicleId: string;
  vehicleLabel: string;
  photos: VehicleDetailDocument[];
};

export function VehiclePhotoManager({ organizationId, vehicleId, vehicleLabel, photos }: VehiclePhotoManagerProps) {
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

    startTransition(async () => {
      try {
        await reorderVehiclePhotos(formData);
        setMessage("Photo order saved. The first photo is now the main image.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save photo order.");
        setOrderedPhotos(photos);
      }
    });
  }

  function movePhoto(targetPhotoId: string) {
    if (!draggedPhotoId || draggedPhotoId === targetPhotoId) {
      return;
    }

    const fromIndex = orderedPhotos.findIndex((photo) => photo.id === draggedPhotoId);
    const toIndex = orderedPhotos.findIndex((photo) => photo.id === targetPhotoId);
    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const nextPhotos = [...orderedPhotos];
    const [movedPhoto] = nextPhotos.splice(fromIndex, 1);
    nextPhotos.splice(toIndex, 0, movedPhoto);
    setOrderedPhotos(nextPhotos);
    setDraggedPhotoId(null);
    persistPhotoOrder(nextPhotos);
  }

  function upload(formData: FormData) {
    setMessage("");
    startTransition(async () => {
      try {
        await uploadVehiclePhotos(formData);
        setMessage("Photos updated.");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to upload photos.");
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
        setMessage("Photo removed.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to remove photo.");
      }
    });
  }

  return (
    <>
      <button
        aria-label="Manage vehicle photos"
        className="group relative flex min-h-[218px] w-full overflow-hidden rounded-lg border border-[var(--border)] bg-gradient-to-br from-[var(--primary-light)] via-white to-[var(--primary-blue-light)] text-left transition hover:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/30"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {primaryPhoto?.url ? (
          <>
            <img alt={primaryPhoto.fileName} className="absolute inset-0 h-full w-full object-cover" src={primaryPhoto.url} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="relative mt-auto flex w-full items-end justify-between gap-3 p-4 text-white">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{vehicleLabel}</p>
                <p className="text-xs text-white/75">{orderedPhotos.length} photo{orderedPhotos.length === 1 ? "" : "s"} uploaded</p>
              </div>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur">
                <Camera size={14} />
                Manage
              </span>
            </div>
          </>
        ) : (
          <div className="flex w-full items-center justify-center p-6 text-center">
            <div>
              <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/75 text-[var(--primary)] shadow-sm">
                <Camera size={28} />
              </span>
              <p className="mt-3 text-sm font-semibold text-[var(--foreground)]">{vehicleLabel}</p>
              <p className="mt-1 text-xs text-[var(--muted)]">No vehicle photos uploaded yet</p>
              <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[var(--primary)] shadow-sm">
                <ImagePlus size={14} />
                Add photos
              </p>
            </div>
          </div>
        )}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true">
          <div className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-4 py-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--primary)]">Vehicle photos</p>
                <h2 className="text-base font-semibold text-[var(--foreground)]">{vehicleLabel}</h2>
              </div>
              <button className="rounded-lg border border-[var(--border)] bg-white p-2 text-[var(--muted)] hover:text-[var(--foreground)]" onClick={() => setIsOpen(false)} type="button">
                <X size={16} />
              </button>
            </div>

            <div className="max-h-[calc(86vh-64px)] overflow-y-auto p-4">
              <form action={upload} className="rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--panel-secondary)] p-3">
                <input name="vehicleId" type="hidden" value={vehicleId} />
                <input name="organizationId" type="hidden" value={organizationId} />
                <label className="mb-2 block text-xs font-semibold text-[var(--foreground-secondary)]" htmlFor="vehicle-photo-upload">
                  Add vehicle photos
                </label>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <input
                    accept="image/*"
                    className="w-full rounded-lg border border-[var(--border-strong)] bg-white px-3 py-2 text-sm"
                    id="vehicle-photo-upload"
                    multiple
                    name="vehiclePhotos"
                    ref={fileInputRef}
                    type="file"
                  />
                  <button className="inline-flex min-w-fit items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white" disabled={isPending} type="submit">
                    <ImagePlus size={16} />
                    {isPending ? "Saving..." : "Upload"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Upload clear exterior and interior photos. These appear on the vehicle profile only.</p>
              </form>

              {message ? <p className="mt-3 rounded-lg bg-[var(--primary-light)] px-3 py-2 text-sm font-semibold text-[var(--primary)]">{message}</p> : null}

              {orderedPhotos.length > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
                  <p className="text-xs font-semibold text-[var(--foreground-secondary)]">Drag photos into order. The first photo is used as the main image.</p>
                  {isPending ? <span className="text-xs font-semibold text-[var(--primary)]">Saving...</span> : null}
                </div>
              ) : null}

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {orderedPhotos.length === 0 ? (
                  <div className="rounded-lg border border-[var(--border)] bg-white p-4 text-sm text-[var(--muted)] sm:col-span-2">No photos uploaded yet.</div>
                ) : (
                  orderedPhotos.map((photo, index) => (
                    <div
                      className={`overflow-hidden rounded-lg border bg-white transition ${draggedPhotoId === photo.id ? "border-[var(--primary)] opacity-70 ring-2 ring-[var(--primary)]/20" : "border-[var(--border)]"}`}
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
                      {photo.url ? <img alt={photo.fileName} className="h-44 w-full object-cover" src={photo.url} /> : <div className="h-44 bg-[var(--panel-secondary)]" />}
                      <div className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <button
                            aria-label={`Drag ${photo.fileName}`}
                            className="cursor-grab rounded-md border border-[var(--border)] bg-[var(--panel-secondary)] p-2 text-[var(--muted)] active:cursor-grabbing"
                            type="button"
                          >
                            <GripVertical size={15} />
                          </button>
                          <div className="min-w-0">
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-[var(--foreground)]">{photo.fileName}</p>
                              {index === 0 ? <span className="shrink-0 rounded-full bg-[var(--primary-light)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--primary)]">Main image</span> : null}
                            </div>
                            <p className="text-xs text-[var(--muted)]">Position {index + 1} · {photo.category.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <form action={remove}>
                          <input name="vehicleId" type="hidden" value={vehicleId} />
                          <input name="organizationId" type="hidden" value={organizationId} />
                          <input name="documentId" type="hidden" value={photo.id} />
                          <button className="inline-flex items-center gap-1.5 rounded-lg border border-[#fecaca] bg-[var(--danger-light)] px-3 py-2 text-xs font-semibold text-[var(--danger)]" disabled={isPending} type="submit">
                            <Trash2 size={14} />
                            Remove
                          </button>
                        </form>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
