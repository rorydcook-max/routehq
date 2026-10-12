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

export default async function BookingsPage() {
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

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-[32px] leading-tight text-white">{t("title")}</h1>
            <Link className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--band-action)] px-4 font-bold text-[var(--band-action-ink)]" href="/bookings/new">
              <Plus size={16} />
              {t("create")}
            </Link>
          </div>
          {/* Money owed is the one that needs doing something about: white, with a brick number, when it is not zero. */}
          <div className="mt-4">
            <BandPills
              items={[
                { count: onRent, label: t("bandOnRent"), dot: "#ffffff" },
                { count: starting, label: t("bandStarting"), dot: "var(--going-out)" },
                { count: owing, label: t("bandOwing"), alert: true }
              ]}
            />
          </div>
        </div>
      }
    >

      <BookingsList bookings={bookings} />
    </AppShell>
  );
}
