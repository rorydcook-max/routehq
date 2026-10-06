import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { getTransactionFormOptions, getTransactionFormPrefill } from "@/lib/transactions";
import { listPaymentsWaiting } from "@/lib/transaction-matching";
import { TransactionForm } from "./transaction-form";

export default async function NewTransactionPage({
  searchParams
}: {
  searchParams: Promise<{ vehicleId?: string; rentalId?: string; customerId?: string; rentalPaymentId?: string; taskId?: string }>;
}) {
  const params = await searchParams;
  const t = await getTranslations("money");
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [waiting, options, prefill] = await Promise.all([
    listPaymentsWaiting(organization.id).catch(() => []),
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
            {t("back")}
          </Link>
          <h1 className="page-title mt-2">{t("recordTitle")}</h1>
          <p className="page-subtitle mt-2">{t("recordSubtitle")}</p>
        </div>

        <TransactionForm
          defaultCustomerId={params.customerId || ""}
          defaultRentalId={params.rentalId || ""}
          defaultVehicleId={params.vehicleId || ""}
          options={options}
          organizationId={organization.id}
          prefill={prefill}
          waiting={waiting}
        />
      </div>
    </AppShell>
  );
}
