import Link from "next/link";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { signOut } from "@/app/actions/auth";
import { RouteHqLogo } from "@/components/brand-logo";
import { PendingButton } from "@/components/pending-button";
import { supportContacts } from "@/lib/support";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRequestUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Shown to the team of a business RouteHQ has closed (admin console › Delete business, a soft delete that can be
 * undone for 30 days). Nothing in the business can be used; they can contact RouteHQ, start a new business or
 * sign in with another account.
 */
export default async function BusinessClosedPage() {
  const user = await getRequestUser();
  if (!user) redirect("/login");
  const say = (await getTranslations("businessClosed")) as unknown as (key: string, values?: Record<string, string>) => string;

  // The names of their closed businesses, so the page says which one this is about.
  let names: string[] = [];
  try {
    const db = createSupabaseAdminClient() as any;
    const { data } = await db.from("organization_members").select("organizations(name, deleted_at)").eq("user_id", user.id).eq("is_active", true);
    names = ((data || []) as any[]).filter((row) => row.organizations?.deleted_at).map((row) => String(row.organizations?.name || "")).filter(Boolean);
  } catch {
    names = [];
  }
  const contacts = supportContacts();

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-6">
        <RouteHqLogo />
      </div>
      <section className="card p-5">
        <h1 className="text-[26px] font-bold leading-tight text-[var(--foreground)]">{say("title")}</h1>
        <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{names.length ? say("bodyNamed", { name: names.join(", ") }) : say("body")}</p>
        <p className="mt-2 font-medium text-[var(--foreground-secondary)]">{say("contact")}</p>
        <div className="mt-5 grid gap-2">
          {contacts.whatsappUrl ? (
            <a className="primary-action pressable w-full" href={contacts.whatsappUrl} rel="noreferrer" target="_blank">
              {say("whatsapp")}
            </a>
          ) : null}
          {contacts.lineUrl ? (
            <a className="secondary-action pressable w-full" href={contacts.lineUrl} rel="noreferrer" target="_blank">
              {say("line")}
            </a>
          ) : null}
          {contacts.email ? (
            <a className="secondary-action pressable w-full" href={`mailto:${contacts.email}?subject=${encodeURIComponent(say("emailSubject"))}`}>
              {say("email")}
            </a>
          ) : null}
          <Link className="secondary-action pressable w-full" href={"/onboarding" as Route}>
            {say("newBusiness")}
          </Link>
          <form action={signOut}>
            <PendingButton className="secondary-action pressable w-full" pendingLabel="…" type="submit">
              {say("otherAccount")}
            </PendingButton>
          </form>
        </div>
      </section>
    </main>
  );
}
