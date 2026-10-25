import { NextResponse, type NextRequest } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { isPlatformAdmin } from "@/lib/support";
import { listRenters } from "@/lib/renters-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** The renter list as a spreadsheet (one row per rental), for partner campaigns. RouteHQ team only. */
export async function GET(request: NextRequest) {
  const membership = await getCurrentMembership();
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership?.userId))) return new NextResponse("Not found", { status: 404 });
  const params = request.nextUrl.searchParams;
  const { renters } = await listRenters({ q: params.get("q") || "", town: params.get("town") || "", nationality: params.get("nationality") || "", now: params.get("now") === "1", rate: params.get("rate") || "" });

  const header = [
    "renter_id", "name", "phone", "whatsapp", "line_id", "email", "nationality", "licence_country", "language", "date_of_birth", "agreed_on",
    "operator", "town", "region", "booked_via", "vehicle", "vehicle_type", "vehicle_year", "start_date", "end_date", "days", "status", "renting_now",
    "rate_type", "open_ended", "rate", "currency", "extras", "extras_total", "rent_paid", "deposit", "deposit_outcome", "deposit_returned", "deposit_kept",
    "ended_early", "days_early", "new_damage_items", "damage_charged", "km_driven", "delivery_place"
  ];
  const cell = (value: unknown) => {
    const text = value === null || value === undefined ? "" : String(value);
    // Quoted, and a leading = + - @ neutralised so a spreadsheet never runs it as a formula (phone numbers and plain
    // numbers like "+66 81 234 5678" or "-500" are left as they are).
    const risky = /^[=+\-@]/.test(text) && !/^[+\-]?[\d\s().-]+$/.test(text);
    return `"${(risky ? `'${text}` : text).replace(/"/g, '""')}"`;
  };
  const lines = [header.join(",")];
  for (const renter of renters) {
    const person = [renter.id, renter.full_name, renter.phone, renter.whatsapp, renter.line_id, renter.email, renter.nationality, renter.licence_country, renter.language, renter.date_of_birth, renter.consented_at?.slice(0, 10)];
    const rentals = renter.rentals.length ? renter.rentals : [null];
    for (const rental of rentals) {
      const facts = rental
        ? [rental.operator_name, rental.town, rental.region, rental.booked_via || "operator", rental.vehicle, rental.vehicle_type, rental.vehicle_year, rental.start_date, rental.end_date, rental.days, rental.status, rental.active ? "yes" : "no",
           rental.rate_type, rental.open_ended ? "yes" : "no", rental.rate, rental.currency, rental.extras.map((extra) => extra.name).filter(Boolean).join("; "), rental.extras_total, rental.total_paid, rental.deposit, rental.deposit_outcome, rental.deposit_returned, rental.deposit_kept,
           rental.ended_early ? "yes" : "no", rental.days_early, rental.damage_items, rental.damage_charged, rental.km_driven, rental.delivery_place]
        : [];
      lines.push([...person, ...facts].map(cell).join(","));
    }
  }
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(`﻿${lines.join("\r\n")}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="routehq-renters-${today}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
