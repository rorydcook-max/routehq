"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { recordActivityEvent } from "@/lib/supabase/activity";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function completeTask(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const taskId = String(formData.get("taskId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const vehicleId = String(formData.get("vehicleId") || "");
  const notes = String(formData.get("notes") || "").trim() || null;

  if (!taskId || !organizationId) {
    throw new Error("Task and organization are required.");
  }

  const { error } = await supabase
    .from("tasks")
    .update({
      completed_at: new Date().toISOString(),
      completion_notes: notes
    })
    .eq("id", taskId)
    .eq("organization_id", organizationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/calendar");
  if (vehicleId) {
    revalidatePath(`/fleet/${vehicleId}`);
  }
  revalidatePath("/");
}

export async function createVehicleTask(formData: FormData) {
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const vehicleId = String(formData.get("vehicleId") || "");
  const organizationId = String(formData.get("organizationId") || "");
  const title = String(formData.get("title") || "").trim();
  const taskType = String(formData.get("taskType") || "other").trim() || "other";
  const dueDate = String(formData.get("dueDate") || "").trim() || null;

  if (!vehicleId || !organizationId || !title) {
    throw new Error("Task title and vehicle are required.");
  }

  const { data: task, error } = await supabase
    .from("tasks")
    .insert({
      organization_id: organizationId,
      vehicle_id: vehicleId,
      title,
      task_type: taskType,
      due_at: dueDate,
      created_by: user.id
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  await recordActivityEvent(supabase, {
    organization_id: organizationId,
    actor_id: user.id,
    entity_type: "task",
    entity_id: task.id,
    vehicle_id: vehicleId,
    event_type: "task_created",
    title: "Vehicle task added",
    detail: title
  });

  revalidatePath("/");
  revalidatePath("/calendar");
  revalidatePath(`/fleet/${vehicleId}`);
  redirect(`/fleet/${vehicleId}`);
}
