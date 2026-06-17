import Link from "next/link";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getBookingList } from "@/lib/bookings";
import { getDefaultOrganization } from "@/lib/organization";
import { BookingsList } from "./bookings-list";

export default async function BookingsPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const bookings = await getBookingList(organization.id);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">Bookings</p>
          <h1 className="page-title">Rental bookings</h1>
          <p className="page-subtitle mt-2">Track booking links, customer completion, payments, inspections, and rental status.</p>
        </div>
        <Link className="primary-action pressable" href="/bookings/new">
          <Plus size={18} />
          Create booking
        </Link>
      </div>

      <BookingsList bookings={bookings} />
    </AppShell>
  );
}
