import { said } from "@/lib/i18n/server-text";
import { isDoubleBookingError } from "@/lib/rental-conflicts";

/**
 * A booking with no customer yet (the renter hasn't filled in their link): makes a customer with this name and puts
 * it on the rental, its booking link and its agreement. When the renter opens the link later, it fills in this same
 * record. Returns the new customer's id. If the rental can't be linked, the new record is taken away again.
 */
export async function attachCustomerByName(supabase: any, args: { organizationId: string; rentalId: string; name: string }): Promise<string> {
  const { data: created, error } = await supabase.from("customers").insert({ organization_id: args.organizationId, full_name: args.name.slice(0, 120) }).select("id").single();
  if (error || !created?.id) throw new Error(error?.message || (await said("The customer could not be added.")));
  const [{ error: linkError }] = await Promise.all([
    supabase.from("rentals").update({ customer_id: created.id }).eq("id", args.rentalId).eq("organization_id", args.organizationId).is("customer_id", null),
    supabase.from("booking_links").update({ customer_id: created.id }).eq("rental_id", args.rentalId).is("customer_id", null),
    supabase.from("contracts").update({ customer_id: created.id }).eq("rental_id", args.rentalId).is("customer_id", null)
  ]);
  if (linkError) {
    await supabase.from("customers").update({ deleted_at: new Date().toISOString() }).eq("id", created.id).eq("organization_id", args.organizationId);
    throw new Error(isDoubleBookingError(linkError) ? await said("This vehicle is still out on another rental. Return it first or pick another vehicle.") : linkError.message);
  }
  return created.id as string;
}
