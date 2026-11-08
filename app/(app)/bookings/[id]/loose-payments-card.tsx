import { getLocale, getTranslations } from "next-intl/server";
import { Link2 } from "lucide-react";
import { dismissLoosePayments, linkLoosePayments } from "@/app/actions/loose-payments";
import { longDate } from "@/lib/i18n/dates";
import type { LoosePayment } from "@/lib/loose-payments";
import { niceMoney } from "@/lib/nice-money";

/**
 * "Are these payments from this booking?" (Rory, 2 Nov 2026): rent for this vehicle already in Money in & out, not
 * tied to any booking, within this booking's dates. Ticked by default; nothing links until the owner says yes.
 */
export async function LoosePaymentsCard({ rentalId, payments, currency }: { rentalId: string; payments: LoosePayment[]; currency: string }) {
  if (!payments.length) return null;
  const [t, locale] = await Promise.all([getTranslations("booking"), getLocale()]);
  const money = (value: number) => niceMoney(value, currency);
  const total = payments.reduce((sum, payment) => sum + payment.amount, 0);

  return (
    <form action={linkLoosePayments} className="rounded-2xl border border-[var(--info-line)] bg-[var(--info-light)] p-4">
      <input name="rentalId" type="hidden" value={rentalId} />
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--panel)] text-[var(--primary)]">
          <Link2 size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[var(--foreground)]">{t("lp_title", { count: payments.length })}</p>
          <p className="mt-0.5 text-sm text-[var(--foreground-secondary)]">{t("lp_body", { total: money(total) })}</p>
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {payments.map((payment) => (
          <li key={payment.id}>
            <input name="offeredId" type="hidden" value={payment.id} />
            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--panel)] px-3 py-2.5">
              <input className="h-4 w-4" defaultChecked name="transactionId" type="checkbox" value={payment.id} />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--foreground)]">{longDate(payment.date, locale)}</span>
                {payment.notes ? <span className="block truncate text-xs text-[var(--muted)]">{payment.notes}</span> : null}
              </span>
              <span className="font-bold tabular-nums text-[var(--foreground)]">{money(payment.amount)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="primary-action pressable" type="submit">
          {t("lp_yes")}
        </button>
        <button className="secondary-action pressable" formAction={dismissLoosePayments} type="submit">
          {t("lp_no")}
        </button>
      </div>
    </form>
  );
}
