import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink, Card } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingDetail, getCustomersForSelector } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { businessDay } from "@/lib/business-time";
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

  // Changes of vehicle on this booking, so a wrong date or starting vehicle can be corrected here.
  const [{ data: changeRows }, { data: fleetRows }] = await Promise.all([
    supabase.from("vehicle_changes").select("id, from_vehicle_id, to_vehicle_id, changed_at").eq("organization_id", organization.id).eq("rental_id", detail.rental.id).order("changed_at", { ascending: true }),
    supabase.from("vehicles").select("id, make, model, registration_number").eq("organization_id", organization.id).is("deleted_at", null).order("make", { ascending: true })
  ]);
  const vehicleLabel = (row: any) => [[row?.make, row?.model].filter(Boolean).join(" "), row?.registration_number].filter(Boolean).join(" · ");
  const fleetById = new Map<string, any>(((fleetRows || []) as any[]).map((row) => [row.id, row]));
  const vehicleChanges = ((changeRows || []) as any[]).map((row) => ({
    id: String(row.id),
    date: businessDay(row.changed_at),
    fromVehicleId: row.from_vehicle_id || null,
    fromLabel: vehicleLabel(fleetById.get(row.from_vehicle_id)) || "-",
    toLabel: vehicleLabel(fleetById.get(row.to_vehicle_id)) || "-"
  }));
  const fleet = ((fleetRows || []) as any[]).filter((row) => row.id !== detail.rental.vehicle_id).map((row) => ({ id: String(row.id), label: vehicleLabel(row) }));

  // Where the delivery map opens: the business's own area from setup, or nothing (never a fixed place).
  const settings = (organization as any).settings || {};
  const mainLocation = settings.main_location && typeof settings.main_location === "object" ? settings.main_location : {};
  const homeTerritory =
    typeof settings.home_territory === "string" && settings.home_territory.trim()
      ? settings.home_territory
      : [mainLocation.town || mainLocation.province, mainLocation.country].map((part: unknown) => String(part || "").trim()).filter(Boolean).join(", ");

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
          fleet={fleet}
          vehicleChanges={vehicleChanges}
        />
      </div>
    </AppShell>
  );
}
