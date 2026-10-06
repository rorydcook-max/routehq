import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingList } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { releaseExpiredHolds } from "@/lib/booking-holds";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BookingsList } from "./bookings-list";

export default async function BookingsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  // Holds that ran out without a signature give their dates back.
  await releaseExpiredHolds(createSupabaseAdminClient(), organization.id).catch(() => null);
  const bookings = await getBookingList(organization.id);
  const t = await getTranslations("bookings");

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title">{t("title")}</h1>
          <p className="page-subtitle mt-1">{t("subtitle")}</p>
        </div>
        <Link className="primary-action pressable" href="/bookings/new">
          <Plus size={18} />
          {t("create")}
        </Link>
      </div>

      <BookingsList bookings={bookings} />
    </AppShell>
  );
}
