import { CustomerList } from "@/app/customers/customer-list";
import { AppShell } from "@/components/app-shell";
import { BandPills, PageBand } from "@/components/page-band";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCustomerList } from "@/lib/customer-detail";
import { getDefaultOrganization } from "@/lib/organization";

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const customers = await getCustomerList(organization.id);
  const say = await getTranslations("customers");
  // The counts on the band are filters: tap "3 renting now" to see just them, tap again for everyone.
  const link = (key: string) => (show === key ? "/customers" : `/customers?show=${key}`);

  return (
    <AppShell
      userEmail={userEmail}
      hero={
        <PageBand action={{ href: "/customers/new", label: say("add"), icon: <Plus size={16} /> }} title={say("title")}>
          <BandPills
            items={[
              { count: customers.length, label: say("pillAll"), href: show ? "/customers" : null },
              { count: customers.filter((item) => (item.activeRentals || []).some((rental: any) => rental.status !== "booked")).length, label: say("pillRenting"), dot: "var(--on-rent)", href: link("renting"), active: show === "renting" },
              { count: customers.filter((item) => item.documentStatus !== "complete").length, label: say("pillDocs"), alert: true, href: link("documents"), active: show === "documents" }
            ]}
          />
        </PageBand>
      }
    >
      <CustomerList customers={customers} initialDocuments={show === "documents" ? "incomplete" : "all"} initialRentals={show === "renting" ? "renting" : "all"} key={show || "all"} />
    </AppShell>
  );
}
