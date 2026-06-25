export type UpcomingPayment = {
  id: string;
  amount: number;
  currency: string;
  due_date: string | null;
  scheduled_date: string | null;
  status: string;
  days_until: number | null;
  metadata?: unknown;
};

export type VehicleEvent = {
  id: string;
  label: string;
  due_date: string;
  days_until: number;
  severity: "high" | "medium" | "low";
  type: "tax" | "insurance" | "porbor" | "service" | "task";
  task_id?: string;
};

export function daysUntilDate(value: string | null | undefined) {
  if (!value) return null;
  const today = new Date();
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}

function eventSeverity(daysUntil: number): VehicleEvent["severity"] {
  if (daysUntil <= 7) return "high";
  if (daysUntil <= 30) return "medium";
  return "low";
}

function dateOnly(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : "";
}

export function buildUpcomingPayments(payments: any[], currency = "THB"): UpcomingPayment[] {
  return (payments || [])
    .filter((payment: any) => {
      const metadata = payment.metadata || {};
      return (
        !payment.voided &&
        !metadata.voided &&
        !metadata.is_deposit &&
        !["paid", "waived", "voided"].includes(String(payment.status || "").toLowerCase())
      );
    })
    .map((payment: any) => ({
      id: payment.id,
      amount: Number(payment.amount || 0),
      currency: payment.currency || currency,
      due_date: payment.due_date || null,
      scheduled_date: payment.scheduled_date || null,
      status: String(payment.status || "pending"),
      days_until: daysUntilDate(payment.due_date),
      metadata: payment.metadata
    }))
    .sort((a, b) => {
      const left = a.due_date ? new Date(a.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      const right = b.due_date ? new Date(b.due_date).getTime() : Number.MAX_SAFE_INTEGER;
      return left - right;
    })
    .slice(0, 6);
}

export function buildVehicleEvents(vehicle: any, tasks: any[]): VehicleEvent[] {
  const events: VehicleEvent[] = [];
  const addComplianceEvent = (type: VehicleEvent["type"], label: string, value: string | null | undefined) => {
    const dueDate = dateOnly(value);
    const days = daysUntilDate(dueDate);
    if (!dueDate || days === null || days > 180) return;
    events.push({
      id: `${type}-${dueDate}`,
      label,
      due_date: dueDate,
      days_until: days,
      severity: eventSeverity(days),
      type
    });
  };

  addComplianceEvent("tax", "Vehicle tax expires", vehicle?.tax_expiry_date);
  addComplianceEvent("porbor", "Compulsory insurance expires", vehicle?.porbor_expiry_date);
  addComplianceEvent("insurance", "Full insurance expires", vehicle?.insurance_expiry_date);
  addComplianceEvent("service", "Scheduled service due", vehicle?.next_service_date);

  for (const task of tasks || []) {
    const dueDate = dateOnly(task.due_at || task.due_date);
    const days = daysUntilDate(dueDate);
    if (!dueDate || days === null || days > 180) continue;
    events.push({
      id: `task-${task.id}`,
      label: task.title || "Vehicle task",
      due_date: dueDate,
      days_until: days,
      severity: eventSeverity(days),
      type: "task",
      task_id: task.id
    });
  }

  return events.sort((a, b) => {
    if (a.days_until !== b.days_until) return a.days_until - b.days_until;
    return a.label.localeCompare(b.label);
  });
}
