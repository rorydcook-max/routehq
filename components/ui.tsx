import { clsx } from "clsx";
import { ChevronDown, ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";
import type { ReactNode } from "react";

/**
 * The one way back on a sub-page: a chevron and the name of where it goes ("Settings", "Fleet", "Honda City"),
 * above the page title. Every sub-page, form and flow uses this, in the same place.
 */
export function BackLink({ href, label, className }: { href: string; label: string; className?: string }) {
  return (
    <Link
      className={clsx("pressable -ms-1 mb-3 inline-flex min-h-9 items-center gap-0.5 rounded-full pe-2 text-[14px] font-semibold text-[var(--primary)] hover:underline", className)}
      href={href as Route}
    >
      <ChevronLeft aria-hidden="true" className="rtl:rotate-180" size={18} strokeWidth={2.4} />
      {label}
    </Link>
  );
}

export function Card({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={clsx("card", className)}>{children}</section>;
}

/**
 * A section that stays one line until someone opens it. Pages lead with what
 * needs doing; the rest is one tap away instead of a long scroll.
 */
export function Fold({
  title,
  summary,
  tone = "neutral",
  open = false,
  id,
  children
}: {
  title: string;
  summary?: ReactNode;
  tone?: "neutral" | "red" | "green" | "amber";
  open?: boolean;
  id?: string;
  children: ReactNode;
}) {
  const tones = {
    neutral: "font-medium text-[var(--foreground-secondary)]",
    red: "font-bold text-[var(--danger)]",
    green: "font-bold text-[var(--success)]",
    amber: "font-bold text-[var(--warning)]"
  };
  return (
    <details className="card group scroll-mt-4 overflow-hidden" id={id} open={open}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="card-title block !text-[17px]">{title}</span>
          {summary ? <span className={clsx("mt-0.5 line-clamp-2 block", tones[tone])}>{summary}</span> : null}
        </span>
        <ChevronDown className="shrink-0 text-[var(--foreground-secondary)] transition-transform group-open:rotate-180" size={22} strokeWidth={2.2} />
      </summary>
      <div className="border-t border-[var(--border)] px-4 pb-4 pt-3.5">{children}</div>
    </details>
  );
}

/** One part of a tab: a card with a heading and a one-line summary. Takes the same props as Fold. */
export function Pane({ title, summary, tone = "neutral", id, children }: { title: string; summary?: ReactNode; tone?: "neutral" | "red" | "green" | "amber"; open?: boolean; id?: string; children: ReactNode }) {
  const tones = { neutral: "font-medium text-[var(--foreground-secondary)]", red: "font-bold text-[var(--danger)]", green: "font-bold text-[var(--success)]", amber: "font-bold text-[var(--warning)]" };
  return (
    <section className="card scroll-mt-4 p-4" id={id}>
      <h2 className="card-title">{title}</h2>
      {summary ? <p className={clsx("mt-0.5", tones[tone])}>{summary}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
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
    <div className="empty-state flex flex-col items-center justify-center !py-10">
      <p className="text-[17px] font-bold text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-1.5 max-w-sm font-medium text-[var(--foreground-secondary)]">{description}</p>
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
        <h2 className="card-title">{title}</h2>
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
  // One solid pill for the thing that is happening now (blue), soft fills for the rest.
  const tones = {
    neutral: "bg-[var(--panel-tertiary)] text-[var(--foreground)]",
    green: "bg-[var(--success-light)] text-[var(--success)]",
    amber: "bg-[var(--warning-light)] text-[var(--warning)]",
    red: "bg-[var(--danger-light)] text-[var(--danger)]",
    blue: "bg-[var(--primary)] text-white"
  };

  return <span className={clsx("badge inline-flex items-center", tones[tone])}>{children}</span>;
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
