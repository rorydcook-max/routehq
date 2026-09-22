import { redirect } from "next/navigation";
import { updatePreferredLocale } from "@/app/actions/settings";
import { AppShell } from "@/components/app-shell";
import { PendingButton } from "@/components/pending-button";
import { Card, SectionHeader } from "@/components/ui";
import { getCurrentMembership } from "@/lib/auth/roles";
import { APP_ROLES } from "@/lib/auth/role-types";
import { defaultCalendarForLocale, supportedCalendarOptions } from "@/lib/i18n/calendars";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

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

  const supabase = (await createSupabaseServerClient()) as any;
  const [{ data: profile }, { data: organization }] = await Promise.all([
    supabase.from("users").select("full_name, preferred_locale, preferred_calendar").eq("id", membership.userId).maybeSingle(),
    supabase.from("organizations").select("name, default_locale").eq("id", membership.organizationId).maybeSingle()
  ]);

  const locale = profile?.preferred_locale || organization?.default_locale || "en";
  const roleLabel = APP_ROLES.find((role) => role.value === membership.role)?.label || "Teammate";

  return (
    <AppShell userEmail={membership.email}>
      <div className="page-hero mb-5">
        <p className="page-eyebrow">My account</p>
        <h1 className="page-title">{profile?.full_name || membership.email}</h1>
        <p className="page-subtitle mt-2">
          {roleLabel} at {organization?.name || "your business"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionHeader eyebrow="Language" title="Language and dates" />
          <div className="card-section">
            <p className="text-xs text-[#667085]">
              Only affects what you see. Other people in your business keep their own settings.
            </p>
            <form action={updatePreferredLocale} className="mt-3 space-y-3">
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Language</span>
                <select className={inputClass} defaultValue={locale} name="preferredLocale">
                  {supportedLocaleOptions.map((option) => (
                    <option key={option.code} value={option.code}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Calendar</span>
                <select
                  className={inputClass}
                  defaultValue={profile?.preferred_calendar || defaultCalendarForLocale(locale)}
                  name="preferredCalendar"
                >
                  {supportedCalendarOptions.map((calendar) => (
                    <option key={calendar.code} value={calendar.code}>
                      {calendar.label}
                    </option>
                  ))}
                </select>
              </label>
              <PendingButton className="primary-action w-full" pendingLabel="Saving..." type="submit">
                Save
              </PendingButton>
            </form>
          </div>
        </Card>

        <Card>
          <SectionHeader eyebrow="Sign-in" title="Account details" />
          <div className="card-section space-y-2 text-sm">
            <p>
              <span className="text-[#667085]">Email: </span>
              {membership.email}
            </p>
            <p>
              <span className="text-[#667085]">Role: </span>
              {roleLabel}
            </p>
            <p className="pt-1">
              <a className="font-semibold text-[var(--primary)]" href="/forgot-password">
                Change password
              </a>
            </p>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
