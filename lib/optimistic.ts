export type OptimisticOperation<T> =
  | { type: "create"; record: T }
  | { type: "update"; id: string; patch: Partial<T> }
  | { type: "delete"; id: string };

export function applyOptimisticOperation<T extends { id: string }>(
  records: T[],
  operation: OptimisticOperation<T>
) {
  if (operation.type === "create") {
    return [operation.record, ...records];
  }

  if (operation.type === "update") {
    return records.map((record) => (record.id === operation.id ? { ...record, ...operation.patch } : record));
  }

  return records.filter((record) => record.id !== operation.id);
}
