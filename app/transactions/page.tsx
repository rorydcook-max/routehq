import Link from "next/link";
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
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const [transactions, options] = await Promise.all([
    getTransactionList(organization.id),
    getTransactionFormOptions(organization.id)
  ]);

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-hero mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="page-eyebrow">Transactions</p>
          <h1 className="page-title">Money in & out</h1>
          <p className="page-subtitle mt-1">Every payment you&apos;ve received and every cost, side by side.</p>
        </div>
        <Link className="primary-action pressable" href="/transactions/new">
          <Plus size={18} />
          Add transaction
        </Link>
      </div>

      {resolvedSearchParams.linked ? (
        <div className="mb-4 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-4 py-3 text-sm font-semibold text-[#166534]">
          Transaction saved and {resolvedSearchParams.linked === "payment" ? "rental payment marked as received" : "linked task completed"}.
        </div>
      ) : null}

      <TransactionsList today={businessToday()} transactions={transactions} vehicles={options.vehicles} />
    </AppShell>
  );
}
