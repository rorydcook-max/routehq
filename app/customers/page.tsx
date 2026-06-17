import { CustomerList } from "@/app/customers/customer-list";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCustomerList } from "@/lib/customer-detail";
import { getDefaultOrganization } from "@/lib/organization";

export default async function CustomersPage() {
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const customers = await getCustomerList(organization.id);

  return (
    <AppShell userEmail={userEmail}>
      <CustomerList customers={customers} />
    </AppShell>
  );
}
