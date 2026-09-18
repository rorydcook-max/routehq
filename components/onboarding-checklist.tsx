"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Route } from "next";
import { CheckCircle2, Circle, X } from "lucide-react";
import { dismissChecklist } from "@/app/actions/onboarding";

type ChecklistItem = {
  step: string;
  label: string;
  href: string;
  completed: boolean;
};

export function OnboardingChecklist({
  completedCount,
  items,
  organizationId,
  totalCount
}: {
  completedCount: number;
  items: ChecklistItem[];
  organizationId: string;
  totalCount: number;
}) {
  const [hidden, setHidden] = useState(false);
  const allComplete = completedCount === totalCount;
  const progress = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

  useEffect(() => {
    if (!allComplete) return;
    const timeout = window.setTimeout(() => setHidden(true), 2400);
    return () => window.clearTimeout(timeout);
  }, [allComplete]);

  if (hidden) {
    return null;
  }

  if (allComplete) {
    return (
      <section className="mb-4 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="text-[#16a34a]" />
          <div>
            <h2 className="font-black text-[#10252b]">Setup complete 🎉</h2>
            <p className="text-sm text-[#667085]">RouteHQ is ready for daily operations.</p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-lg border border-[#cfe2de] bg-[#fbfefd] p-4 shadow-[0_10px_24px_rgba(25,63,72,0.06)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-[#0f766e]">First week setup</p>
          <h2 className="text-xl font-black text-[#10252b]">Setup checklist</h2>
          <p className="mt-1 text-sm text-[#667085]">{completedCount}/{totalCount} complete</p>
        </div>
        <form action={dismissChecklist}>
          <input name="organizationId" type="hidden" value={organizationId} />
          <button aria-label="Hide checklist" className="pressable rounded-lg border border-[#d6e5e2] bg-white p-2 text-[#667085]" type="submit">
            <X size={17} />
          </button>
        </form>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#eef2f6]">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${progress}%` }} />
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {items.map((item) => (
          <Link className="pressable flex items-center justify-between gap-3 rounded-lg border border-[#d6e5e2] bg-white p-3 text-sm font-bold text-[#344054]" href={item.href as Route} key={item.step}>
            <span className="flex items-center gap-2">
              {item.completed ? <CheckCircle2 className="text-[#16a34a]" size={18} /> : <Circle className="text-[#94a3b8]" size={18} />}
              {item.label}
            </span>
            <span className="text-[#0f766e]">→</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
