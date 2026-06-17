import Link from "next/link";
import { createVehicle } from "@/app/actions/vehicles";
import { ComplianceFields } from "@/app/fleet/new/compliance-fields";
import { VehicleIdentityFields } from "@/app/fleet/new/vehicle-identity-fields";
import { AppShell } from "@/components/app-shell";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { MoneyInput } from "@/components/money-input";
import { PendingButton } from "@/components/pending-button";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ensureDefaultBranch } from "@/lib/branches";
import { defaultCalendarForLocale } from "@/lib/i18n/calendars";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputClass =
  "mt-1 w-full rounded-xl border border-[var(--border-strong)] bg-white px-3 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

export default async function NewVehiclePage() {
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const [categories, branches, { data: profile }] = await Promise.all([
    getVehicleCategories(organization.id),
    ensureDefaultBranch(organization),
    supabase.from("users").select("preferred_locale, preferred_calendar").eq("id", user?.id).maybeSingle()
  ]);
  const preferredLocale = profile?.preferred_locale || organization.default_locale || "en";
  const preferredCalendar = profile?.preferred_calendar || defaultCalendarForLocale(preferredLocale);
  const defaultCategoryCode = categories[0]?.code || "car";
  const { data: initialModelRows } = await supabase
    .from("vehicle_models")
    .select("make_id")
    .eq("category_code", defaultCategoryCode)
    .eq("is_active", true);
  const initialMakeIds = Array.from(new Set<string>((initialModelRows || []).map((row: { make_id: string }) => row.make_id))).filter(Boolean);
  const { data: vehicleMakes } = initialMakeIds.length
    ? await supabase
        .from("vehicle_makes")
        .select("id, name, slug, origin_country, logo_url, sort_order")
        .in("id", initialMakeIds)
        .eq("is_active", true)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true })
    : { data: [] };
  const defaultBranch = branches.find((branch) => branch.is_active) || branches[0];

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 rounded-3xl border border-[var(--border)] bg-white px-5 py-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
          <Link className="text-sm font-bold text-[var(--primary)]" href="/fleet">
            Back to fleet
          </Link>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-black tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">Add vehicle</h1>
              <p className="mt-1 text-sm font-medium text-[var(--muted)]">Create a real Supabase vehicle asset. It will appear on Fleet and the dashboard immediately.</p>
            </div>
            <Link className="pressable inline-flex justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)] hover:border-[var(--primary-blue)] hover:text-[var(--primary-blue)]" href="/fleet/import">
              Import vehicles
            </Link>
          </div>
        </div>

        <Card>
          <SectionHeader eyebrow="Vehicle asset" title="Core details" />
          <form action={createVehicle} className="mt-5 space-y-5">
            <input name="organizationId" type="hidden" value={organization.id} />

            <VehicleIdentityFields categories={categories} initialMakes={vehicleMakes || []} inputClass={inputClass} />

            <div className="rounded-2xl border border-[#fed7aa] bg-[var(--warning-light)] p-4">
              <SectionHeader eyebrow="Acquisition" title="Mileage and value" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Current mileage</span>
                  <input className={`${inputClass} font-mono-data`} min="0" name="mileage" placeholder="0" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Purchase mileage</span>
                  <input className={`${inputClass} font-mono-data`} min="0" name="purchaseMileage" placeholder="0" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Purchase price</span>
                  <MoneyInput currency={organization.currency || "THB"} name="purchasePrice" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Estimated value</span>
                  <MoneyInput currency={organization.currency || "THB"} name="estimatedValue" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#bbf7d0] bg-[var(--success-light)] p-4">
              <SectionHeader eyebrow="Rental pricing" title="Default rates" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Daily rate</span>
                  <MoneyInput currency={organization.currency || "THB"} name="dailyRate" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Weekly rate</span>
                  <MoneyInput currency={organization.currency || "THB"} name="weeklyRate" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Monthly rate</span>
                  <MoneyInput currency={organization.currency || "THB"} name="monthlyRate" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#bfd1ff] bg-[var(--primary-blue-light)] p-4">
              <SectionHeader eyebrow="Location" title="Branch assignment" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Home branch</span>
                  <select className={inputClass} defaultValue={defaultBranch?.id} name="homeBranchId">
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Service area</span>
                  <select className={inputClass} defaultValue="home_branch" name="serviceArea">
                    <option value="home_branch">Home branch only</option>
                    <option value="all_branches">All branches</option>
                  </select>
                </label>
              </div>
            </div>

            <ComplianceFields calendar={preferredCalendar} inputClass={inputClass} preferredLocale={preferredLocale} />

            <div className="rounded-2xl border border-[#ddd6fe] bg-[var(--purple-light)] p-4">
              <SectionHeader eyebrow="Finance" title="Loan details" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Finance provider</span>
                  <input className={inputClass} name="financeLender" type="text" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Monthly payment</span>
                  <MoneyInput currency={organization.currency || "THB"} name="financeMonthlyPayment" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Outstanding balance</span>
                  <MoneyInput currency={organization.currency || "THB"} name="financeOutstanding" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Finance end date</span>
                  <LocalizedDateInput calendar={preferredCalendar} inputClass={inputClass} name="financeEndDate" preferredLocale={preferredLocale} />
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link className="inline-flex justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" href="/fleet">
                Cancel
              </Link>
              <PendingButton className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(18,184,200,0.24)] hover:bg-[var(--primary-hover)]" pendingLabel="Saving..." type="submit">
                Save vehicle
              </PendingButton>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
