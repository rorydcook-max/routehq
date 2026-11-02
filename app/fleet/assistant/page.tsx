import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { MessageSquare, Plus } from "lucide-react";
import { listAssistantConversations, loadAssistantConversation } from "@/app/actions/fleet-assistant";
import { AppShell } from "@/components/app-shell";
import { FleetAssistant } from "@/components/fleet-assistant";
import { BackLink } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { dateFormat } from "@/lib/i18n/dates";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The setup assistant after onboarding (Rory, 2 Nov 2026): add vehicles or who's renting now by typing, talking or
 * sending photos, from Fleet and the + menu. Every chat is kept: ?c= opens one, and earlier chats are listed.
 */
export default async function FleetAssistantPage({ searchParams }: { searchParams: Promise<{ c?: string }> }) {
  const { c } = await searchParams;
  const [userEmail, organization, t, locale] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getTranslations("fleetAssistant"), getLocale()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const [{ count }, initial, earlier] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }).eq("organization_id", organization.id).is("deleted_at", null),
    c ? loadAssistantConversation(c) : Promise.resolve(null),
    listAssistantConversations(20)
  ]);
  const hasVehicles = (count || 0) > 0;
  const when = (iso: string) => dateFormat(locale, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" }).format(new Date(iso));

  return (
    <AppShell userEmail={userEmail}>
      <div className="page-form">
        <div className="page-hero mb-4">
          <BackLink href="/fleet" label={t("pageBack")} />
          <div className="flex items-center justify-between gap-3">
            <h1 className="page-title">{t("pageTitle")}</h1>
            {initial ? (
              <Link className="pressable inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[var(--panel)] px-4 text-sm font-bold text-[var(--foreground)] shadow-[var(--shadow-card)]" href={"/fleet/assistant" as Route}>
                <Plus size={15} />
                {t("newChat")}
              </Link>
            ) : null}
          </div>
          <p className="page-subtitle measure mt-2">{t("pageSubtitle")}</p>
        </div>
        <FleetAssistant
          currency={organization.currency || "THB"}
          greeting={hasVehicles ? t("helloAny") : undefined}
          hasVehicles={hasVehicles}
          initial={initial}
          key={initial?.id || "new"}
          organizationId={organization.id}
          rememberInUrl
        />
        {earlier.filter((chat) => chat.id !== initial?.id).length ? (
          <details className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel)]" open={!initial}>
            <summary className="cursor-pointer list-none px-4 py-3 font-bold text-[var(--foreground)]">{t("earlierChats")}</summary>
            <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
              {earlier
                .filter((chat) => chat.id !== initial?.id)
                .map((chat) => (
                  <li key={chat.id}>
                    <Link className="pressable flex items-center gap-3 px-4 py-3" href={`/fleet/assistant?c=${chat.id}` as Route}>
                      <MessageSquare className="shrink-0 text-[var(--muted)]" size={16} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--foreground)]">{chat.title || t("untitledChat")}</span>
                      <span className="shrink-0 text-xs text-[var(--muted)]">{when(chat.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
            </ul>
          </details>
        ) : null}
      </div>
    </AppShell>
  );
}
