import { CustomerList } from "@/app/(app)/customers/customer-list";
import { AppShell } from "@/components/app-shell";
import { BandPills, PageBand } from "@/components/page-band";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessCurrency } from "@/lib/business-units";
import { getCustomerList, getCustomerMonths } from "@/lib/customer-detail";
import { getDefaultOrganization } from "@/lib/organization";
import { formatMoney } from "@/lib/regional";
import { averageOf, listReviews } from "@/lib/reviews";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [customers, months, reviews] = await Promise.all([
    getCustomerList(organization.id),
    getCustomerMonths(organization.id),
    createSupabaseServerClient().then((supabase) => listReviews(supabase, organization.id)).catch(() => [])
  ]);
  const reviewStats = averageOf(reviews);
  const reviewsToCheck = reviews.filter((review) => !review.checked).length;
  const say = await getTranslations("customers");
  // The counts on the band are filters: tap "3 renting now" to see just them, tap again for everyone.
  const link = (key: string) => (show === key ? "/customers" : `/customers?show=${key}`);

  // The figures that say how the business is doing with its customers (Rory, 7 Nov 2026).
  const renting = customers.filter((item) => (item.activeRentals || []).some((rental: any) => rental.status !== "booked")).length;
  const rented = customers.filter((item) => (item.stats?.rentals || 0) > 0);
  const returning = rented.filter((item) => (item.stats?.rentals || 0) >= 2).length;
  const rentalCount = rented.reduce((sum, item) => sum + (item.stats?.rentals || 0), 0);
  const rentalDays = rented.reduce((sum, item) => sum + (item.stats?.rentalDays || 0), 0);
  const revenue = rented.reduce((sum, item) => sum + (item.stats?.revenue || 0), 0);

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <PageBand action={{ href: "/customers/new", label: say("add"), icon: <Plus size={16} /> }} title={say("title")}>
          <BandPills
            items={[
              { count: customers.length, label: say("pillAll"), href: show ? "/customers" : null },
              { count: renting, label: say("pillRenting"), dot: "var(--on-rent)", href: link("renting"), active: show === "renting" },
              ...(rented.length > 0
                ? [
                    { count: returning, value: `${Math.round((returning / rented.length) * 100)}%`, label: say("pillReturning"), href: link("returning"), active: show === "returning" },
                    { count: rentalCount, value: say("daysShort", { count: Math.round(rentalDays / Math.max(1, rentalCount)) }), label: say("pillAvgLength") },
                    { count: rentalCount, value: formatMoney(Math.round(revenue / Math.max(1, rentalCount)), businessCurrency(), "en-US"), label: say("pillAvgSpend") }
                  ]
                : []),
              // Reviews renters left (app/(app)/customers/reviews): "★ 4.8 · 12 reviews". New ones are also on To do.
              {
                count: reviewStats.count,
                value: reviewStats.count ? `★ ${reviewStats.average.toFixed(1)}` : undefined,
                label: say("pillReviews", { count: reviewStats.count }),
                dot: reviewsToCheck > 0 ? "var(--warning)" : null,
                href: "/customers/reviews"
              }
            ]}
          />
        </PageBand>
      }
    >
      <CustomerList customers={customers} initialFilter={show === "documents" ? "missing" : show === "renting" ? "renting" : show === "returning" ? "returning" : "all"} key={show || "all"} months={months} />
    </AppShell>
  );
}
