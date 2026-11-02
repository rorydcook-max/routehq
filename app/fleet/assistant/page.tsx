import type { Route } from "next";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Camera, FileSpreadsheet, KeyRound, MessageSquare, Mic, Plus } from "lucide-react";
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
 * sending photos, from Fleet and the + menu. Every chat is kept: ?c= opens one, and earlier chats are listed beside it.
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
  const others = earlier.filter((chat) => chat.id !== initial?.id);
  const abilities = [
    { icon: FileSpreadsheet, text: t("canSheet") },
    { icon: Camera, text: t("canPhoto") },
    { icon: Mic, text: t("canTalk") },
    { icon: KeyRound, text: t("canRentals") }
  ];

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-4">
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
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <FleetAssistant
            currency={organization.currency || "THB"}
            greeting={hasVehicles ? t("helloAny") : undefined}
            hasVehicles={hasVehicles}
            initial={initial}
            key={initial?.id || "new"}
            organizationId={organization.id}
            rememberInUrl
            tall
          />

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)] p-4">
              <p className="font-bold text-[var(--foreground)]">{t("canTitle")}</p>
              <ul className="mt-3 space-y-3">
                {abilities.map(({ icon: Icon, text }) => (
                  <li className="flex gap-3 text-sm text-[var(--foreground-secondary)]" key={text}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
                      <Icon size={15} />
                    </span>
                    <span className="pt-1.5 leading-snug">{text}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">{t("canNote")}</p>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--panel)]">
              <p className="px-4 pt-4 font-bold text-[var(--foreground)]">{t("earlierChats")}</p>
              {others.length ? (
                <ul className="mt-2 divide-y divide-[var(--border)] border-t border-[var(--border)]">
                  {others.map((chat) => (
                    <li key={chat.id}>
                      <Link className="pressable flex items-center gap-3 px-4 py-3" href={`/fleet/assistant?c=${chat.id}` as Route}>
                        <MessageSquare className="shrink-0 text-[var(--muted)]" size={16} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{chat.title || t("untitledChat")}</span>
                          <span className="block text-xs text-[var(--muted)]">{when(chat.updatedAt)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="px-4 pb-4 pt-1 text-sm text-[var(--muted)]">{t("noChats")}</p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
