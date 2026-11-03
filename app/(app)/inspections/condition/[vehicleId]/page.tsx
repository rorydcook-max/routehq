import { InspectionForm } from "@/components/inspection-form";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getInspectionContextByVehicle } from "@/lib/inspection-detail";
import { getDefaultOrganization } from "@/lib/organization";

export default async function ConditionReportPage({ params }: { params: Promise<{ vehicleId: string }> }) {
  const { vehicleId } = await params;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const context = await getInspectionContextByVehicle(vehicleId, organization.id);

  return (
    <AppShell userEmail={userEmail}>
      <InspectionForm context={context} />
    </AppShell>
  );
}
