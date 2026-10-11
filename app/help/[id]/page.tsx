import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronLeft } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { HelpStatusButton } from "@/components/help/help-actions";
import { HelpCompose } from "@/components/help/help-compose";
import { HelpThread } from "@/components/help/help-thread";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { loadThread } from "@/lib/support-data";

export default async function HelpConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, userEmail, organization, t, locale] = await Promise.all([params, getCurrentUserEmail(), getDefaultOrganization(), getTranslations("help"), getLocale()]);
  const loaded = await loadThread(id, { side: "business", organizationId: organization.id });
  if (!loaded) notFound();
  const closed = loaded.thread.status === "closed";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link className="inline-flex items-center gap-1 font-semibold text-[var(--primary)]" href={"/help" as Route}>
          <ChevronLeft size={18} />
          {t("back")}
        </Link>
        <div className="page-hero">
          <h1 className="page-title break-words">{loaded.thread.subject}</h1>
          <p className="page-subtitle mt-2">
            {t(`topic_${loaded.thread.topic}`)} · {t(`status_${loaded.thread.status}`)}
          </p>
        </div>
        <section className="card p-4 sm:p-5">
          <HelpThread businessName={organization.name} locale={locale} messages={loaded.messages} side="business" />
          {loaded.thread.status === "open" ? <p className="mt-4 font-medium text-[var(--muted)]">{t("waitingNote")}</p> : null}
        </section>
        <section className="card p-5">
          <h2 className="text-[17px] font-bold text-[var(--foreground)]">{closed ? t("writeAgain") : t("replyTitle")}</h2>
          <div className="mt-3">
            <HelpCompose mode="reply" threadId={loaded.thread.id} />
          </div>
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <HelpStatusButton closed={closed} threadId={loaded.thread.id} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
