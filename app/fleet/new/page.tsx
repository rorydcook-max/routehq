import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { createVehicle } from "@/app/actions/vehicles";
import { ComplianceFields } from "@/app/fleet/new/compliance-fields";
import { RatesFields } from "@/app/fleet/new/rates-fields";
import { VehicleIdentityFields } from "@/app/fleet/new/vehicle-identity-fields";
import { AppShell } from "@/components/app-shell";
import { LocalizedDateInput } from "@/components/localized-date-input";
import { MoneyInput } from "@/components/money-input";
import { PendingButton } from "@/components/pending-button";
import { Fold } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { ensureDefaultBranch } from "@/lib/branches";
import { defaultCalendarForLocale } from "@/lib/i18n/calendars";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// The wording for this page is in locales/<language>/common.json under "vehicleForm".
type Say = (key: string, values?: Record<string, string | number>) => string;

const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

export default async function NewVehiclePage() {
  const userEmail = await getCurrentUserEmail();
  const organization = await getDefaultOrganization();
  const say = (await getTranslations("vehicleForm")) as unknown as Say;
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  const [allCategories, branches, { data: profile }, { data: organizationSettings }] = await Promise.all([
    getVehicleCategories(organization.id),
    ensureDefaultBranch(organization),
    supabase.from("users").select("preferred_locale, preferred_calendar").eq("id", user?.id).maybeSingle(),
    supabase.from("organizations").select("settings").eq("id", organization.id).maybeSingle()
  ]);
  // Start on the kind of vehicle the business said it rents: a scooter shop should not have to change "Car" every time.
  const fleetType = String(organizationSettings?.settings?.fleet_type || "");
  const firstCodes = fleetType === "motorcycles" ? ["scooter", "motorcycle"] : ["car"];
  const categories = [...allCategories].sort((a, b) => {
    const rank = (code: string) => (firstCodes.includes(code) ? firstCodes.indexOf(code) : firstCodes.length);
    return rank(a.code) - rank(b.code);
  });
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
  const currency = organization.currency || "THB";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl">
        <div className="page-hero mb-4">
          <Link className="font-bold text-[var(--primary)]" href="/fleet">
            {say("backToFleet")}
          </Link>
          <div className="mt-2 flex items-start justify-between gap-3">
            <h1 className="page-title">{say("addTitle")}</h1>
            <Link className="secondary-action pressable shrink-0" href="/fleet/import">
              {say("import")}
            </Link>
          </div>
          <p className="page-subtitle page-subtitle-keep mt-1">{say("addSubtitle")}</p>
        </div>

        <form action={createVehicle} className="space-y-3">
          <input name="organizationId" type="hidden" value={organization.id} />

          <VehicleIdentityFields categories={categories} initialMakes={vehicleMakes || []} inputClass={inputClass} />

          <RatesFields currency={currency} />

          {/* Everything below can wait: one tap away, filled in any time. */}
          <Fold summary={say("datesSummary")} title={say("datesTitle")}>
            <ComplianceFields calendar={preferredCalendar} inputClass={inputClass} preferredLocale={preferredLocale} />
          </Fold>
          <Fold summary={say("valueSummary")} title={say("valueTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{say("mileage")}</span>
                <input className={inputClass} inputMode="numeric" min="0" name="mileage" placeholder="0" type="number" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("purchaseMileage")}</span>
                <input className={inputClass} inputMode="numeric" min="0" name="purchaseMileage" placeholder="0" type="number" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("purchasePrice")}</span>
                <MoneyInput currency={currency} name="purchasePrice" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("estimatedValue")}</span>
                <MoneyInput currency={currency} name="estimatedValue" />
              </label>
            </div>
          </Fold>
          {branches.length > 1 ? (
            <Fold summary={defaultBranch?.name || say("locSummary")} title={say("locTitle")}>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>{say("homeBranch")}</span>
                  <select className={inputClass} defaultValue={defaultBranch?.id} name="homeBranchId">
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>{say("serviceArea")}</span>
                  <select className={inputClass} defaultValue="home_branch" name="serviceArea">
                    <option value="home_branch">{say("areaHome")}</option>
                    <option value="all_branches">{say("areaAll")}</option>
                  </select>
                </label>
              </div>
            </Fold>
          ) : (
            <>
              <input name="homeBranchId" type="hidden" value={defaultBranch?.id || ""} />
              <input name="serviceArea" type="hidden" value="home_branch" />
            </>
          )}
          <Fold summary={say("loanSummary")} title={say("loanTitle")}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className={labelClass}>{say("lender")}</span>
                <input className={inputClass} name="financeLender" type="text" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("loanMonthly")}</span>
                <MoneyInput currency={currency} name="financeMonthlyPayment" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("loanOutstanding")}</span>
                <MoneyInput currency={currency} name="financeOutstanding" />
              </label>
              <label className="block">
                <span className={labelClass}>{say("loanEnd")}</span>
                <LocalizedDateInput calendar={preferredCalendar} inputClass={inputClass} name="financeEndDate" preferredLocale={preferredLocale} />
              </label>
            </div>
          </Fold>

          <div className="sticky-actions sticky z-10 -mx-1 flex gap-2 bg-[var(--background)] px-1 py-3 sm:justify-end [&>*:last-child]:flex-1 sm:[&>*:last-child]:flex-none">
            <Link className="secondary-action pressable justify-center" href="/fleet">
              {say("cancel")}
            </Link>
            <PendingButton className="primary-action justify-center" pendingLabel={say("saving")} type="submit">
              {say("save")}
            </PendingButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
