/** Reading RoveHQ's renter list for the RoveHQ team (lib/renters.ts writes it). Server only. */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type RenterRental = {
  rental_id: string;
  operator_name: string | null;
  town: string | null;
  region: string | null;
  booked_via: string | null;
  vehicle: string | null;
  vehicle_type: string | null;
  vehicle_year: number | null;
  start_date: string | null;
  end_date: string | null;
  days: number | null;
  status: string | null;
  active: boolean;
  rate_type: string | null;
  open_ended: boolean;
  rate: number | null;
  currency: string | null;
  extras: Array<{ name?: string; amount?: number; per?: string }>;
  extras_total: number | null;
  total_paid: number | null;
  deposit: number | null;
  deposit_outcome: string | null;
  deposit_returned: number | null;
  deposit_kept: number | null;
  ended_early: boolean;
  days_early: number | null;
  damage_items: number;
  damage_charged: number | null;
  km_driven: number | null;
  delivery_place: string | null;
};

export type Renter = {
  id: string;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  whatsapp: string | null;
  line_id: string | null;
  nationality: string | null;
  licence_country: string | null;
  language: string | null;
  date_of_birth: string | null;
  consented_at: string | null;
  first_rental_on: string | null;
  last_rental_on: string | null;
  rentals: RenterRental[];
};

export type RenterFilters = { q?: string; town?: string; nationality?: string; now?: boolean; rate?: string };

const num = (value: unknown) => (value === null || value === undefined || value === "" ? null : Number(value));

/** Everyone whose answer is yes, newest rental first, with their rentals; filters applied here. */
export async function listRenters(filters: RenterFilters = {}) {
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("renters")
    .select("id, full_name, phone, email, whatsapp, line_id, nationality, licence_country, language, date_of_birth, consented_at, first_rental_on, last_rental_on, renter_rentals(*)")
    .eq("offers", true)
    .order("last_rental_on", { ascending: false, nullsFirst: false })
    .limit(2000);
  let renters: Renter[] = ((data || []) as any[]).map((row) => ({
    ...row,
    rentals: ((row.renter_rentals || []) as any[])
      .map((rental) => ({
        ...rental,
        rate: num(rental.rate),
        extras_total: num(rental.extras_total),
        total_paid: num(rental.total_paid),
        deposit: num(rental.deposit),
        deposit_returned: num(rental.deposit_returned),
        deposit_kept: num(rental.deposit_kept),
        damage_charged: num(rental.damage_charged),
        extras: Array.isArray(rental.extras) ? rental.extras : []
      }))
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))
  }));

  const allTowns = Array.from(new Set(renters.flatMap((renter) => renter.rentals.map((rental) => rental.town).filter(Boolean) as string[]))).sort();
  const allNationalities = Array.from(new Set(renters.map((renter) => renter.nationality).filter(Boolean) as string[])).sort();

  const q = (filters.q || "").trim().toLowerCase();
  if (q) renters = renters.filter((renter) => [renter.full_name, renter.phone, renter.email, renter.whatsapp].some((value) => String(value || "").toLowerCase().includes(q)));
  if (filters.town) renters = renters.filter((renter) => renter.rentals.some((rental) => rental.town === filters.town));
  if (filters.nationality) renters = renters.filter((renter) => renter.nationality === filters.nationality);
  if (filters.now) renters = renters.filter((renter) => renter.rentals.some((rental) => rental.active));
  if (filters.rate) renters = renters.filter((renter) => renter.rentals.some((rental) => (filters.rate === "open" ? rental.open_ended : rental.rate_type === filters.rate && !rental.open_ended)));

  return { renters, towns: allTowns, nationalities: allNationalities };
}

/** Headline numbers: how big the list is and how it is growing against everyone who booked through RoveHQ. */
export async function renterStats() {
  const admin = createSupabaseAdminClient() as any;
  const [{ count: optedIn }, { data: bookers }, { data: rentals }] = await Promise.all([
    admin.from("renters").select("id", { count: "exact", head: true }).eq("offers", true),
    admin.from("booking_links").select("customer_id").not("customer_details_submitted_at", "is", null).not("customer_id", "is", null).is("deleted_at", null).limit(50000),
    admin.from("renter_rentals").select("active, total_paid, days, renters!inner(offers)").eq("renters.offers", true).limit(50000)
  ]);
  const bookedThroughRouteHQ = new Set(((bookers || []) as Array<{ customer_id: string }>).map((row) => row.customer_id)).size;
  const rows = (rentals || []) as Array<{ active: boolean; total_paid: number | null; days: number | null }>;
  return {
    optedIn: optedIn || 0,
    bookedThroughRouteHQ,
    rentingNow: rows.filter((row) => row.active).length,
    paid: rows.reduce((sum, row) => sum + Number(row.total_paid || 0), 0),
    averageDays: rows.length ? Math.round(rows.reduce((sum, row) => sum + Number(row.days || 0), 0) / rows.length) : 0
  };
}
