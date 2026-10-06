import { CarFront, CheckCircle2, ClipboardList, FileText, MessageSquare, ReceiptText, Undo2, Wallet, Wrench } from "lucide-react";

/**
 * A small tinted square that says what kind of job or entry this is, so a
 * list can be sorted by eye before it is read. Colour here is information:
 * sage for money, clay for refunds, sand for forms, marine for the vehicle
 * moving or being worked on, plum for messages. Buttons never use these.
 */
export type JobKind = "money" | "receipt" | "refund" | "form" | "move" | "vehicle" | "message" | "done";

const look: Record<JobKind, { className: string; Icon: typeof Wallet }> = {
  money: { className: "kind-money", Icon: Wallet },
  receipt: { className: "kind-money", Icon: ReceiptText },
  refund: { className: "kind-refund", Icon: Undo2 },
  form: { className: "kind-form", Icon: FileText },
  move: { className: "kind-move", Icon: CarFront },
  vehicle: { className: "kind-move", Icon: Wrench },
  message: { className: "kind-message", Icon: MessageSquare },
  done: { className: "kind-money", Icon: CheckCircle2 }
};

/** Which kind a To do item is, from its fields. */
export function jobKind(item: { kind: string; action?: string | null; taskType?: string | null; completedAt?: string | null; receipt?: unknown }): JobKind {
  if (item.completedAt) return "done";
  if (item.kind === "payment") return item.receipt ? "receipt" : "money";
  const action = String(item.action || "");
  if (action === "refund") return "refund";
  if (action === "request") return "message";
  if (action === "swap_handover" || action === "swap_collection") return "move";
  if (action === "swap_signature") return "form";
  const type = String(item.taskType || "");
  if (type === "delivery" || type === "return") return "move";
  if (type === "maintenance" || type === "compliance" || type === "inspection") return "vehicle";
  if (type === "payment" || type === "payment_reminder") return "money";
  return "form";
}

export function KindChip({ kind, className = "" }: { kind: JobKind; className?: string }) {
  const { className: tone, Icon } = look[kind] ?? { className: "kind-form", Icon: ClipboardList };
  return (
    <span aria-hidden="true" className={`kind-chip ${tone} ${className}`}>
      <Icon size={18} strokeWidth={1.8} />
    </span>
  );
}
