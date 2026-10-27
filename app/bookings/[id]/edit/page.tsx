import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink, Card } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingDetail, getCustomersForSelector } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingEditForm } from "./booking-edit-form";

export default async function EditBookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const say = (await getTranslations("bookingEdit")) as unknown as (key: string) => string;
  const [detail, customers] = await Promise.all([getBookingDetail(id, organization.id), getCustomersForSelector(organization.id)]);

  if (!detail) {
    return (
      <AppShell userEmail={userEmail}>
        <div className="page-form">
          <Card className="p-5">
            <h1 className="text-[22px] font-bold text-[var(--foreground)]">{say("nf_title")}</h1>
            <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("nf_body")}</p>
            <Link className="primary-action pressable mt-4" href="/bookings">
              {say("nf_back")}
            </Link>
          </Card>
        </div>
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
    typeof (organization as any).settings?.home_territory === "string" ? (organization as any).settings.home_territory : "Koh Samui, Thailand";

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form space-y-3">
        <div>
          <BackLink href={`/bookings/${detail.rental.id}`} label={detail.rental.customers?.full_name || detail.rental.reference || detail.rental.display_code || say("booking")} />
          <h1 className="text-[28px] leading-tight tracking-[-0.02em] text-[var(--foreground)]">{say("title")}</h1>
          <p className="mt-0.5 font-semibold text-[var(--foreground-secondary)]">{detail.rental.reference || detail.rental.display_code || say("booking")}</p>
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
