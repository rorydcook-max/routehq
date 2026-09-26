import Link from "next/link";
import type { Route } from "next";
import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingDetail, getCustomersForSelector } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingEditForm } from "./booking-edit-form";

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [detail, customers] = await Promise.all([
    getBookingDetail(id, organization.id),
    getCustomersForSelector(organization.id)
  ]);

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <Card>
          <SectionHeader eyebrow="Booking not found" title="This rental could not be opened" />
          <div className="card-section">
            <p className="text-sm text-[var(--muted)]">It may have been cancelled, deleted, or belong to another organisation.</p>
            <Link className="primary-action pressable mt-3" href="/bookings">
              Back to bookings
            </Link>
          </div>
        </Card>
      </AppShell>
    );
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const { data: signedAgreements } = await supabase
    .from("rental_documents")
    .select("id")
    .eq("organization_id", organization.id)
    .eq("rental_id", detail.rental.id)
    .eq("document_type", "rental_agreement")
    .eq("status", "signed")
    .limit(1);
  const agreementSigned = Boolean(signedAgreements?.length);

  const homeTerritory =
    typeof (organization as any).settings?.home_territory === "string"
      ? (organization as any).settings.home_territory
      : "Koh Samui, Thailand";

  return (
    <AppShell userEmail={userEmail}>
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-[var(--muted)]">
          <Link className="text-[var(--primary)]" href="/bookings">Bookings</Link>
          <span>/</span>
          <Link className="text-[var(--primary)]" href={`/bookings/${detail.rental.id}` as Route}>
            {detail.rental.reference || detail.rental.display_code || "Booking"}
          </Link>
          <span>/</span>
          <span>Edit</span>
        </div>

        <BookingEditForm
          agreementSigned={agreementSigned}
          bookingLink={detail.bookingLink}
          customers={customers}
          homeTerritory={homeTerritory}
          payments={detail.payments}
          rental={detail.rental}
        />
      </div>
    </AppShell>
  );
}
