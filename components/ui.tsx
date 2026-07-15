import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Card({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={clsx("card", className)}>{children}</section>;
}

export function EmptyState({
  title,
  description,
  action
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-strong)] bg-[var(--panel-secondary)] px-6 py-12 text-center">
      <p className="text-base font-black text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm text-sm text-[var(--muted)]">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  action
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="card-header">
      <div>
        {eyebrow ? <p className="card-header-label text-[var(--primary)]">{eyebrow}</p> : null}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral"
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    neutral: "bg-[var(--panel-secondary)] text-[var(--foreground-secondary)] ring-1 ring-[var(--border)]",
    green: "bg-[var(--success-light)] text-[var(--success)] ring-1 ring-[#bbf7d0]",
    amber: "bg-[var(--warning-light)] text-[var(--warning)] ring-1 ring-[#fde68a]",
    red: "bg-[var(--danger-light)] text-[var(--danger)] ring-1 ring-[#fecaca]",
    blue: "bg-[var(--primary-blue-light)] text-[var(--primary-blue)] ring-1 ring-[#bfd1ff]"
  };

  return <span className={clsx("badge inline-flex", tones[tone])}>{children}</span>;
}

export function ProgressBar({ value, tone = "green" }: { value: number; tone?: "green" | "amber" | "red" | "blue" }) {
  const tones = {
    green: "bg-[var(--success)]",
    amber: "bg-[var(--warning)]",
    red: "bg-[var(--danger)]",
    blue: "bg-[var(--primary-blue)]"
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[var(--panel-secondary)]">
      <div className={clsx("h-full rounded-full", tones[tone])} style={{ width: `${Math.max(0, Math.min(value, 100))}%` }} />
    </div>
  );
}
