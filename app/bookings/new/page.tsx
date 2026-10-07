import { releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { onlineSigningGaps } from "@/lib/online-signing-readiness";
import { loadBusyPeriods } from "@/lib/rental-conflicts";
import { BookingForm } from "./booking-form";

type SearchParams = {
  vehicleId?: string;
  customerId?: string;
  startDate?: string;
  endDate?: string;
};

function operatorAddressFromSettings(settings: unknown) {
  if (!settings || typeof settings !== "object") {
    return "";
  }

  const values = settings as Record<string, unknown>;
  return String(values.address || values.business_address || values.collection_address || "").trim();
}

function homeTerritoryFromSettings(settings: unknown) {
  if (!settings || typeof settings !== "object") {
    return "Koh Samui, Thailand";
  }

  const values = settings as Record<string, unknown>;
  const mainLocation = values.main_location && typeof values.main_location === "object" ? values.main_location as Record<string, unknown> : {};
  return String(values.home_territory || mainLocation.town || mainLocation.province || "Koh Samui, Thailand").trim();
}

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const [{ vehicleId = "", customerId = "", startDate = "", endDate = "" }, userEmail, organization] = await Promise.all([
    searchParams,
    getCurrentUserEmail(),
    getDefaultOrganization()
  ]);
  await releaseExpiredHolds(createSupabaseAdminClient(), organization.id).catch(() => null);
  const supabase = (await createSupabaseServerClient()) as any;

  const [{ data: vehicles, error: vehiclesError }, { data: customers, error: customersError }, { data: organizationDetails }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, trim, year, registration_number, status, availability_status, daily_rate, weekly_rate, monthly_rate, deposit_amount, color, category_id")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, full_name, phone, nationality, document_status")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("*").eq("id", organization.id).maybeSingle()
  ]);

  if (vehiclesError || customersError) {
    throw new Error(vehiclesError?.message || customersError?.message || "Unable to load booking data.");
  }

  const signingGaps = organizationDetails ? onlineSigningGaps(organizationDetails) : [];
  const t = await getTranslations("newBooking");
  const busyPeriods = await loadBusyPeriods(supabase, organization.id);

  // Which kind each vehicle is, so the form can show a scooter as a scooter and offer a helmet, not a car seat.
  const { data: categoryRows } = await supabase.from("vehicle_categories").select("id, code");
  const categoryCodes = new Map<string, string>((categoryRows || []).map((row: any) => [row.id, row.code]));
  const normalizedVehicles = (vehicles || []).map((vehicle: any) => ({
    ...vehicle,
    category_code: categoryCodes.get(vehicle.category_id) || null,
    year: vehicle.year ? Number(vehicle.year) : null,
    daily_rate: Number(vehicle.daily_rate || 0),
    weekly_rate: Number(vehicle.weekly_rate || 0),
    deposit_amount: vehicle.deposit_amount === null || vehicle.deposit_amount === undefined ? null : Number(vehicle.deposit_amount),
    monthly_rate: Number(vehicle.monthly_rate || 0)
  }));

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        <div className="page-hero mb-5">
          <div>
            <Link className="text-sm font-bold text-[var(--primary)]" href="/bookings">
              {t("pageBack")}
            </Link>
            <h1 className="page-title mt-2">{t("pageTitle")}</h1>
            <p className="page-subtitle mt-2 hidden sm:block">{t("pageSubtitle")}</p>
          </div>
        </div>

        {signingGaps.length ? (
          <div className="mb-4 rounded-[var(--radius)] bg-[var(--warning-light)] p-4" role="alert">
            <p className="text-[17px] font-bold text-[var(--foreground)]">{t("signTitle")}</p>
            <p className="mt-1 font-medium text-[var(--foreground)]">{t("signBody")}</p>
            <Link className="primary-action pressable mt-3 w-full sm:w-auto" href="/settings/signature?back=/bookings/new">
              {t("goSettings")}
            </Link>
          </div>
        ) : null}

        {normalizedVehicles.length === 0 ? (
          <Card>
            <SectionHeader eyebrow={t("noVehiclesEyebrow")} title={t("noVehiclesTitle")} />
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{t("noVehiclesBody")}</p>
            <Link className="primary-action pressable mt-5" href="/fleet/new">
              {t("addVehicle")}
            </Link>
          </Card>
        ) : (
          <BookingForm
            busyPeriods={busyPeriods}
            customers={customers || []}
            defaultCurrency={organization.currency || "THB"}
            defaultDeposit={Number((organizationDetails?.settings as any)?.public_booking?.deposit || 0)}
            homeTerritory={homeTerritoryFromSettings(organizationDetails?.settings)}
            operatorAddress={operatorAddressFromSettings(organizationDetails?.settings)}
            organizationId={organization.id}
            organizationName={organization.name}
            preselectedCustomerId={customerId}
            preselectedEndDate={endDate}
          preselectedStartDate={startDate}
          preselectedVehicleId={vehicleId}
            vehicles={normalizedVehicles}
          />
        )}
      </div>
    </AppShell>
  );
}
