import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { getTransactionFormOptions, getTransactionFormPrefill } from "@/lib/transactions";
import { TransactionForm } from "./transaction-form";

export default async function NewTransactionPage({
  searchParams
}: {
  searchParams: Promise<{ vehicleId?: string; rentalId?: string; customerId?: string; rentalPaymentId?: string; taskId?: string }>;
}) {
  const params = await searchParams;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [options, prefill] = await Promise.all([
    getTransactionFormOptions(organization.id),
    getTransactionFormPrefill({
      organizationId: organization.id,
      rentalPaymentId: params.rentalPaymentId,
      taskId: params.taskId
    })
  ]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        <div className="page-hero mb-5">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/transactions">
            Back to transactions
          </Link>
          <h1 className="page-title mt-2">Add transaction</h1>
          <p className="page-subtitle mt-2">Record rental income, deposits, fuel, maintenance, or any fleet expense.</p>
        </div>

        <TransactionForm
          defaultCustomerId={params.customerId || ""}
          defaultRentalId={params.rentalId || ""}
          defaultVehicleId={params.vehicleId || ""}
          options={options}
          organizationId={organization.id}
          prefill={prefill}
        />
      </div>
    </AppShell>
  );
}
