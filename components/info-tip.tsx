"use client";

import { Info } from "lucide-react";
import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";

/** The gap kept between a tip and the screen edge, and the widest a tip gets. */
const GUTTER = 16;
const MAX_WIDTH = 280;

/**
 * A small (i) beside a label that shows a short explanation (Rory, 2 Nov 2026: settings had paragraphs of text under
 * every field). Opens on hover with a mouse and on tap on a phone; Escape or a tap elsewhere closes it.
 * Use it for the "why" or the detail; keep what people must know to fill the field in the label itself.
 *
 * The tip is placed against the screen, not its parent (Rory, 7 Nov 2026: on a phone the "Home area" tip ran off the
 * right edge): centred under the (i) where it fits, slid sideways to stay 16px inside the screen, never wider than
 * 280px or the screen less its gutters, and shown above the (i) when there is no room below.
 */
export function InfoTip({ text, label, className = "" }: { text: React.ReactNode; /** Read out to screen readers, e.g. "About the deposit". */ label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [place, setPlace] = useState<{ left: number; top: number; width: number; arrow: number; above: boolean } | null>(null);
  const id = useId();
  const box = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const tip = useRef<HTMLSpanElement>(null);
  const hoveredAt = useRef(0);

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

  // Measured before paint, so the tip never shows in the wrong place first.
  useLayoutEffect(() => {
    if (!open) {
      setPlace(null);
      return;
    }
    const measure = () => {
      const anchor = button.current?.getBoundingClientRect();
      const bubble = tip.current;
      if (!anchor || !bubble) return;
      const screenWidth = document.documentElement.clientWidth || window.innerWidth;
      const width = Math.min(MAX_WIDTH, screenWidth - GUTTER * 2);
      bubble.style.width = "max-content";
      bubble.style.maxWidth = `${width}px`;
      const natural = Math.min(width, Math.ceil(bubble.getBoundingClientRect().width));
      bubble.style.width = `${natural}px`;
      const height = bubble.getBoundingClientRect().height;
      const centre = anchor.left + anchor.width / 2;
      const left = Math.max(GUTTER, Math.min(centre - natural / 2, screenWidth - GUTTER - natural));
      const below = anchor.bottom + 6;
      const above = below + height > window.innerHeight - 8 && anchor.top - 6 - height > 8;
      setPlace({ left, top: above ? anchor.top - 6 - height : below, width: natural, arrow: Math.max(10, Math.min(natural - 10, centre - left)), above });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, text]);

  return (
    <span
      className={`relative inline-flex align-middle ${className}`}
      // Hover opens it for a mouse only: on a phone a tap also sends a hover first, which then made the tap close it again.
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          hoveredAt.current = Date.now();
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") setOpen(false);
      }}
      ref={box}
    >
      <button
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        aria-label={label || "More information"}
        className="-m-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-[var(--muted)] hover:text-[var(--primary)] focus-visible:text-[var(--primary)]"
        onClick={(event) => {
          // Inside a <label>, a tap must not also tick the box or focus the field.
          event.preventDefault();
          event.stopPropagation();
          // A click straight after the mouse arrived (it opened on hover) keeps it open rather than closing it.
          if (Date.now() - hoveredAt.current < 600) setOpen(true);
          else setOpen((value) => !value);
        }}
        ref={button}
        type="button"
      >
        <Info aria-hidden="true" size={15} />
      </button>
      {open ? (
        <span
          className="fixed z-[70] block whitespace-normal rounded-xl bg-[var(--foreground)] px-3 py-2 text-left text-[13px] font-medium normal-case leading-snug tracking-normal text-[var(--background)] shadow-lg [overflow-wrap:anywhere]"
          id={id}
          ref={tip}
          role="tooltip"
          style={place ? { left: place.left, top: place.top, width: place.width, maxWidth: MAX_WIDTH } : { left: 0, top: 0, visibility: "hidden" }}
        >
          {text}
          {place ? (
            <span
              aria-hidden="true"
              className={`absolute h-2 w-2 rotate-45 bg-[var(--foreground)] ${place.above ? "-bottom-1" : "-top-1"}`}
              style={{ left: place.arrow - 4 }}
            />
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
