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
  searchParams: Promise<{ vehicleId?: string; rentalId?: string; customerId?: string; rentalPaymentId?: string; taskId?: string; cost?: string; fine?: string }>;
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

  // Opened from a booking's "Add a cost": say so, and lead back to that booking.
  const costForBooking = params.cost === "1" && params.rentalId ? params.rentalId : null;
  const fine = params.fine === "1";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-xl">
        <div className="page-hero mb-5">
          <Link className="text-sm font-bold text-[var(--primary)]" href={costForBooking ? `/bookings/${costForBooking}` : "/transactions"}>
            {costForBooking ? t("backToBooking") : t("back")}
          </Link>
          <h1 className="page-title mt-2">{costForBooking ? t("costTitle") : fine ? t("fineTitle") : t("recordTitle")}</h1>
          <p className="page-subtitle mt-2">{costForBooking ? t("costSubtitle") : fine ? t("fineSubtitle") : t("recordSubtitle")}</p>
        </div>

        <TransactionForm
          defaultCustomerId={params.customerId || ""}
          defaultRentalId={params.rentalId || ""}
          startAsCost={params.cost === "1"}
          startAsFine={fine}
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
