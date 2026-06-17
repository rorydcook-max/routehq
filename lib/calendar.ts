import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CalendarEvent = {
  id: string;
  date: string;
  title: string;
  tone: "blue" | "amber" | "red" | "green" | "purple";
  href: string;
  type: "rental_start" | "rental_end" | "rental_due" | "compliance" | "maintenance" | "payment" | "custom";
};

export async function getCalendarEvents(
  organisationId: string,
  year: number,
  month: number
): Promise<CalendarEvent[]> {
  const supabase = (await createSupabaseServerClient()) as any;
  const events: CalendarEvent[] = [];

  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = `${year}-${String(month).padStart(2, "0")}-31`;

  // Rentals
  const { data: rentals } = await supabase
    .from("rentals")
    .select("id, start_date, end_date, status, vehicles(make, model, registration_number)")
    .eq("organisation_id", organisationId)
    .or(`start_date.gte.${startDate},end_date.lte.${endDate}`)
    .not("status", "in", "(cancelled,completed)");

  for (const rental of rentals || []) {
    const vehicle = rental.vehicles as any;
    const label = vehicle ? `${vehicle.make} ${vehicle.model}` : "Vehicle";

    if (rental.start_date >= startDate && rental.start_date <= endDate) {
      events.push({
        id: `rental-start-${rental.id}`,
        date: rental.start_date,
        title: `Delivery: ${label}`,
        tone: "blue",
        href: `/bookings/${rental.id}`,
        type: "rental_start"
      });
    }

    if (rental.end_date && rental.end_date >= startDate && rental.end_date <= endDate) {
      events.push({
        id: `rental-end-${rental.id}`,
        date: rental.end_date,
        title: `Return: ${label}`,
        tone: rental.status === "overdue" ? "red" : "amber",
        href: `/bookings/${rental.id}`,
        type: "rental_end"
      });
    }
  }

  // Compliance reminders
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, tax_expiry_date, insurance_expiry_date, porbor_expiry_date, next_service_date")
    .eq("organisation_id", organisationId)
    .eq("is_active", true);

  for (const vehicle of vehicles || []) {
    const label = `${vehicle.make} ${vehicle.model}`;
    const complianceItems = [
      { date: vehicle.tax_expiry_date, title: `Tax expiry: ${label}` },
      { date: vehicle.insurance_expiry_date, title: `Insurance expiry: ${label}` },
      { date: vehicle.porbor_expiry_date, title: `พรบ expiry: ${label}` },
      { date: vehicle.next_service_date, title: `Service due: ${label}` }
    ];

    for (const item of complianceItems) {
      if (item.date && item.date >= startDate && item.date <= endDate) {
        events.push({
          id: `compliance-${vehicle.id}-${item.date}`,
          date: item.date,
          title: item.title,
          tone: "red",
          href: `/fleet/${vehicle.id}`,
          type: "compliance"
        });
      }
    }
  }

  return events.sort((a, b) => a.date.localeCompare(b.date));
}
