import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * A business's bookings as a calendar feed (iCalendar), for Google Calendar, Apple Calendar or Outlook to subscribe to.
 * The address carries a long random token (settings.calendar_feed_token) made in Settings › Integrations;
 * making a new one there stops the old address working. Read-only, no sign-in, so it holds only what a
 * calendar needs: vehicle, customer's name, dates and where.
 * Each booking is two events: the handover (going out) and the return (coming back), on their days, plus
 * the time when one was set.
 */
export const dynamic = "force-dynamic";

const esc = (value: string) => value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
const day = (iso: string) => iso.slice(0, 10).replace(/-/g, "");
const nextDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10).replace(/-/g, "");
};
const stamp = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
/** Lines longer than 75 octets are folded, as the format requires. */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest, "utf8") > 74) {
    let cut = 74;
    while (Buffer.byteLength(rest.slice(0, cut), "utf8") > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = ` ${rest.slice(cut)}`;
  }
  out.push(rest);
  return out.join("\r\n");
};

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const clean = String(token || "").replace(/\.ics$/i, "");
  if (!/^[a-f0-9]{32,}$/i.test(clean)) return new Response("Not found", { status: 404 });
  const db = createSupabaseAdminClient() as any;
  const { data: org } = await db.from("organizations").select("id, name, settings").eq("settings->>calendar_feed_token", clean).maybeSingle();
  if (!org) return new Response("Not found", { status: 404 });

  // From 60 days back, so recent history stays visible, through everything ahead.
  const since = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const { data: rentals } = await db
    .from("rentals")
    .select("id, display_code, start_date, end_date, is_indefinite, status, delivery_location, return_location, delivery_datetime, collection_datetime, updated_at, customers(full_name), vehicles(make, model, registration_number)")
    .eq("organization_id", org.id)
    .is("deleted_at", null)
    .in("status", ["booked", "active", "completed"])
    .or(`end_date.gte.${since},end_date.is.null,is_indefinite.eq.true`)
    .order("start_date", { ascending: true })
    .limit(1500);

  const appUrl = String(process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  const now = stamp(new Date());
  const lines: string[] = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//RouteHQ//Bookings//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", `X-WR-CALNAME:${esc(`${org.name || "RouteHQ"} bookings`)}`, "X-WR-TIMEZONE:Asia/Bangkok", "REFRESH-INTERVAL;VALUE=DURATION:PT1H", "X-PUBLISHED-TTL:PT1H"];

  const event = (uid: string, summary: string, date: string, time: string | null, location: string | null, description: string, updated: string | null) => {
    lines.push("BEGIN:VEVENT", `UID:${uid}@routehq.app`, `DTSTAMP:${updated ? stamp(new Date(updated)) : now}`);
    if (time) {
      const start = new Date(time);
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(new Date(start.getTime() + 30 * 60_000))}`);
    } else {
      lines.push(`DTSTART;VALUE=DATE:${day(date)}`, `DTEND;VALUE=DATE:${nextDay(date)}`, "TRANSP:TRANSPARENT");
    }
    lines.push(fold(`SUMMARY:${esc(summary)}`));
    if (location) lines.push(fold(`LOCATION:${esc(location)}`));
    lines.push(fold(`DESCRIPTION:${esc(description)}`), "END:VEVENT");
  };

  for (const r of (rentals || []) as any[]) {
    const vehicle = [r.vehicles?.make, r.vehicles?.model].filter(Boolean).join(" ") || "Vehicle";
    const plate = r.vehicles?.registration_number ? ` (${r.vehicles.registration_number})` : "";
    const who = r.customers?.full_name || "Customer";
    const link = appUrl ? `\n${appUrl}/bookings/${r.id}` : "";
    const ref = r.display_code ? `${r.display_code} · ` : "";
    if (r.start_date) event(`out-${r.id}`, `Out: ${vehicle} → ${who}`, r.start_date, r.delivery_datetime, r.delivery_location, `${ref}${vehicle}${plate} goes out to ${who}.${link}`, r.updated_at);
    if (r.end_date && !r.is_indefinite) event(`back-${r.id}`, `Back: ${vehicle} ← ${who}`, r.end_date, r.collection_datetime, r.return_location, `${ref}${vehicle}${plate} comes back from ${who}.${link}`, r.updated_at);
  }
  lines.push("END:VCALENDAR");

  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="routehq-bookings.ics"`,
      "Cache-Control": "private, max-age=300"
    }
  });
}
