import type { TableInsert } from "@/lib/supabase/database.types";

export async function recordActivityEvent(
  supabase: any,
  payload: TableInsert<"activity_events">
) {
  const { error } = await supabase.from("activity_events").insert(payload);

  if (error) {
    throw new Error(error.message);
  }
}

export async function recordActivityEventOnce(
  supabase: any,
  payload: TableInsert<"activity_events">,
  idempotencyKey: string
) {
  const { error } = await supabase.from("activity_events").insert({
    ...payload,
    metadata: {
      ...((payload.metadata && typeof payload.metadata === "object") ? payload.metadata : {}),
      idempotency_key: idempotencyKey
    }
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}
