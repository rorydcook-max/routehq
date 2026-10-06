import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { getDefaultOrganization } from "@/lib/organization";
import { getTransactionFormOptions, getTransactionList } from "@/lib/transactions";
import { TransactionsList } from "./transactions-list";

export default async function TransactionsPage({
  searchParams
}: {
  searchParams?: Promise<{ linked?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const t = await getTranslations("money");
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [transactions, options] = await Promise.all([
    getTransactionList(organization.id),
    getTransactionFormOptions(organization.id)
  ]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">{t("eyebrow")}</p>
          <h1 className="page-title">{t("listTitle")}</h1>
          <p className="page-subtitle mt-1">{t("listSubtitle")}</p>
        </div>
        <Link className="primary-action pressable" href="/transactions/new">
          <Plus size={18} />
          {t("recordMoney")}
        </Link>
      </div>

      {resolvedSearchParams.linked ? (
        <div className="mb-4 rounded-xl border border-[var(--success-line)] bg-[var(--success-light)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {resolvedSearchParams.linked === "payment" ? t("savedPayment") : t("savedTask")}
        </div>
      ) : null}

      <TransactionsList today={businessToday()} transactions={transactions} vehicles={options.vehicles} />
    </AppShell>
  );
}
