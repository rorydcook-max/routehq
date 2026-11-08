"use server";

import { guard } from "@/lib/action-error";

import { revalidatePath } from "next/cache";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { linkPaymentsToRental, markNotFromRental } from "@/lib/loose-payments";

/** "Yes, these are from this booking": links the ticked payments (Rory, 2 Nov 2026). */
/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function linkLoosePayments(...args: Parameters<typeof linkLoosePaymentsOrThrow>) {
  return guard(() => linkLoosePaymentsOrThrow(...args));
}

async function linkLoosePaymentsOrThrow(formData: FormData) {
  const rentalId = String(formData.get("rentalId") || "");
  const picked = formData.getAll("transactionId").map(String).filter(Boolean);
  const offered = formData.getAll("offeredId").map(String).filter(Boolean);
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const { data: rental } = await supabase.from("rentals").select("id, organization_id, customer_id, vehicle_id").eq("id", rentalId).eq("organization_id", organization.id).maybeSingle();
  if (!rental) return;
  await linkPaymentsToRental(supabase, rental, picked);
  // The ones left unticked aren't from this booking: don't ask again.
  await markNotFromRental(supabase, organization.id, rental.id, offered.filter((id) => !picked.includes(id)));
  revalidatePath(`/bookings/${rental.id}`);
  revalidatePath("/transactions");
}

/** "No, none of these": stops asking on this booking. */
export async function dismissLoosePayments(formData: FormData) {
  const rentalId = String(formData.get("rentalId") || "");
  const offered = formData.getAll("offeredId").map(String).filter(Boolean);
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  await markNotFromRental(supabase, organization.id, rentalId, offered);
  revalidatePath(`/bookings/${rentalId}`);
}
