import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { HelpStatusButton } from "@/components/help/help-actions";
import { HelpCompose } from "@/components/help/help-compose";
import { HelpThread } from "@/components/help/help-thread";
import { PlanActivateButton } from "@/components/help/plan-activate";
import { numberLocale } from "@/lib/i18n/dates";
import { formatPlanPrice } from "@/lib/plan-currency";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { isPlatformAdmin, replyLinkFor } from "@/lib/support";
import { loadThread } from "@/lib/support-data";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** One conversation, answered by the Lokalfleet team. */
export default async function HelpTeamConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userEmail, membership, t, locale] = await Promise.all([params, getCurrentUserEmail(), getCurrentMembership(), getTranslations("help"), getLocale()]);
  const supabase = (await createSupabaseServerClient()) as any;
  if (!(await isPlatformAdmin(supabase, membership?.userId))) notFound();
  const loaded = await loadThread(id, { side: "team", organizationId: null });
  if (!loaded) notFound();
  const { business, thread } = loaded;
  const closed = thread.status === "closed";
  // A plan the business chose and is paying for: the team switches it on when the money arrives.
  const { data: request } = await (createSupabaseAdminClient() as any)
    .from("organizations")
    .select("pending_plan, pending_interval, pending_amount, pending_currency, plan_requested_at, next_payment_due, subscription_status")
    .eq("id", thread.organizationId)
    .maybeSingle();
  const planRequest = request?.pending_plan
    ? {
        what: t("teamRequestWhat", {
          plan: t(`plan_${request.pending_plan}`),
          interval: request.pending_interval === "yearly" ? t("teamYearly") : t("teamMonthly"),
          amount: formatPlanPrice(Number(request.pending_amount || 0), String(request.pending_currency || "THB"), numberLocale(locale))
        })
      }
    : null;
  const outside = business.preference.channel !== "app" ? replyLinkFor(business.preference.channel, business.preference.handle, business.preference.channel === "email" ? `Lokalfleet: ${thread.subject}` : "") : null;

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form space-y-4">
        <div className="page-hero">
          <BackLink href="/help/team" label={t("teamTitle")} />
          <h1 className="page-title break-words">{thread.subject}</h1>
          <p className="page-subtitle mt-2">
            {business.name} · {t(`topic_${thread.topic}`)} · {t(`teamStatus_${thread.status}`)}
          </p>
        </div>

        <section className="card grid gap-2 p-5 sm:grid-cols-2">
          <p className="font-medium text-[var(--foreground-secondary)]">
            <span className="font-bold text-[var(--foreground)]">{t("teamPlan")}</span> {t(`plan_${business.plan}`)} · {business.yearly ? t("teamYearly") : t("teamMonthly")} · {business.status}
          </p>
          <p className="font-medium text-[var(--foreground-secondary)]">
            <span className="font-bold text-[var(--foreground)]">{t("teamImport")}</span> {business.importIncluded ? t("teamImportIncluded") : t("teamImportNot")}
          </p>
          <p className="font-medium text-[var(--foreground-secondary)] sm:col-span-2">
            <span className="font-bold text-[var(--foreground)]">{t("teamPrefers")}</span> {t(`channel_${business.preference.channel}`)}
            {business.preference.handle ? ` · ${business.preference.handle}` : ""}
          </p>
          <p className="font-medium text-[var(--foreground-secondary)] sm:col-span-2">
            {[business.phone, business.email, business.lineId ? `LINE ${business.lineId}` : ""].filter(Boolean).join(" · ")}
          </p>
          {outside ? (
            <a className="secondary-action pressable w-fit" href={outside} rel="noreferrer" target="_blank">
              <ExternalLink size={17} />
              {t("teamReplyOn", { channel: t(`channel_${business.preference.channel}`) })}
            </a>
          ) : null}
        </section>

        {planRequest ? (
          <section className="card border-2 border-[var(--warning-line)] p-5">
            <h2 className="card-title">{t("teamRequest")}</h2>
            <p className="mt-1 font-semibold text-[var(--foreground)]">{planRequest.what}</p>
            <p className="mt-1 text-sm font-medium text-[var(--muted)]">{t("teamRequestNote")}</p>
            <div className="mt-3">
              <PlanActivateButton organizationId={thread.organizationId} />
            </div>
          </section>
        ) : null}

        <section className="card p-4 sm:p-5">
          <HelpThread businessName={business.name} locale={locale} messages={loaded.messages} side="team" />
        </section>
        <section className="card p-5">
          <h2 className="card-title">{t("teamReplyTitle")}</h2>
          <p className="mt-1 font-medium text-[var(--muted)]">{t("teamReplyNote")}</p>
          <div className="mt-3">
            <HelpCompose asTeam mode="reply" threadId={thread.id} />
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <HelpStatusButton closed={closed} threadId={thread.id} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
