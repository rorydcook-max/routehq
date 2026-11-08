import { getLocale } from "next-intl/server";
import { redirect } from "next/navigation";
import { InspectionForm } from "@/components/inspection-form";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { translateForReader } from "@/lib/content-translation";
import { getInspectionContextByRental } from "@/lib/inspection-detail";
import { getDefaultOrganization } from "@/lib/organization";

export default async function ReturnInspectionPage({ params, searchParams }: { params: Promise<{ rentalId: string }>; searchParams: Promise<{ swap?: string; vehicle?: string }> }) {
  const { rentalId } = await params;
  const query = await searchParams;
  const [userEmail, organization, locale] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getLocale()]);
  // ?swap=1&vehicle=...: collecting the original vehicle after a change of vehicle; the rental carries on.
  const context = await getInspectionContextByRental(rentalId, organization.id, "return", query.swap === "1" ? { vehicleId: query.vehicle || null } : undefined);
  // A rental already returned (or cancelled) has nothing to take back: opening the link again (browser history, an old
  // tab) walked through a second return form, "Deposit already given back", and saved a duplicate.
  if (query.swap !== "1" && ["completed", "cancelled"].includes(String((context as any).rental?.status || ""))) {
    redirect(`/bookings/${rentalId}`);
  }

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
