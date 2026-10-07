import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { updatePreferredLocale } from "@/app/actions/settings";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { PushToggle } from "@/components/push-toggle";
import { getCurrentMembership } from "@/lib/auth/roles";
import { defaultCalendarForLocale, supportedCalendarOptions } from "@/lib/i18n/calendars";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
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
  const supabase = (await createSupabaseServerClient()) as any;
  const [{ data: profile }, { data: organization }] = await Promise.all([
    supabase.from("users").select("full_name, preferred_locale, preferred_calendar").eq("id", membership.userId).maybeSingle(),
    supabase.from("organizations").select("name, default_locale").eq("id", membership.organizationId).maybeSingle()
  ]);

  const locale = profile?.preferred_locale || organization?.default_locale || "en";
  const roleLabel = membership.role === "owner" ? say("roleOwner") : say("roleTeammate");

  return (
    <AppShell userEmail={membership.email}>
      <div className="page-hero mb-4">
        <h1 className="page-title">{profile?.full_name || membership.email}</h1>
        <p className="page-subtitle page-subtitle-keep mt-1">
          {organization?.name ? say("roleAt", { role: roleLabel, business: organization.name }) : roleLabel}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("languageTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("languageBody")}</p>
          {/* Keyed by the saved values so the form shows them after a save (React resets forms to their first defaults). */}
          <form action={updatePreferredLocale} className="mt-3 space-y-3" key={`${locale}-${profile?.preferred_calendar || ""}`}>
            <label className="block">
              <span className={labelClass}>{say("language")}</span>
              <select className={inputClass} defaultValue={locale} name="preferredLocale">
                {supportedLocaleOptions.map((option) => (
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
            <PendingButton className="primary-action w-full" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
              {say("save")}
            </PendingButton>
          </form>
        </section>

        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("alertsTitle")}</h2>
          <div className="mt-2">
            <PushToggle />
          </div>
        </section>

        <section className="card p-4">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("signInTitle")}</h2>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
              <p className="font-medium text-[var(--foreground-secondary)]">{say("email")}</p>
              <p className="break-all text-[16px] font-bold text-[var(--foreground)]">{membership.email}</p>
            </div>
            <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
              <p className="font-medium text-[var(--foreground-secondary)]">{say("role")}</p>
              <p className="text-[16px] font-bold text-[var(--foreground)]">{roleLabel}</p>
            </div>
          </div>
          <a className="secondary-action mt-3 w-full" href="/forgot-password">
            {say("changePassword")}
          </a>
        </section>
      </div>
    </AppShell>
  );
}
