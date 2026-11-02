"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

/**
 * A small (i) beside a label that shows a short explanation (Rory, 2 Nov 2026: settings had paragraphs of text under
 * every field). Opens on hover with a mouse and on tap on a phone; Escape or a tap elsewhere closes it.
 * Use it for the "why" or the detail; keep what people must know to fill the field in the label itself.
 */
export function InfoTip({ text, label, className = "" }: { text: React.ReactNode; /** Read out to screen readers, e.g. "About the deposit". */ label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: Event) => {
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !box.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <span className={`relative inline-flex align-middle ${className}`} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} ref={box}>
      <button
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        aria-label={label || "More information"}
        className="-m-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--primary)] focus-visible:text-[var(--primary)]"
        onClick={(event) => {
          // Inside a <label>, a tap must not also tick the box or focus the field.
          event.preventDefault();
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        type="button"
      >
        <Info aria-hidden="true" size={15} />
      </button>
      {open ? (
        <span
          className="absolute left-1/2 top-full z-50 mt-1.5 w-max max-w-[min(280px,80vw)] -translate-x-1/2 rounded-xl bg-[var(--foreground)] px-3 py-2 text-left text-[13px] font-medium leading-snug text-[var(--background)] shadow-lg"
          id={id}
          role="tooltip"
        >
          {text}
        </span>
      ) : null}
    </span>
  );
}
