import { getLocale } from "next-intl/server";
import { InspectionForm } from "@/components/inspection-form";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { translateForReader } from "@/lib/content-translation";
import { getInspectionContextByRental } from "@/lib/inspection-detail";
import { getDefaultOrganization } from "@/lib/organization";

export default async function ReturnInspectionPage({ params }: { params: Promise<{ rentalId: string }> }) {
  const { rentalId } = await params;
  const [userEmail, organization, locale] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getLocale()]);
  const context = await getInspectionContextByRental(rentalId, organization.id, "return");

  // Damage noted at delivery may have been typed in another language; show it
  // to whoever does the return in theirs (the original stays alongside).
  const deliveryDamage = Array.isArray(context.deliveryInspection?.damage_items) ? (context.deliveryInspection.damage_items as any[]) : [];
  if (deliveryDamage.length) {
    const readable = await translateForReader(
      organization.id,
      deliveryDamage.map((item) => item?.description),
      locale
    );
    context.deliveryInspection = {
      ...context.deliveryInspection,
      damage_items: deliveryDamage.map((item, index) =>
        readable[index]?.translated ? { ...item, description_translated: readable[index].text } : item
      )
    };
  }

  return (
    <AppShell userEmail={userEmail}>
      <InspectionForm context={context} />
    </AppShell>
  );
}
