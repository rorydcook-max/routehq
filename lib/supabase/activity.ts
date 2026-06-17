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
