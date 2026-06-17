import { InspectionForm } from "@/components/inspection-form";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getInspectionContextByRental } from "@/lib/inspection-detail";
import { getDefaultOrganization } from "@/lib/organization";

export default async function DeliveryInspectionPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const { rentalId } = await params;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const context = await getInspectionContextByRental(rentalId, organization.id, "delivery");

  return (
    <AppShell userEmail={userEmail}>
      <InspectionForm context={context} />
    </AppShell>
  );
}
