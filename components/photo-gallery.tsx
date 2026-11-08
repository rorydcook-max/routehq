"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { AiImageLabel } from "@/components/ai-image-label";
import { photoProps } from "@/lib/photo-url";

/**
 * A vehicle's photos (Rory, 1 Nov 2026): the main photo large, in the 4:3 shape phone cameras take, so it is not
 * cropped to a thin strip, with the next few as thumbnails underneath and a "+3" tile when there are more. Any photo
 * opens full screen, where you swipe or use the arrows to go through them all.
 */
export function PhotoGallery({
  photos,
  alt,
  maxThumbs = 4,
  overlay,
  className = "",
  dimmed = false,
  aiPhotos,
  aiLabel
}: {
  photos: string[];
  /** Per photo: made by AI. With `aiLabel` (gallery.aiImage), those carry the small "AI image" label. */
  aiPhotos?: boolean[];
  aiLabel?: string;
  alt: string;
  /** How many thumbnails sit under the main photo; the last becomes "+N" when there are more. */
  maxThumbs?: number;
  /** Something laid over the main photo, such as an "Edit photos" button. */
  overlay?: ReactNode;
  className?: string;
  dimmed?: boolean;
}) {
  const say = useTranslations("gallery");
  const [openAt, setOpenAt] = useState<number | null>(null);
  const thumbs = photos.slice(1, 1 + maxThumbs);
  const hidden = photos.length - 1 - thumbs.length;
  if (!photos.length) return null;

  return (
    <div className={className}>
      <div className="relative">
        <button aria-label={say("open")} className="block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-[var(--panel-secondary)]" onClick={() => setOpenAt(0)} type="button">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt={alt} className={`h-full w-full object-cover ${dimmed ? "opacity-60" : ""}`} decoding="async" height={900} width={1200} {...photoProps(photos[0], "(min-width: 1024px) 40vw, 100vw", 960)} />
        </button>
        {aiLabel ? <AiImageLabel label={aiLabel} show={aiPhotos?.[0]} /> : null}
        {overlay}
      </div>
      {thumbs.length ? (
        <div className="mt-2 grid gap-2" style={{ gridTemplateColumns: `repeat(${maxThumbs}, minmax(0, 1fr))` }}>
          {thumbs.map((url, index) => {
            const isLast = index === thumbs.length - 1 && hidden > 0;
            return (
              <button
                aria-label={isLast ? say("more", { count: hidden + 1 }) : say("open")}
                className="relative block aspect-square overflow-hidden rounded-xl bg-[var(--panel-secondary)]"
                key={url}
                onClick={() => setOpenAt(index + 1)}
                type="button"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img alt="" className={`h-full w-full object-cover ${dimmed ? "opacity-60" : ""}`} decoding="async" height={320} loading="lazy" width={320} {...photoProps(url, "(min-width: 640px) 120px, 25vw", 320)} />
                {aiLabel && !isLast ? <AiImageLabel className="!bottom-1 !left-1 !px-1.5 !text-[10px]" label={aiLabel} show={aiPhotos?.[index + 1]} /> : null}
                {isLast ? <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[20px] font-bold text-white">+{hidden + 1}</span> : null}
              </button>
            );
          })}
        </div>
      ) : null}
      {openAt !== null ? <PhotoViewer alt={alt} onClose={() => setOpenAt(null)} photos={photos} start={openAt} /> : null}
    </div>
  );
}

/** Full screen, one photo at a time: swipe, arrow keys or the buttons; Escape or X closes. */
export function PhotoViewer({ photos, start, alt, onClose }: { photos: string[]; start: number; alt: string; onClose: () => void }) {
  const say = useTranslations("gallery");
  const [index, setIndex] = useState(start);
  const touchX = useRef<number | null>(null);
  const touchY = useRef<number | null>(null);
  const direction = useRef<"down" | "side" | null>(null);
  const [dragY, setDragY] = useState(0);
  const go = (step: number) => setIndex((current) => (current + step + photos.length) % photos.length);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflow;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const many = photos.length > 1;
  // Swipe sideways for the next photo; pull down (or up) to close, the photo following the finger (Rory, 1 Nov 2026).
  const fade = Math.max(0.35, 1 - Math.abs(dragY) / 400);
  return createPortal(
    <div
      aria-modal="true"
      className="fixed inset-0 z-[80] flex touch-none flex-col text-white"
      onTouchCancel={() => {
        touchX.current = null;
        setDragY(0);
      }}
      onTouchEnd={(event) => {
        if (touchX.current === null || touchY.current === null) return;
        const movedX = event.changedTouches[0].clientX - touchX.current;
        const movedY = event.changedTouches[0].clientY - touchY.current;
        touchX.current = null;
        touchY.current = null;
        if (direction.current === "down") {
          if (Math.abs(movedY) > 90) onClose();
          else setDragY(0);
        } else if (many && Math.abs(movedX) > 40) go(movedX < 0 ? 1 : -1);
        direction.current = null;
      }}
      onTouchMove={(event) => {
        if (touchX.current === null || touchY.current === null) return;
        const movedX = event.touches[0].clientX - touchX.current;
        const movedY = event.touches[0].clientY - touchY.current;
        if (!direction.current && (Math.abs(movedX) > 8 || Math.abs(movedY) > 8)) direction.current = Math.abs(movedY) > Math.abs(movedX) ? "down" : "side";
        if (direction.current === "down") setDragY(movedY);
      }}
      onTouchStart={(event) => {
        touchX.current = event.touches[0].clientX;
        touchY.current = event.touches[0].clientY;
        direction.current = null;
      }}
      role="dialog"
      style={{ background: `rgba(0,0,0,${fade})` }}
    >
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <span className="num text-[15px] font-semibold text-white/80">{many ? `${index + 1} / ${photos.length}` : ""}</span>
        <button aria-label={say("close")} className="flex h-11 w-11 items-center justify-center rounded-full bg-white/15" onClick={onClose} type="button">
          <X size={22} />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 pb-[max(16px,env(safe-area-inset-bottom))]" onClick={(event) => event.target === event.currentTarget && onClose()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          alt={alt}
          className={`max-h-full max-w-full select-none rounded-lg object-contain ${dragY === 0 ? "transition-transform duration-200" : ""}`}
          draggable={false}
          key={photos[index]}
          src={photos[index]}
          style={{ transform: dragY ? `translateY(${dragY}px) scale(${Math.max(0.85, 1 - Math.abs(dragY) / 1500)})` : undefined }}
        />
        {many ? (
          <>
            <button aria-label={say("prev")} className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15" onClick={() => go(-1)} type="button">
              <ChevronLeft size={24} />
            </button>
            <button aria-label={say("next")} className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15" onClick={() => go(1)} type="button">
              <ChevronRight size={24} />
            </button>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
