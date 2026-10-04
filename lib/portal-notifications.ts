import { niceDate } from "@/lib/nice-date";
import { tryAutoExtend, type ExtensionOutcome } from "@/lib/auto-extension";
import { recordActivityEvent } from "@/lib/supabase/activity";

function actionLabel(type: string) {
  return type.replace(/_/g, " ");
}

function contentText(content: any) {
  if (!content || typeof content !== "object") return "";
  return content.description || content.question || content.note || content.return_location || content.new_end_date || (content.open_ended ? "Keep the vehicle with no end date" : "");
}

export async function processCustomerPortalAction(supabase: any, actionId: string) {
  const { data: action, error } = await supabase
    .from("customer_portal_actions")
    .select("*, rentals!customer_portal_actions_rental_id_fkey(id, organization_id, vehicle_id, customer_id, end_date, vehicles!rentals_vehicle_id_fkey(make, model, registration_number), customers!rentals_customer_id_fkey(full_name))")
    .eq("id", actionId)
    .maybeSingle();

  if (error || !action) {
    throw new Error(error?.message || "Portal action not found.");
  }

  const rental = action.rentals || {};
  const vehicle = rental.vehicles || {};
  const customer = rental.customers || {};
  const organizationId = action.organisation_id || rental.organization_id;
  const vehicleLabel = [vehicle.make, vehicle.model].filter(Boolean).join(" ") || "Vehicle";
  const customerName = customer.full_name || "Customer";
  const content = action.content || {};
  const bookingPath = `/bookings/${action.rental_id}`;
  const taskBase = {
    organization_id: organizationId,
    vehicle_id: rental.vehicle_id || null,
    rental_id: action.rental_id,
    title_key: null,
    created_by: null,
    // Lets the to-do list offer "Answer" and lets the job close itself when the request is answered.
    action: "request",
    portal_action_id: action.id
  };

  let extension: ExtensionOutcome | null = null;
  if (action.action_type === "extension_request") {
    // Applied on the spot when nothing is in the way; otherwise it becomes a job for the team.
    extension = await tryAutoExtend(supabase, action.rental_id, content.new_end_date, { openEnded: !!content.open_ended }).catch(() => ({ applied: false as const, reason: "it could not be applied automatically" }));
    if (extension.applied) {
      await supabase.from("customer_portal_actions").update({ status: "resolved" }).eq("id", action.id);
    } else {
      await supabase.from("tasks").insert({
        ...taskBase,
        title: `${content.open_ended ? "Request to switch to monthly, open-ended" : `Extension to ${content.new_end_date ? niceDate(content.new_end_date) : "a new date"}`} needs your answer - ${customerName} - ${vehicleLabel} (${extension.reason})`,
        task_type: "admin",
        // Needs an answer now, not on the date they asked for.
        due_at: new Date().toISOString()
      });
    }
  }

  if (action.action_type === "return_confirmation") {
    const returnDateTime = [content.return_date, content.return_time].filter(Boolean).join("T") || null;
    await Promise.all([
      supabase
        .from("rentals")
        .update({
          delivery_location: content.return_location || undefined,
          metadata: {
            customer_confirmed_return: {
              date: content.return_date || null,
              time: content.return_time || null,
              location: content.return_location || null,
              note: content.note || null
            }
          }
        })
        .eq("id", action.rental_id)
        .eq("organization_id", organizationId),
      supabase.from("tasks").insert({
        ...taskBase,
        title: `Confirmed return - ${customerName} - ${vehicleLabel}`,
        task_type: "return",
        due_at: returnDateTime
      })
    ]);
  }

  if (action.action_type === "problem_report") {
    await supabase.from("tasks").insert({
      ...taskBase,
      title: `URGENT customer problem - ${customerName} - ${vehicleLabel}`,
      task_type: "maintenance",
      due_at: new Date().toISOString(),
      completion_notes: content.description || null
    });
  }

  if (action.action_type === "question") {
    await supabase.from("tasks").insert({
      ...taskBase,
      title: `Customer question - ${customerName} - ${vehicleLabel}`,
      task_type: "admin",
      due_at: new Date().toISOString(),
      completion_notes: content.question || null
    });
  }

  await Promise.all([
    supabase.from("notifications").insert({
      organization_id: organizationId,
      customer_id: action.customer_id || rental.customer_id || null,
      rental_id: action.rental_id,
      vehicle_id: rental.vehicle_id || null,
      channel: "in_app",
      provider: "routehq",
      locale: "en",
      status: "queued",
      recipient: organizationId,
      subject: action.action_type === "problem_report" ? "URGENT customer portal report" : `Customer portal action: ${actionLabel(action.action_type)}`,
      body: `${customerName}: ${contentText(content) || actionLabel(action.action_type)}`,
      metadata: {
        customer_portal_action_id: action.id,
        booking_path: bookingPath,
        urgent: action.action_type === "problem_report"
      }
    }),
    recordActivityEvent(supabase, {
      organization_id: organizationId,
      entity_type: "rental",
      entity_id: action.rental_id,
      vehicle_id: rental.vehicle_id || null,
      rental_id: action.rental_id,
      customer_id: action.customer_id || rental.customer_id || null,
      event_type: `customer_portal_${action.action_type}`,
      title: `Customer portal: ${actionLabel(action.action_type)}`,
      detail: contentText(content),
      metadata: { customer_portal_action_id: action.id, content }
    })
  ]);

  return { success: true, extension };
}
