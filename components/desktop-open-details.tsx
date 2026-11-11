import type { ReactNode } from "react";

/**
 * A booking's secondary actions. On a phone they fold under "More" (a two-column grid of equal buttons); on a
 * desktop-width screen there is room for all of them, so they sit in the same row as the main actions, the same
 * height and spacing as those (Rory, 11 Nov 2026). The same buttons are drawn once for each layout and only one is
 * ever shown: a fold can't be laid out as part of its parent's row, which left the buttons unevenly spaced.
 */
const button =
  "[&>a]:!h-11 [&>a]:!min-h-0 [&>a]:overflow-hidden [&>a]:whitespace-nowrap [&>a]:!px-4 [&>a]:!py-0 [&>a]:!text-[15px] [&>button]:!h-11 [&>button]:!min-h-0 [&>button]:overflow-hidden [&>button]:whitespace-nowrap [&>button]:!rounded-full [&>button]:!border-2 [&>button]:!px-4 [&>button]:!py-0 [&>button]:!text-[15px] [&>button]:!font-bold [&_svg]:shrink-0";

export function MoreActions({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <details className="col-span-2 lg:hidden">
        <summary className="pressable inline-flex min-h-11 w-full cursor-pointer list-none items-center justify-center gap-1 rounded-full border-2 border-[var(--border-strong)] bg-[var(--panel)] px-4 py-2 font-bold text-[var(--foreground)] hover:bg-[var(--panel-secondary)] [&::-webkit-details-marker]:hidden">
          {label}
        </summary>
        <div className={`mt-2 grid grid-cols-2 gap-2 [&>button]:w-full ${button}`}>{children}</div>
      </details>
      <div className={`hidden lg:contents ${button}`}>{children}</div>
    </>
  );
}
