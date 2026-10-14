"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle } from "lucide-react";

/**
 * One small note at the bottom of the screen after something is done ("Saved", "Deleted · Undo").
 * Any client component calls toast(); the Toaster in the app shell shows it.
 */
export type ToastInput = { message: string; tone?: "done" | "problem"; actionLabel?: string; onAction?: () => void; duration?: number };
type Shown = ToastInput & { id: number };

const EVENT = "routehq:toast";
let nextId = 1;
const handlers = new Map<number, () => void>();

export function toast(input: ToastInput) {
  if (typeof window === "undefined") return;
  const id = nextId++;
  if (input.onAction) handlers.set(id, input.onAction);
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { ...input, onAction: undefined, id } }));
}

export function Toaster() {
  const [shown, setShown] = useState<Shown | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const onToast = (event: Event) => {
      const detail = (event as CustomEvent<Shown>).detail;
      if (timer.current) window.clearTimeout(timer.current);
      setShown(detail);
      timer.current = window.setTimeout(() => {
        setShown((current) => (current?.id === detail.id ? null : current));
        handlers.delete(detail.id);
      }, detail.duration ?? (detail.actionLabel ? 5000 : 2600));
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  if (!shown) return null;
  const problem = shown.tone === "problem";
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-[calc(96px+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 lg:bottom-6 lg:pl-[220px]" role="status">
      <div className="toast-pop pointer-events-auto flex max-w-md items-center gap-3 rounded-full bg-[var(--primary)] py-2.5 pl-4 pr-2.5 text-white shadow-[var(--shadow-float)]" key={shown.id}>
        {problem ? <AlertTriangle className="shrink-0 text-[var(--going-out)]" size={18} /> : <CheckCircle2 className="shrink-0 text-white" size={18} />}
        <span className="min-w-0 font-semibold">{shown.message}</span>
        {shown.actionLabel ? (
          <button
            className="pressable shrink-0 whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 font-bold text-[var(--primary)] hover:bg-white/90"
            onClick={() => {
              handlers.get(shown.id)?.();
              handlers.delete(shown.id);
              setShown(null);
            }}
            type="button"
          >
            {shown.actionLabel}
          </button>
        ) : (
          <span className="w-1.5" />
        )}
      </div>
    </div>
  );
}
