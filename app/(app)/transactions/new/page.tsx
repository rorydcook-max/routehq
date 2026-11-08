import { InfoTip } from "@/components/info-tip";
import { getTranslations } from "next-intl/server";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
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
      <div className="page-form">
        <div className="page-hero mb-5">
          <BackLink href={costForBooking ? `/bookings/${costForBooking}` : "/transactions"} label={costForBooking ? t("backBookingLabel") : t("backLabel")} />
          <h1 className="page-title flex items-center gap-2">
            {costForBooking ? t("costTitle") : fine ? t("fineTitle") : t("recordTitle")}
            {!costForBooking && fine ? <InfoTip label={t("fineTitle")} text={t("fineSubtitle")} /> : null}
          </h1>
        </div>

        <TransactionForm
          country={String((organization as any).country_code || (organization as any).settings?.main_location?.country || "")}
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
