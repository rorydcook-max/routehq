import Link from "next/link";
import { notFound } from "next/navigation";
import { updateVehicle } from "@/app/actions/vehicles";
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

function valueOrEmpty(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const [{ data: vehicle }, branches, categories, { data: profile }] = await Promise.all([
    supabase.from("vehicles").select("*").eq("id", id).eq("organization_id", organization.id).is("deleted_at", null).maybeSingle(),
    ensureDefaultBranch(organization),
    getVehicleCategories(organization.id),
    supabase.from("users").select("preferred_locale, preferred_calendar").eq("id", user?.id).maybeSingle()
  ]);

  if (!vehicle) {
    notFound();
  }

  const specifications = vehicle.specifications || {};
  const acquisition = vehicle.metadata?.acquisition || {};
  const compliance = vehicle.metadata?.compliance || {};
  const finance = vehicle.metadata?.finance || {};
  const preferredLocale = profile?.preferred_locale || organization.default_locale || "en";
  const preferredCalendar = profile?.preferred_calendar || defaultCalendarForLocale(preferredLocale);

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 rounded-3xl border border-[var(--border)] bg-white px-5 py-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
          <Link className="text-sm font-bold text-[var(--primary)]" href={`/fleet/${vehicle.id}`}>
            Back to vehicle
          </Link>
          <h1 className="mt-2 text-2xl font-black tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
            Edit {vehicle.make} {vehicle.model}
          </h1>
          <p className="font-mono-data mt-1 text-sm text-[var(--muted)]">{vehicle.registration_number}</p>
        </div>

        <Card>
          <SectionHeader eyebrow="Vehicle asset" title="Edit vehicle" />
          <form action={updateVehicle} className="mt-5 space-y-5">
            <input name="vehicleId" type="hidden" value={vehicle.id} />
            <input name="organizationId" type="hidden" value={organization.id} />

            <div className="rounded-2xl border border-[#bfd1ff] bg-[var(--primary-blue-light)] p-4">
              <SectionHeader eyebrow="Identity" title="Core details" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Vehicle category</span>
                  <select className={inputClass} defaultValue={vehicle.category_id} name="categoryId" required>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Make</span>
                  <input className={inputClass} defaultValue={vehicle.make} name="make" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Model</span>
                  <input className={inputClass} defaultValue={vehicle.model} name="model" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Year</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(vehicle.year)} min="1900" name="year" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Trim</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(vehicle.trim)} name="trim" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-white p-4">
              <SectionHeader eyebrow="Vehicle details" title="Registration and specs" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Registration number</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={vehicle.registration_number} name="registrationNumber" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">VIN / frame number</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(vehicle.vin)} name="vin" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Colour</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(vehicle.color)} name="color" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Current mileage</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(vehicle.mileage)} min="0" name="mileage" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Transmission</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.transmission)} name="transmission" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Fuel type</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.fuel_type)} name="fuelType" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Seating capacity</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(specifications.seating_capacity)} min="0" name="seatingCapacity" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Engine CC</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(specifications.engine_cc)} min="0" name="engineCc" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Drivetrain</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.drivetrain)} name="drivetrain" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Body class</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.body_class)} name="bodyClass" placeholder="Scooter / sedan / pickup" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#fed7aa] bg-[var(--warning-light)] p-4">
              <SectionHeader eyebrow="Acquisition" title="Mileage and value" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Purchase mileage</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(acquisition.purchase_mileage)} min="0" name="purchaseMileage" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Purchase price</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.purchase_price)} name="purchasePrice" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Estimated value</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.estimated_value)} name="estimatedValue" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#bbf7d0] bg-[var(--success-light)] p-4">
              <SectionHeader eyebrow="Rental pricing" title="Default rates" />
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Daily rate</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.daily_rate)} name="dailyRate" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Weekly rate</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.weekly_rate)} name="weeklyRate" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Monthly rate</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.monthly_rate)} name="monthlyRate" />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#bfd1ff] bg-[var(--primary-blue-light)] p-4">
              <SectionHeader eyebrow="Location" title="Branch assignment" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Home branch</span>
                  <select className={inputClass} defaultValue={valueOrEmpty(vehicle.home_branch_id)} name="homeBranchId">
                    <option value="">No branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Service area</span>
                  <select className={inputClass} defaultValue={vehicle.service_area || "home_branch"} name="serviceArea">
                    <option value="home_branch">Home branch only</option>
                    <option value="all_branches">All branches</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#fecaca] bg-[var(--danger-light)] p-4">
              <SectionHeader eyebrow="Compliance & Renewals" title="Critical dates" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Vehicle tax expiry</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.tax_expiry_date)} inputClass={inputClass} name="taxExpiryDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Compulsory insurance expiry</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.porbor_expiry_date)} inputClass={inputClass} name="porborExpiryDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Voluntary insurance expiry</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.insurance_expiry_date)} inputClass={inputClass} name="insuranceExpiryDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Voluntary insurance type</span>
                  <select className={inputClass} defaultValue={valueOrEmpty(compliance.voluntary_insurance_type)} name="voluntaryInsuranceType">
                    <option value="">Select cover type</option>
                    <option value="class_1">Class 1 / Type 1 comprehensive</option>
                    <option value="class_2_plus">Class 2+ / Type 2+</option>
                    <option value="class_2">Class 2 / Type 2</option>
                    <option value="class_3_plus">Class 3+ / Type 3+</option>
                    <option value="class_3">Class 3 / Type 3 third-party</option>
                    <option value="rental_commercial">Rental/commercial policy</option>
                    <option value="unknown">Unknown / check policy</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Next service due</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.next_service_date)} inputClass={inputClass} name="nextServiceDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Oil change due</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.oil_change_due_date)} inputClass={inputClass} name="oilChangeDueDate" preferredLocale={preferredLocale} />
                </label>
              </div>
            </div>

            <div className="rounded-2xl border border-[#ddd6fe] bg-[var(--purple-light)] p-4">
              <SectionHeader eyebrow="Finance" title="Loan details" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Finance provider</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(finance.lender)} name="financeLender" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Monthly payment</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(finance.monthly_payment)} name="financeMonthlyPayment" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Outstanding balance</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(finance.outstanding_balance)} name="financeOutstanding" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[#344054]">Finance end date</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(finance.end_date)} inputClass={inputClass} name="financeEndDate" preferredLocale={preferredLocale} />
                </label>
              </div>
            </div>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link className="inline-flex justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" href={`/fleet/${vehicle.id}`}>
                Cancel
              </Link>
              <PendingButton className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white shadow-[0_14px_28px_rgba(18,184,200,0.24)] hover:bg-[var(--primary-hover)]" pendingLabel="Saving..." type="submit">
                Save changes
              </PendingButton>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
