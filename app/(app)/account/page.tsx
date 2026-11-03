import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { updatePreferredLocale } from "@/app/actions/settings";
import { signOut } from "@/app/actions/auth";
import { AppShell } from "@/components/app-shell";
import { PageBand } from "@/components/page-band";
import { PendingButton } from "@/components/pending-button";
import { PushToggle } from "@/components/push-toggle";
import { ThemePicker } from "@/components/theme-picker";
import { getCurrentMembership } from "@/lib/auth/roles";
import { defaultCalendarForLocale, supportedCalendarOptions } from "@/lib/i18n/calendars";
import { operatorLocaleOptions } from "@/lib/i18n/locales";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Say = (key: string, values?: Record<string, string | number>) => string;

const labelClass = "font-semibold text-[var(--foreground-secondary)]";
const inputClass = "mt-1 w-full";

/**
 * Personal settings for whoever is signed in, whatever their role. Nothing on
 * this page changes the business or anyone else's experience, so teammates can
 * use it even though they cannot open the business Settings page.
 */
export default async function AccountPage() {
  const membership = await getCurrentMembership();
  if (!membership) {
    redirect("/login");
  }

  const say = (await getTranslations("accountPage")) as unknown as Say;
  const nav = await getTranslations("nav");
  const supabase = (await createSupabaseServerClient()) as any;
  const [{ data: profile }, { data: organization }] = await Promise.all([
    supabase.from("users").select("full_name, preferred_locale, preferred_calendar").eq("id", membership.userId).maybeSingle(),
    supabase.from("organizations").select("name, default_locale").eq("id", membership.organizationId).maybeSingle()
  ]);

  const locale = profile?.preferred_locale || organization?.default_locale || "en";
  const roleLabel = membership.role === "owner" ? say("roleOwner") : membership.role === "manager" ? say("roleManager") : say("roleTeammate");

  return (
    // The same page header as every other operator page (the teal band on phones), not a plain one of its own.
    <AppShell
      hero={<PageBand keepSubtitle subtitle={organization?.name ? say("roleAt", { role: roleLabel, business: organization.name }) : roleLabel} title={profile?.full_name || membership.email} />}
      userEmail={membership.email}
    >
      {/* One column of settings, sign-in first: no masonry holes between cards of different heights. */}
      <div className="page-form space-y-4">
        <section className="card p-5">
          <h2 className="card-title">{say("signInTitle")}</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5">
              <p className="font-medium text-[var(--foreground-secondary)]">{say("email")}</p>
              <p className="break-all text-[16px] font-bold text-[var(--foreground)]">{membership.email}</p>
            </div>
            <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5">
              <p className="font-medium text-[var(--foreground-secondary)]">{say("role")}</p>
              <p className="text-[16px] font-bold text-[var(--foreground)]">{roleLabel}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a className="secondary-action pressable whitespace-nowrap" href="/forgot-password">
              {say("changePassword")}
            </a>
            {/* Sign out is in the sidebar too: here it is a quiet red text button, not a second outlined one. */}
            <form action={signOut} className="ms-auto">
              <PendingButton className="pressable min-h-11 whitespace-nowrap rounded-full px-3 font-bold text-[var(--danger)] hover:bg-[var(--danger-light)]" pendingLabel="" type="submit">
                {nav("signOut")}
              </PendingButton>
            </form>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="card-title">{say("languageTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("languageBody")}</p>
          {/* Keyed by the saved values so the form shows them after a save (React resets forms to their first defaults). */}
          <form action={updatePreferredLocale} className="mt-3 space-y-3" key={`${locale}-${profile?.preferred_calendar || ""}`}>
            <label className="block">
              <span className={labelClass}>{say("language")}</span>
              <select className={inputClass} defaultValue={locale} name="preferredLocale">
                {operatorLocaleOptions.map((option) => (
                  <option key={option.code} value={option.code}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>{say("calendar")}</span>
              <select className={inputClass} defaultValue={profile?.preferred_calendar || defaultCalendarForLocale(locale)} name="preferredCalendar">
                {supportedCalendarOptions.map((calendar) => (
                  <option key={calendar.code} value={calendar.code}>
                    {say(`calendar_${calendar.code}`)}
                  </option>
                ))}
              </select>
              <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("calendarHelp")}</span>
            </label>
            <PendingButton className="primary-action w-full sm:w-auto" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
              {say("save")}
            </PendingButton>
          </form>
        </section>

        <section className="card p-5">
          <h2 className="card-title">{say("themeTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("themeBody")}</p>
          <ThemePicker />
        </section>

        <section className="card p-5">
          <h2 className="card-title">{say("alertsTitle")}</h2>
          <div className="mt-2">
            <PushToggle />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
