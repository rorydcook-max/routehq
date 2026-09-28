export const TASK_TYPE_OPTIONS = [
  { value: "delivery", label: "Delivery" },
  { value: "return", label: "Return" },
  { value: "maintenance", label: "Maintenance" },
  { value: "payment", label: "Payment" },
  { value: "compliance", label: "Compliance" },
  { value: "inspection", label: "Inspection" },
  { value: "admin", label: "Admin" },
  { value: "other", label: "Other" }
] as const;

export function taskTypeLabel(value: string) {
  const known = TASK_TYPE_OPTIONS.find((option) => option.value === value);
  if (known) return known.label;
  if (value === "payment_reminder") return "Payment";
  const text = value.replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
}
