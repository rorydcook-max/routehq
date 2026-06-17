"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import { completeTask } from "@/app/actions/tasks";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui";
import type { TaskListItem } from "@/lib/tasks";

const filters = ["open", "completed", "all"] as const;

function formatWhen(value: string | null) {
  if (!value) return "No due date";
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function TasksList({ tasks, organizationId }: { tasks: TaskListItem[]; organizationId: string }) {
  const [filter, setFilter] = useState<(typeof filters)[number]>("open");

  const filtered = useMemo(() => {
    return tasks.filter((task) => {
      if (filter === "open") return !task.completedAt;
      if (filter === "completed") return !!task.completedAt;
      return true;
    });
  }, [filter, tasks]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {filters.map((entry) => (
          <button
            className={`pressable min-h-11 rounded-xl border px-4 py-2 text-sm font-black capitalize ${filter === entry ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white"}`}
            key={entry}
            onClick={() => setFilter(entry)}
            type="button"
          >
            {entry}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p className="text-lg font-black text-[#10252b]">No tasks in this view</p>
          <p className="mt-2 text-sm text-[#667085]">Delivery, pickup, and maintenance tasks will appear here when assigned.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => (
            <div className="content-section" key={task.id}>
              <div className="flex items-start gap-3">
                {task.completedAt ? (
                  <CheckCircle2 className="mt-1 text-emerald-600" size={22} />
                ) : (
                  <Circle className="mt-1 text-[var(--muted)]" size={22} />
                )}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-black text-[var(--foreground)]">{task.title}</p>
                    <Badge tone={task.completedAt ? "green" : "amber"}>{task.completedAt ? "Done" : "Open"}</Badge>
                    <Badge tone="neutral">{task.taskType.replace(/_/g, " ")}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">Due {formatWhen(task.dueAt)}</p>
                  {(task.vehicleLabel || task.rentalLabel) && (
                    <p className="text-sm font-semibold text-[var(--foreground-secondary)]">
                      {[task.vehicleLabel, task.rentalLabel].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {task.rentalId ? (
                      <Link className="text-sm font-bold text-[var(--primary)]" href={`/bookings/${task.rentalId}`}>
                        Open booking
                      </Link>
                    ) : null}
                    {task.vehicleId ? (
                      <Link className="text-sm font-bold text-[var(--primary)]" href={`/fleet/${task.vehicleId}`}>
                        Open vehicle
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              {!task.completedAt ? (
                <div className="mt-4 border-t border-[var(--border)] pt-4">
                  {task.rentalPaymentId ? (
                    <div className="mb-3 rounded-lg border border-[#a5f3fc] bg-[var(--primary-light)] p-3">
                      <p className="text-sm font-black text-[var(--foreground)]">Record the payment transaction too?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Link
                          className="primary-action pressable min-h-9 px-3 text-xs"
                          href={`/transactions/new?taskId=${task.id}&rentalPaymentId=${task.rentalPaymentId}`}
                        >
                          Yes - record payment
                        </Link>
                      </div>
                    </div>
                  ) : null}
                  <form action={completeTask} className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <input name="organizationId" type="hidden" value={organizationId} />
                    <input name="taskId" type="hidden" value={task.id} />
                    <label className="flex-1">
                      <span className="text-sm font-semibold text-[#344054]">Completion notes (optional)</span>
                      <input className="mt-1 w-full rounded-xl border border-[var(--border)] px-3 py-2 text-sm" name="notes" placeholder="Delivered to airport at 10:30" />
                    </label>
                    <PendingButton className="primary-action" pendingLabel="Saving..." type="submit">
                      {task.rentalPaymentId ? "Mark complete without recording" : "Mark complete"}
                    </PendingButton>
                  </form>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
