import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BookingForm } from "./booking-form";

type SearchParams = {
  vehicleId?: string;
  customerId?: string;
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
  const [{ vehicleId = "", customerId = "" }, userEmail, organization] = await Promise.all([
    searchParams,
    getCurrentUserEmail(),
    getDefaultOrganization()
  ]);
  const supabase = (await createSupabaseServerClient()) as any;

  const [{ data: vehicles, error: vehiclesError }, { data: customers, error: customersError }, { data: organizationDetails }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, make, model, trim, year, registration_number, status, availability_status, daily_rate, weekly_rate, monthly_rate, color")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase
      .from("customers")
      .select("id, full_name, phone, nationality, document_status")
      .eq("organization_id", organization.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    supabase.from("organizations").select("settings").eq("id", organization.id).maybeSingle()
  ]);

  if (vehiclesError || customersError) {
    throw new Error(vehiclesError?.message || customersError?.message || "Unable to load booking data.");
  }

  const normalizedVehicles = (vehicles || []).map((vehicle: any) => ({
    ...vehicle,
    year: vehicle.year ? Number(vehicle.year) : null,
    daily_rate: Number(vehicle.daily_rate || 0),
    weekly_rate: Number(vehicle.weekly_rate || 0),
    monthly_rate: Number(vehicle.monthly_rate || 0)
  }));

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-2xl">
        <div className="page-hero mb-5">
          <div>
            <Link className="text-sm font-bold text-[var(--primary)]" href="/bookings">
              Back to bookings
            </Link>
            <h1 className="page-title mt-2">Create booking</h1>
            <p className="page-subtitle mt-2">Select the vehicle, customer, dates, delivery details, then generate a customer booking link.</p>
          </div>
        </div>

        {normalizedVehicles.length === 0 ? (
          <Card>
            <SectionHeader eyebrow="No vehicles" title="Add a vehicle before creating bookings" />
            <p className="mt-3 text-sm leading-6 text-[#667085]">Bookings need a vehicle record so FleetOS can connect rental dates, inspections, payments, and profitability to the right asset.</p>
            <Link className="primary-action pressable mt-5" href="/fleet/new">
              Add vehicle
            </Link>
          </Card>
        ) : (
          <BookingForm
            customers={customers || []}
            defaultCurrency={organization.currency || "THB"}
            homeTerritory={homeTerritoryFromSettings(organizationDetails?.settings)}
            operatorAddress={operatorAddressFromSettings(organizationDetails?.settings)}
            organizationId={organization.id}
            organizationName={organization.name}
            preselectedCustomerId={customerId}
            preselectedVehicleId={vehicleId}
            vehicles={normalizedVehicles}
          />
        )}
      </div>
    </AppShell>
  );
}
