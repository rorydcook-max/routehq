import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { businessToday } from "@/lib/business-time";
import { longDate } from "@/lib/i18n/dates";
import { getDefaultOrganization } from "@/lib/organization";
import { buildStatements, type VehicleStatement } from "@/lib/owner-statements";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PrintButton } from "./print-button";

type Say = (key: string, values?: Record<string, string | number>) => string;

function shiftMonth(month: string, by: number) {
  const date = new Date(`${month}-01T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + by);
  return date.toISOString().slice(0, 7);
}

/** One statement per vehicle owner, for one month: what their vehicles brought in, cost, and their share. Owner only (under Reports). */
export default async function OwnerStatementsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const params = await searchParams;
  const month = /^\d{4}-\d{2}$/.test(String(params.month || "")) ? String(params.month) : businessToday().slice(0, 7);
  const from = `${month}-01`;
  const to = `${shiftMonth(month, 1)}-01`;
  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const say = (await getTranslations("ownerStatements")) as unknown as Say;
  const money = (await getTranslations("money")) as unknown as Say & { has: (key: string) => boolean };
  const locale = await getLocale();

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, make, model, registration_number, metadata")
    .eq("organization_id", organization.id)
    .is("deleted_at", null);
  const owned = (vehicles || []).filter((vehicle: any) => vehicle.metadata?.partner?.name);
  const { data: transactions } = owned.length
    ? await supabase
        .from("transactions")
        .select("vehicle_id, type, amount, is_deposit, voided, transaction_date, notes")
        .eq("organization_id", organization.id)
        .is("deleted_at", null)
        .in("vehicle_id", owned.map((vehicle: any) => vehicle.id))
        .gte("transaction_date", from)
        .lt("transaction_date", to)
    : { data: [] };

  const statements = buildStatements(owned, transactions || [], (type) => (money.has(`type_${type}`) ? money(`type_${type}`) : type));
  const byOwner = new Map<string, VehicleStatement[]>();
  for (const statement of statements) byOwner.set(statement.partner.name, [...(byOwner.get(statement.partner.name) || []), statement]);
  const currency = organization.currency || "THB";
  const baht = (value: number) => new Intl.NumberFormat(locale === "en" ? "en-GB" : `${locale}-u-nu-latn`, { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(value));
  const monthName = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : `${locale}-u-ca-gregory`, { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${from}T00:00:00Z`));

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="page-hero print:hidden">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/reports">
            {say("back")}
          </Link>
          <h1 className="page-title mt-2">{say("title")}</h1>
          <p className="page-subtitle mt-2">{say("subtitle")}</p>
        </div>

        <div className="flex items-center justify-between gap-2 print:hidden">
          <Link aria-label={say("previous")} className="secondary-action pressable !px-3" href={`/reports/owners?month=${shiftMonth(month, -1)}`}>
            <ChevronLeft size={18} />
          </Link>
          <p className="font-bold">{monthName}</p>
          <Link aria-label={say("next")} className="secondary-action pressable !px-3" href={`/reports/owners?month=${shiftMonth(month, 1)}`}>
            <ChevronRight size={18} />
          </Link>
        </div>

        {byOwner.size === 0 ? (
          <div className="card p-5">
            <p className="font-bold">{say("noneTitle")}</p>
            <p className="mt-1 text-[var(--foreground-secondary)]">{say("noneBody")}</p>
          </div>
        ) : (
          <>
            <div className="flex justify-end print:hidden">
              <PrintButton label={say("print")} />
            </div>
            {[...byOwner.entries()].map(([owner, list]) => {
              const totalShare = list.reduce((sum, item) => sum + item.share, 0);
              return (
                <section className="card break-inside-avoid p-5" key={owner}>
                  <p className="text-sm font-semibold text-[var(--muted)]">
                    {organization.name} · {monthName}
                  </p>
                  <h2 className="mt-1 text-xl font-bold">{say("statementFor", { name: owner })}</h2>
                  {list[0].partner.phone ? <p className="text-sm text-[var(--muted)]">{list[0].partner.phone}</p> : null}
                  <p className="mt-3 text-3xl font-bold">{baht(totalShare)}</p>
                  <p className="text-sm text-[var(--foreground-secondary)]">{say("theirShare")}</p>
                  <div className="mt-4 space-y-4">
                    {list.map((item) => (
                      <div className="rounded-xl border border-[var(--border)] p-3" key={item.vehicleId}>
                        <p className="font-bold">
                          {item.name} <span className="font-medium text-[var(--muted)]">{item.plate}</span>
                        </p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                          <dt className="text-[var(--muted)]">{say("moneyIn")}</dt>
                          <dd className="text-right font-semibold sm:text-left">{baht(item.income)}</dd>
                          <dt className="text-[var(--muted)]">{say("costs")}</dt>
                          <dd className="text-right font-semibold sm:text-left">{baht(item.costs)}</dd>
                          <dt className="text-[var(--muted)]">{say("profit")}</dt>
                          <dd className="text-right font-semibold sm:text-left">{baht(item.profit)}</dd>
                          <dt className="text-[var(--muted)]">{say(item.partner.basis === "profit" ? "shareOfProfit" : "shareOfIncome", { pct: item.partner.pct })}</dt>
                          <dd className="text-right font-bold sm:text-left">{baht(item.share)}</dd>
                        </dl>
                        {item.lines.length ? (
                          <table className="mt-3 w-full text-sm">
                            <tbody>
                              {item.lines.map((line, index) => (
                                <tr className="border-t border-[var(--border)]" key={index}>
                                  <td className="py-1.5 pr-2 text-[var(--muted)]">{longDate(line.date, locale)}</td>
                                  <td className="py-1.5 pr-2">{line.label}</td>
                                  <td className={`py-1.5 text-right tabular-nums ${line.kind === "out" || line.amount < 0 ? "text-[var(--danger)]" : ""}`}>
                                    {line.kind === "out" || line.amount < 0 ? "-" : ""}
                                    {baht(Math.abs(line.amount))}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <p className="mt-2 text-sm text-[var(--muted)]">{say("nothingThisMonth")}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </AppShell>
  );
}
