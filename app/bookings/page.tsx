import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
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
            <h1 className="text-[30px] font-bold leading-tight text-white">{t("title")}</h1>
            <Link className="pressable inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--band-action)] px-4 font-bold text-[var(--band-action-ink)]" href="/bookings/new">
              <Plus size={16} />
              {t("create")}
            </Link>
          </div>
          <div className="mt-4 grid max-w-xl grid-cols-3 gap-2">
            <span className="rounded-2xl bg-[var(--band-soft)] px-3 py-2.5 text-white">
              <span className="block text-[24px] font-bold leading-none tabular-nums">{onRent}</span>
              <span className="mt-1 block font-semibold text-white/85">{t("bandOnRent")}</span>
            </span>
            <span className="rounded-2xl bg-[var(--band-soft)] px-3 py-2.5 text-white">
              <span className="block text-[24px] font-bold leading-none tabular-nums">{starting}</span>
              <span className="mt-1 block font-semibold text-white/85">{t("bandStarting")}</span>
            </span>
            {/* Money owed is the one that needs doing something about: white, and brick when it is not zero. */}
            <span className="rounded-2xl bg-white px-3 py-2.5 text-[var(--foreground)]">
              <span className={`block text-[24px] font-bold leading-none tabular-nums ${owing > 0 ? "text-[var(--danger)]" : ""}`}>{owing}</span>
              <span className="mt-1 block font-semibold text-[var(--muted)]">{t("bandOwing")}</span>
            </span>
          </div>
        </div>
      }
    >

      <BookingsList bookings={bookings} />
    </AppShell>
  );
}
