import type { CalendarEvent } from "@/lib/calendar";
import type { TaskListItem } from "@/lib/tasks";

/**
 * Open jobs from To do as calendar entries on their due day, so the calendar
 * and To do tell the same story. Money decisions (refunds, waivers) are left
 * out for someone who cannot make them.
 */
export function taskCalendarEvents(
  tasks: TaskListItem[],
  options: { from: string; to: string; today: string; canDecide: boolean; describe: (task: TaskListItem) => string }
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  for (const task of tasks) {
    if (task.kind !== "task" || task.completedAt || task.coveredBy || !task.dueDate) continue;
    if (!options.canDecide && ["refund", "waive_early", "owed_early"].includes(String(task.action || ""))) continue;
    const due = String(task.dueDate).slice(0, 10);
    if (due < options.from || due > options.to) continue;
    const waiting = task.action === "request";
    events.push({
      id: `task-${task.id}`,
      date: due,
      title: options.describe(task),
      tone: due < options.today ? "red" : "purple",
      href: waiting && task.rentalId ? `/bookings/${task.rentalId}#customer-requests` : "/tasks",
      type: "task"
    });
  }
  return events;
}
