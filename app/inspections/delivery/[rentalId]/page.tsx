import { InspectionForm } from "@/components/inspection-form";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getInspectionContextByRental } from "@/lib/inspection-detail";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DeliveryInspectionPage({ params, searchParams }: { params: Promise<{ rentalId: string }>; searchParams: Promise<{ swap?: string; vehicle?: string }> }) {
  const { rentalId } = await params;
  const query = await searchParams;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  // ?swap=1: a change of vehicle during the rental (see lib/inspection-detail.ts).
  const context = await getInspectionContextByRental(rentalId, organization.id, "delivery", query.swap === "1" ? { vehicleId: query.vehicle || null } : undefined);

  // A booking sent to the customer that they have not signed yet: say so before the keys change hands.
  let unsigned = false;
  if (query.swap !== "1" && String((context as any).rental?.status || "") === "booked") {
    const supabase = (await createSupabaseServerClient()) as any;
    const { data: links } = await supabase.from("booking_links").select("contract_signed_at").eq("rental_id", rentalId).is("deleted_at", null);
    unsigned = (links || []).length > 0 && (links || []).every((link: any) => !link.contract_signed_at);
  }

  return (
    <AppShell userEmail={userEmail}>
      <InspectionForm context={context} unsigned={unsigned} />
    </AppShell>
  );
}
