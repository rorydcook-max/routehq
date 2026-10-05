import Link from "next/link";
import { notFound } from "next/navigation";
import { updateVehicle } from "@/app/actions/vehicles";
import { AppShell } from "@/components/app-shell";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { MoneyInput } from "@/components/money-input";
import { PendingButton } from "@/components/pending-button";
import { Card, Fold, SectionHeader } from "@/components/ui";
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

  const money = (value: unknown) => (value == null || value === "" || Number(value) === 0 ? null : `${organization.currency === "THB" ? "฿" : ""}${Number(value).toLocaleString("en-US")}`);
  const ratesSummary =
    [money(vehicle.daily_rate) ? `${money(vehicle.daily_rate)} a day` : null, money(vehicle.weekly_rate) ? `${money(vehicle.weekly_rate)} a week` : null, money(vehicle.monthly_rate) ? `${money(vehicle.monthly_rate)} a month` : null]
      .filter(Boolean)
      .join(" · ") || "No prices set yet";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="mb-5 rounded-3xl border border-[var(--border)] bg-white px-5 py-4 shadow-[0_16px_38px_rgba(15,23,42,0.06)]">
          <Link className="text-sm font-bold text-[var(--primary)]" href={`/fleet/${vehicle.id}`}>
            Back to vehicle
          </Link>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[var(--foreground)] sm:text-3xl">
            Edit {vehicle.make} {vehicle.model}
          </h1>
          <p className="font-mono-data mt-1 text-sm text-[var(--muted)]">{vehicle.registration_number}</p>
        </div>

        <Card>
          <SectionHeader eyebrow="Vehicle asset" title="Edit vehicle" />
          <form action={updateVehicle} className="mt-5 space-y-5">
            <input name="vehicleId" type="hidden" value={vehicle.id} />
            <input name="organizationId" type="hidden" value={organization.id} />

            {/* Most changed first. Everything else is one tap away. */}
            <Fold open summary={ratesSummary} title="Rates and deposit">
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Daily rate</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.daily_rate)} name="dailyRate" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Weekly rate</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.weekly_rate)} name="weeklyRate" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Monthly rate</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.monthly_rate)} name="monthlyRate" />
                </label>
              </div>
              <label className="mt-4 block sm:max-w-xs">
                <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Deposit for this vehicle</span>
                <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty((vehicle as any).deposit_amount)} name="depositAmount" />
                <span className="mt-1 block text-xs text-[var(--muted)]">Leave empty to use your usual deposit from Settings.</span>
              </label>
            </Fold>
            <Fold summary={`${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`} title="Make, model and number plate">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Vehicle category</span>
                  <select className={inputClass} defaultValue={vehicle.category_id} name="categoryId" required>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Make</span>
                  <input className={inputClass} defaultValue={vehicle.make} name="make" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Model</span>
                  <input className={inputClass} defaultValue={vehicle.model} name="model" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Year</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(vehicle.year)} min="1900" name="year" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Trim</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(vehicle.trim)} name="trim" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Number plate</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={vehicle.registration_number} name="registrationNumber" required />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Colour</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(vehicle.color)} name="color" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Current mileage</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(vehicle.mileage)} min="0" name="mileage" type="number" />
                </label>
              </div>
            </Fold>
            <Fold summary="So you are reminded before they run out" title="Tax, insurance and service dates">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Road tax runs out</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.tax_expiry_date)} inputClass={inputClass} name="taxExpiryDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Compulsory insurance runs out</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.porbor_expiry_date)} inputClass={inputClass} name="porborExpiryDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Your own insurance runs out</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.insurance_expiry_date)} inputClass={inputClass} name="insuranceExpiryDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Type of cover</span>
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
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Next service due</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.next_service_date)} inputClass={inputClass} name="nextServiceDate" preferredLocale={preferredLocale} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Oil change due</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(compliance.oil_change_due_date)} inputClass={inputClass} name="oilChangeDueDate" preferredLocale={preferredLocale} />
                </label>
              </div>
            </Fold>
            <Fold summary="Frame number, gearbox, seats, engine" title="More about the vehicle">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">VIN / frame number</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(vehicle.vin)} name="vin" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Transmission</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.transmission)} name="transmission" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Fuel type</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.fuel_type)} name="fuelType" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Seating capacity</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(specifications.seating_capacity)} min="0" name="seatingCapacity" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Engine CC</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(specifications.engine_cc)} min="0" name="engineCc" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Drivetrain</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.drivetrain)} name="drivetrain" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Body class</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(specifications.body_class)} name="bodyClass" placeholder="Scooter / sedan / pickup" />
                </label>
              </div>
            </Fold>
            <Fold summary="Purchase price, value, kilometres when bought" title="What you paid and what it is worth">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Purchase mileage</span>
                  <input className={`${inputClass} font-mono-data`} defaultValue={valueOrEmpty(acquisition.purchase_mileage)} min="0" name="purchaseMileage" type="number" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Purchase price</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.purchase_price)} name="purchasePrice" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Estimated value</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(vehicle.estimated_value)} name="estimatedValue" />
                </label>
              </div>
            </Fold>
            {branches.length > 1 ? (
              <Fold summary="Which of your locations it belongs to" title="Location">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Home branch</span>
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
                    <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Service area</span>
                    <select className={inputClass} defaultValue={vehicle.service_area || "home_branch"} name="serviceArea">
                      <option value="home_branch">Home branch only</option>
                      <option value="all_branches">All branches</option>
                    </select>
                  </label>
                </div>
              </Fold>
            ) : (
              <>
                <input name="homeBranchId" type="hidden" value={valueOrEmpty(vehicle.home_branch_id)} />
                <input name="serviceArea" type="hidden" value={vehicle.service_area || "home_branch"} />
              </>
            )}
            <Fold summary="If the vehicle is on finance" title="Loan">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Finance provider</span>
                  <input className={inputClass} defaultValue={valueOrEmpty(finance.lender)} name="financeLender" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Monthly payment</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(finance.monthly_payment)} name="financeMonthlyPayment" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Outstanding balance</span>
                  <MoneyInput currency={organization.currency || "THB"} defaultValue={valueOrEmpty(finance.outstanding_balance)} name="financeOutstanding" />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground-secondary)]">Finance end date</span>
                  <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(finance.end_date)} inputClass={inputClass} name="financeEndDate" preferredLocale={preferredLocale} />
                </label>
              </div>
            </Fold>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Link className="inline-flex justify-center rounded-xl border border-[var(--border)] bg-white px-4 py-3 text-sm font-bold text-[var(--foreground-secondary)]" href={`/fleet/${vehicle.id}`}>
                Cancel
              </Link>
              <PendingButton className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--primary)] px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-[var(--primary-hover)]" pendingLabel="Saving..." type="submit">
                Save changes
              </PendingButton>
            </div>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}
