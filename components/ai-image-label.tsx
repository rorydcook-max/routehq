import { SHOW_AI_IMAGE_LABEL } from "@/lib/photo-url";

/**
 * "AI image" on a photo that AI made (not one it only enhanced), on rove.rent and booking pages. Sits in the photo's
 * bottom-left corner; the photo's box must be positioned. Switched off everywhere by SHOW_AI_IMAGE_LABEL.
 * `label` is gallery.aiImage in the reader's language.
 */
export function AiImageLabel({ show, label, className = "" }: { show: boolean | undefined; label: string; className?: string }) {
  if (!SHOW_AI_IMAGE_LABEL || !show) return null;
  return (
    <span
      className={`pointer-events-none absolute bottom-2 left-2 z-[1] inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-[3px] text-[11px] font-semibold leading-none tracking-[0.01em] text-white backdrop-blur-sm ${className}`}
    >
      <svg aria-hidden="true" fill="currentColor" height="10" viewBox="0 0 24 24" width="10">
        <path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z" />
      </svg>
      {label}
    </span>
  );
}
