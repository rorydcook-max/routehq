import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { archiveVehicle, deleteVehicle, updateVehicle } from "@/app/actions/vehicles";
import { ConfirmDeleteVehicleButton } from "@/app/fleet/fleet-actions";
import { AppShell } from "@/components/app-shell";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { MoneyInput } from "@/components/money-input";
import { PendingButton } from "@/components/pending-button";
import { Fold } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/auth/roles";
import { ensureDefaultBranch } from "@/lib/branches";
import { defaultCalendarForLocale } from "@/lib/i18n/calendars";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CONDITIONS } from "@/lib/vehicle-condition";
import { longDate } from "@/lib/i18n/dates";

// The wording for this page is in locales/<language>/common.json under "vehicleForm".
type Say = (key: string, values?: Record<string, string | number>) => string;

const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const coverTypes = ["class_1", "class_2_plus", "class_2", "class_3_plus", "class_3", "rental_commercial", "unknown"];

function valueOrEmpty(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const t = await getTranslations("vehicleForm");
  const say = t as unknown as Say;
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

  // What was paid, what it is worth and any loan are for the owner only.
  const isOwner = (await getCurrentMembership())?.role === "owner";
  const specifications = vehicle.specifications || {};
  const acquisition = vehicle.metadata?.acquisition || {};
  const compliance = vehicle.metadata?.compliance || {};
  const finance = vehicle.metadata?.finance || {};
  const preferredLocale = profile?.preferred_locale || organization.default_locale || "en";
  const preferredCalendar = profile?.preferred_calendar || defaultCalendarForLocale(preferredLocale);
  const currency = organization.currency || "THB";
  const categoryName = (category: { code: string; name: string }) => (t.has(`cat_${category.code}` as never) ? say(`cat_${category.code}`) : category.name);

  const money = (value: unknown) => (value == null || value === "" || Number(value) === 0 ? null : `${currency === "THB" ? "฿" : ""}${Number(value).toLocaleString("en-US")}`);
  const ratesSummary =
    [
      money(vehicle.daily_rate) ? say("perDay", { amount: money(vehicle.daily_rate)! }) : null,
      money(vehicle.weekly_rate) ? say("perWeek", { amount: money(vehicle.weekly_rate)! }) : null,
      money(vehicle.monthly_rate) ? say("perMonth", { amount: money(vehicle.monthly_rate)! }) : null
    ]
      .filter(Boolean)
      .join(" · ") || say("noPrices");
  const dateField = (labelKey: string, name: string, value: unknown) => (
    <label className="block">
      <span className={labelClass}>{say(labelKey)}</span>
      <LocalizedDateInput calendar={preferredCalendar} defaultValue={valueOrEmpty(value)} inputClass={inputClass} name={name} preferredLocale={preferredLocale} />
    </label>
  );
  const textField = (labelKey: string, name: string, value: unknown, extra: { type?: string; required?: boolean } = {}) => (
    <label className="block">
      <span className={labelClass}>{say(labelKey)}</span>
      <input className={inputClass} defaultValue={valueOrEmpty(value)} inputMode={extra.type === "number" ? "numeric" : undefined} min={extra.type === "number" ? "0" : undefined} name={name} required={extra.required} type={extra.type || "text"} />
    </label>
  );
  const moneyField = (labelKey: string, name: string, value: unknown) => (
    <label className="block">
      <span className={labelClass}>{say(labelKey)}</span>
      <MoneyInput currency={currency} defaultValue={valueOrEmpty(value)} name={name} />
    </label>
  );

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="page-hero mb-4">
          <Link className="font-bold text-[var(--primary)]" href={`/fleet/${vehicle.id}`}>
            {say("backToVehicle")}
          </Link>
          <h1 className="page-title mt-2">{say("editTitle", { name: `${vehicle.make} ${vehicle.model}` })}</h1>
          <p className="page-subtitle page-subtitle-keep mt-1">{vehicle.registration_number}</p>
        </div>

        <form action={updateVehicle} className="space-y-3">
          <input name="vehicleId" type="hidden" value={vehicle.id} />
          <input name="organizationId" type="hidden" value={organization.id} />

          {/* Most changed first. Everything else is one tap away. */}
          <Fold open summary={ratesSummary} title={say("ratesTitle")}>
            <div className="grid gap-4 sm:grid-cols-3">
              {moneyField("daily", "dailyRate", vehicle.daily_rate)}
              {moneyField("weekly", "weeklyRate", vehicle.weekly_rate)}
              {moneyField("monthly", "monthlyRate", vehicle.monthly_rate)}
            </div>
            <label className="mt-4 block sm:max-w-xs">
              <span className={labelClass}>{say("deposit")}</span>
              <MoneyInput currency={currency} defaultValue={valueOrEmpty((vehicle as any).deposit_amount)} name="depositAmount" />
              <span className="mt-1 block font-medium text-[var(--muted)]">{say("depositHint")}</span>
            </label>
          </Fold>
          <Fold summary={`${vehicle.make} ${vehicle.model} · ${vehicle.registration_number}`} title={say("identTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{say("category")}</span>
                <select className={inputClass} defaultValue={vehicle.category_id} name="categoryId" required>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {categoryName(category)}
                    </option>
                  ))}
                </select>
              </label>
              {textField("make", "make", vehicle.make, { required: true })}
              {textField("model", "model", vehicle.model, { required: true })}
              {textField("year", "year", vehicle.year, { type: "number" })}
              {textField("trim", "trim", vehicle.trim)}
              {textField("plate", "registrationNumber", vehicle.registration_number, { required: true })}
              {textField("colour", "color", vehicle.color)}
              {textField("mileage", "mileage", vehicle.mileage, { type: "number" })}
              <label className="block sm:col-span-2">
                <span className={labelClass}>{say("condition")}</span>
                <select className={inputClass} defaultValue={valueOrEmpty(vehicle.metadata?.condition?.value)} name="condition">
                  <option value="">{say("choose")}</option>
                  {CONDITIONS.map((value) => (
                    <option key={value} value={value}>
                      {say(`cond_${value}`)}
                    </option>
                  ))}
                </select>
                {vehicle.metadata?.condition?.by === "damage" ? (
                  <span className="mt-1 block font-medium text-[var(--muted)]">{say("conditionByDamage", { date: longDate(String(vehicle.metadata.condition.damage_on || ""), preferredLocale) })}</span>
                ) : (
                  <span className="mt-1 block font-medium text-[var(--muted)]">{say("conditionHint")}</span>
                )}
              </label>
            </div>
          </Fold>
          <Fold summary={say("datesSummary")} title={say("datesTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {dateField("tax", "taxExpiryDate", compliance.tax_expiry_date)}
              {dateField("porbor", "porborExpiryDate", compliance.porbor_expiry_date)}
              {dateField("insurance", "insuranceExpiryDate", compliance.insurance_expiry_date)}
              <label className="block">
                <span className={labelClass}>{say("cover")}</span>
                <select className={inputClass} defaultValue={valueOrEmpty(compliance.voluntary_insurance_type)} name="voluntaryInsuranceType">
                  <option value="">{say("choose")}</option>
                  {coverTypes.map((type) => (
                    <option key={type} value={type}>
                      {say(`cover_${type}`)}
                    </option>
                  ))}
                </select>
              </label>
              {moneyField("sumInsured", "insuranceSumInsured", compliance.insurance_sum_insured)}
              {moneyField("insuranceExcess", "insuranceExcess", compliance.insurance_excess)}
              {dateField("service", "nextServiceDate", compliance.next_service_date)}
              {dateField("oil", "oilChangeDueDate", compliance.oil_change_due_date)}
            </div>
          </Fold>
          <Fold summary={say("moreSummary")} title={say("moreTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {textField("vin", "vin", vehicle.vin)}
              {textField("transmission", "transmission", specifications.transmission)}
              {textField("fuel", "fuelType", specifications.fuel_type)}
              {textField("seats", "seatingCapacity", specifications.seating_capacity, { type: "number" })}
              {textField("engine", "engineCc", specifications.engine_cc, { type: "number" })}
              {textField("drivetrain", "drivetrain", specifications.drivetrain)}
              {textField("body", "bodyClass", specifications.body_class)}
            </div>
          </Fold>
          {isOwner ? (
          <Fold summary={say("valueSummaryEdit")} title={say("valueTitleEdit")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {moneyField("purchasePrice", "purchasePrice", vehicle.purchase_price)}
              {dateField("purchaseDate", "purchaseDate", vehicle.purchase_date)}
              {textField("purchaseMileage", "purchaseMileage", acquisition.purchase_mileage, { type: "number" })}
              {moneyField("estimatedValue", "estimatedValue", vehicle.estimated_value)}
            </div>
            <p className="mt-3 text-sm text-[var(--muted)]">{say("valueHintEdit")}</p>
          </Fold>
          ) : null}
          {branches.length > 1 ? (
            <Fold summary={say("locSummary")} title={say("locTitle")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>{say("homeBranch")}</span>
                  <select className={inputClass} defaultValue={valueOrEmpty(vehicle.home_branch_id)} name="homeBranchId">
                    <option value="">{say("noBranch")}</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>{say("serviceArea")}</span>
                  <select className={inputClass} defaultValue={vehicle.service_area || "home_branch"} name="serviceArea">
                    <option value="home_branch">{say("areaHome")}</option>
                    <option value="all_branches">{say("areaAll")}</option>
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
          {isOwner ? (
          <Fold summary={say("loanSummary")} title={say("loanTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              {textField("lender", "financeLender", finance.lender)}
              {moneyField("loanMonthly", "financeMonthlyPayment", finance.monthly_payment)}
              {moneyField("loanOutstanding", "financeOutstanding", finance.outstanding_balance)}
              {dateField("loanEnd", "financeEndDate", finance.end_date)}
            </div>
          </Fold>
          ) : null}

          <div className="sticky-actions sticky z-10 -mx-1 flex gap-2 bg-[var(--background)] px-1 py-3 sm:justify-end [&>*:last-child]:flex-1 sm:[&>*:last-child]:flex-none">
            <Link className="secondary-action pressable justify-center" href={`/fleet/${vehicle.id}`}>
              {say("cancel")}
            </Link>
            <PendingButton className="primary-action justify-center" pendingLabel={say("saving")} type="submit">
              {say("saveChanges")}
            </PendingButton>
          </div>
        </form>

        {/* Archiving and deleting live here, one step away from the list, so neither happens by a slip of the thumb. */}
        <div className="mt-3">
          <Fold summary={say("goneSummary")} title={say("goneTitle")}>
            <div className="space-y-4">
              <form action={archiveVehicle} className="flex flex-wrap items-center justify-between gap-3">
                <input name="vehicleId" type="hidden" value={vehicle.id} />
                <input name="organizationId" type="hidden" value={organization.id} />
                <p className="min-w-0 flex-1 basis-60 font-medium text-[var(--foreground-secondary)]">
                  <span className="font-bold text-[var(--foreground)]">{say("archiveLead")}</span>: {say("archiveBody")}
                </p>
                <PendingButton className="secondary-action pressable" pendingLabel={say("archiving")} type="submit">
                  {say("archiveBtn")}
                </PendingButton>
              </form>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                <p className="min-w-0 flex-1 basis-60 font-medium text-[var(--foreground-secondary)]">
                  <span className="font-bold text-[var(--foreground)]">{say("deleteLead")}</span>: {say("deleteBody")}
                </p>
                <ConfirmDeleteVehicleButton deleteAction={deleteVehicle} label={`${vehicle.make} ${vehicle.model}`} organizationId={organization.id} vehicleId={vehicle.id} />
              </div>
            </div>
          </Fold>
        </div>
      </div>
    </AppShell>
  );
}
