import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Plus, Camera, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/auth/roles";
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
    <AppShell
      userEmail={userEmail}
      hero={<PageBand action={{ href: "/transactions/new", label: t("recordMoney"), icon: <Plus size={16} />, desktopOnly: true }} subtitle={t("listSubtitle")} title={t("listTitle")} />}
    >

      {resolvedSearchParams.linked ? (
        <div className="mb-4 rounded-xl border border-[var(--success-line)] bg-[var(--success-light)] px-4 py-3 text-sm font-semibold text-[var(--success)]">
          {resolvedSearchParams.linked === "payment" ? t("savedPayment") : t("savedTask")}
        </div>
      ) : null}

      {/* The everyday cost: a receipt in hand. One tap to the camera. */}
      <Link className="pressable mb-4 flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-white p-3.5 shadow-[var(--shadow-card)]" href="/transactions/new?cost=1">
        <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
          <Camera aria-hidden="true" size={22} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold text-[var(--foreground)]">{t("receiptShortcut")}</span>
          <span className="block text-[13px] font-medium text-[var(--muted)]">{t("receiptShortcutHint")}</span>
        </span>
        <ChevronRight aria-hidden="true" className="flex-shrink-0 text-[var(--muted)]" size={18} />
      </Link>

      <TransactionsList showProfit={(await getCurrentMembership())?.role === "owner"} today={businessToday()} transactions={transactions} vehicles={options.vehicles} />
    </AppShell>
  );
}
