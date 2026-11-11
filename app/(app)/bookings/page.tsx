import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BandPills } from "@/components/page-band";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingList } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { businessToday } from "@/lib/business-time";
import { BookingsList } from "./bookings-list";

export default async function BookingsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status: shown } = await searchParams;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  // Holds that ran out without a signature give their dates back.
  await releaseExpiredHolds(createSupabaseAdminClient(), organization.id).catch(() => null);
  const bookings = await getBookingList(organization.id);
  const t = await getTranslations("bookings");
  const today = businessToday();
  const weekEnd = businessToday(7);
  const live = bookings.filter((booking: any) => !["cancelled"].includes(String(booking.status || "")));
  const onRent = live.filter((booking: any) => ["active", "due_soon", "overdue", "extended"].includes(String(booking.status || ""))).length;
  const starting = live.filter((booking: any) => booking.status === "booked" && booking.start_date && String(booking.start_date).slice(0, 10) >= today && String(booking.start_date).slice(0, 10) <= weekEnd).length;
  const owing = live.filter((booking: any) => Number(booking.balance_due || 0) > 0).length;
  const onRentStates = ["active", "due_soon", "overdue", "extended"];
  const deposits = live.filter((booking: any) => Number(booking.deposit_held || 0) > 0).length;
  const outToday = live.filter((booking: any) => booking.status === "booked" && String(booking.start_date || "").slice(0, 10) === today).length;
  const backToday = live.filter((booking: any) => onRentStates.includes(String(booking.status || "")) && String(booking.end_date || "").slice(0, 10) === today).length;

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[32px] leading-tight text-[var(--foreground)]">{t("title")}</h1>
            {/* On a phone the + in the bottom bar makes a booking, as on the dashboard: the band stays short enough for the first card to show. */}
            <Link className="pressable hidden min-h-11 items-center gap-2 rounded-full bg-[var(--band-action)] px-4 font-bold text-[var(--band-action-ink)] lg:inline-flex" href="/bookings/new">
              <Plus size={16} />
              {t("create")}
            </Link>
          </div>
          {/* Money owed is the one that needs doing something about: white, with a brick number, when it is not zero. */}
          <div className="mt-4">
            <BandPills
              // Each count is a filter: tap it to see just those bookings, tap again for all.
              items={[
                { count: onRent, label: t("bandOnRent"), dot: "var(--band-dot)", href: shown === "on_rent" ? "/bookings" : "/bookings?status=on_rent", active: shown === "on_rent" },
                { count: starting, label: t("bandStarting"), dot: "var(--going-out)", href: shown === "starting" ? "/bookings" : "/bookings?status=starting", active: shown === "starting" },
                { count: owing, label: t("bandOwing"), dot: "var(--danger)", alert: true, href: shown === "owing" ? "/bookings" : "/bookings?status=owing", active: shown === "owing" },
                { count: deposits, label: t("bandDeposits"), dot: "var(--coming-back)", href: shown === "deposits" ? "/bookings" : "/bookings?status=deposits", active: shown === "deposits" },
                // Going out and due back today show when there are any, or when the dashboard sent you here to see them.
                ...(outToday > 0 || shown === "out_today" ? [{ count: outToday, label: t("bandOutToday"), dot: "var(--going-out)", href: shown === "out_today" ? "/bookings" : "/bookings?status=out_today", active: shown === "out_today" }] : []),
                ...(backToday > 0 || shown === "back_today" ? [{ count: backToday, label: t("bandBackToday"), dot: "var(--coming-back)", href: shown === "back_today" ? "/bookings" : "/bookings?status=back_today", active: shown === "back_today" }] : [])
              ]}
            />
          </div>
        </div>
      }
    >

      <BookingsList bookings={bookings} key={shown || "all"} />
    </AppShell>
  );
}
