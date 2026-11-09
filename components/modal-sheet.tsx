"use client";

import { useEffect, useId, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/* One dialog for forms that open over a page (Rory, 9 Nov 2026: "Add a new customer" dropped down over the next card,
   ran off the bottom of the window and fought the page for the scroll).
   - 768px and wider: a box in the middle of the screen over a dimmed page, 85% of the window tall at most.
   - Phones: the app's bottom sheet (rounded top, grabber), 90% tall at most, kept above the keyboard.
   Title and close stay at the top, the footer (the main button) at the bottom; only the middle scrolls, and the page
   behind can't. Escape or a click on the dimmed page closes it; focus goes in on open and back to the button after. */

const widths = { sm: "md:w-[min(440px,100%)]", md: "md:w-[min(540px,100%)]", lg: "md:w-[min(640px,100%)]", xl: "md:w-[min(768px,100%)]" } as const;

// Open dialogs, innermost last: Escape closes only the top one, and the page stays locked until the last one closes.
const openStack: string[] = [];
let lockSaved: { html: string; body: string; padding: string } | null = null;

function lockPage() {
  if (openStack.length !== 1 || typeof document === "undefined") return;
  const scrollbar = window.innerWidth - document.documentElement.clientWidth;
  lockSaved = { html: document.documentElement.style.overflow, body: document.body.style.overflow, padding: document.body.style.paddingRight };
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
  // Keeps the page from jumping sideways when its scrollbar goes away.
  if (scrollbar > 0) document.body.style.paddingRight = `${scrollbar}px`;
}

function unlockPage() {
  if (openStack.length !== 0 || !lockSaved) return;
  document.documentElement.style.overflow = lockSaved.html;
  document.body.style.overflow = lockSaved.body;
  document.body.style.paddingRight = lockSaved.padding;
  lockSaved = null;
}

const focusable = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalSheet({
  open,
  onClose,
  title,
  eyebrow,
  headerExtra,
  children,
  footer,
  closeLabel,
  initialFocus,
  keepMounted = false,
  dismissable = true,
  width = "md",
  className = ""
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** A small line above the title. */
  eyebrow?: ReactNode;
  /** Shown under the title, still in the fixed top part (a step line, a back link). */
  headerExtra?: ReactNode;
  children: ReactNode;
  /** The fixed bottom part: the main button, and an error if there is one. */
  footer?: ReactNode;
  closeLabel: string;
  /** Gets focus on open; otherwise the first field or button in the middle part. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Hidden rather than removed when closed, so what was typed is still there when it opens again. */
  keepMounted?: boolean;
  /** False while saving: Escape and the dimmed page do nothing. */
  dismissable?: boolean;
  width?: keyof typeof widths;
  className?: string;
}) {
  const id = useId();
  const titleId = `${id}-title`;
  const panelRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const pressStartedOnScrim = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [everOpened, setEverOpened] = useState(open);
  // How much of the window the phone keyboard covers, so the sheet sits above it rather than under it.
  const [keyboard, setKeyboard] = useState(0);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const dismissRef = useRef(dismissable);
  dismissRef.current = dismissable;

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    openStack.push(id);
    lockPage();

    const focusTimer = window.setTimeout(() => {
      const firstShown = Array.from(bodyRef.current?.querySelectorAll<HTMLElement>(focusable) || []).find((item) => item.offsetParent !== null);
      const target = initialFocus?.current || firstShown || panelRef.current;
      target?.focus({ preventScroll: true });
    }, 30);

    const onKey = (event: KeyboardEvent) => {
      if (openStack[openStack.length - 1] !== id) return;
      if (event.key === "Escape") {
        if (!dismissRef.current) return;
        event.stopPropagation();
        closeRef.current();
        return;
      }
      // Tab stays inside the dialog.
      if (event.key === "Tab" && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(focusable)).filter((item) => item.offsetParent !== null);
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && (document.activeElement === first || !panelRef.current.contains(document.activeElement))) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);

    const viewport = window.visualViewport;
    const onViewport = () => {
      if (!viewport) return;
      const covered = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboard(covered > 80 ? covered : 0);
    };
    viewport?.addEventListener("resize", onViewport);
    viewport?.addEventListener("scroll", onViewport);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKey);
      viewport?.removeEventListener("resize", onViewport);
      viewport?.removeEventListener("scroll", onViewport);
      const at = openStack.lastIndexOf(id);
      if (at >= 0) openStack.splice(at, 1);
      unlockPage();
      setKeyboard(0);
      const back = returnTo.current;
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
    // initialFocus is a ref; reading it when the dialog opens is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, id]);

  if (!mounted || (!open && !(keepMounted && everOpened))) return null;

  return createPortal(
    <div
      aria-hidden={open ? undefined : true}
      className={`modal-scrim fixed inset-0 z-[80] items-end justify-center bg-[var(--foreground)]/45 md:items-center md:p-6 ${open ? "flex" : "hidden"}`}
      onClick={(event) => {
        if (event.target === event.currentTarget && pressStartedOnScrim.current && dismissRef.current) onClose();
        pressStartedOnScrim.current = false;
      }}
      onMouseDown={(event) => {
        // Only a click that starts on the dimmed page closes it, not a text selection dragged out of a field.
        pressStartedOnScrim.current = event.target === event.currentTarget;
      }}
      role="presentation"
      style={keyboard ? { paddingBottom: keyboard } : undefined}
    >
      <div
        aria-labelledby={titleId}
        aria-modal="true"
        className={`modal-sheet flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[28px] md:max-h-[85vh] text-left text-[var(--foreground)] outline-none md:rounded-2xl ${widths[width]} ${className}`}
        ref={panelRef}
        role="dialog"
        style={{ maxHeight: keyboard ? `calc(100dvh - ${keyboard}px - 12px)` : undefined }}
        tabIndex={-1}
      >
        <span aria-hidden="true" className="sheet-grabber mt-2 md:hidden" />
        <div className="flex shrink-0 items-start justify-between gap-3 border-[var(--border)] px-5 pb-3 md:border-b md:px-6 md:py-4">
          <div className="min-w-0 flex-1">
            {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">{eyebrow}</p> : null}
            <h2 className="sheet-title !text-[20px]" id={titleId}>
              {title}
            </h2>
            {headerExtra}
          </div>
          <button
            aria-label={closeLabel}
            className="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel-secondary)] text-[var(--foreground-secondary)] hover:text-[var(--foreground)] disabled:opacity-50"
            disabled={!dismissable}
            onClick={onClose}
            type="button"
          >
            <X size={18} strokeWidth={2.4} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4 pt-1 md:px-6 md:py-5" ref={bodyRef}>
          {children}
        </div>
        {footer ? (
          <div className={`shrink-0 border-t border-[var(--border)] px-5 pt-3 md:px-6 md:py-4 ${keyboard ? "pb-3" : "pb-[calc(16px+env(safe-area-inset-bottom))]"}`}>{footer}</div>
        ) : (
          <div aria-hidden="true" className="shrink-0 pb-[env(safe-area-inset-bottom)] md:hidden" />
        )}
      </div>
    </div>,
    document.body
  );
}
