import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { Bot } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { BackLink } from "@/components/ui";
import { PlanActivateButton } from "@/components/help/plan-activate";
import { ADMIN_TIER_LABEL, adminDate, requirePlatformAdmin } from "@/lib/admin";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { STATUS_LABEL, loadBusinessContext, loadConversationData } from "@/lib/helpdesk";
import { SAVED_REPLIES } from "@/lib/helpdesk-replies";
import { formatPlanPrice } from "@/lib/plan-currency";
import { StatusPill } from "../../admin-nav";
import { HelpdeskComposer } from "./composer";
import { AutoRefresh, ConversationControls, TakeOverButton } from "./controls";
import { HelpdeskTranscript } from "./transcript";

export const dynamic = "force-dynamic";

const TOPIC_LABEL: Record<string, string> = { question: "Question", problem: "Problem", import: "Import", billing: "Billing", domain: "Domain", idea: "Idea" };

/**
 * One support conversation for the RoveHQ team: the full transcript (assistant turns and internal notes included),
 * the reply box, and who the customer is. Platform admins only. Opening it marks it read for the team.
 */
export default async function SupportConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requirePlatformAdmin();
  const { id } = await params;
  const [userEmail, loaded] = await Promise.all([getCurrentUserEmail(), loadConversationData(id)]);
  if (!loaded) notFound();
  const { thread, messages, previous } = loaded;
  const business = thread.organizationId ? await loadBusinessContext(thread.organizationId) : null;
  const isVisitor = !thread.organizationId;
  const customerLabel = business?.name || thread.visitorName || thread.visitorEmail || "the visitor";
  // Where a reply ends up, said plainly under the box so nobody expects an email to go out.
  const replyNote = isVisitor
    ? "Visitors see replies in the chat widget when they come back on the same browser. No email is sent."
    : "The business sees this in RoveHQ (chat and Help page) and gets an alert.";

  return (
    <AppShell userEmail={userEmail}>
      <AutoRefresh />
      <BackLink href="/platform/support" label="Support" />
      <header className="mb-5">
        <p className="text-[13px] font-bold uppercase tracking-[0.08em] text-[var(--primary)]">RoveHQ support</p>
        <h1 className="page-title mt-1 break-words">{thread.subject}</h1>
        <p className="mt-1.5 font-medium text-[var(--foreground-secondary)]">
          {business ? business.name : `Website visitor${thread.visitorEmail ? ` · ${thread.visitorEmail}` : ""}`} · {thread.channel === "chat" ? "Chat" : "Help page"}
          {thread.topic && thread.channel === "help" ? ` · ${TOPIC_LABEL[thread.topic] || thread.topic}` : ""} · {thread.mode === "ai" ? "Assistant is handling it" : STATUS_LABEL[thread.status]}
          {thread.priority === "high" ? " · High priority" : ""}
        </p>
      </header>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
        <div className="min-w-0 space-y-4">
          {thread.mode === "ai" ? (
            <section className="card flex flex-col gap-3 border-2 border-[var(--info)] p-5 sm:flex-row sm:items-center">
              <Bot className="shrink-0 text-[var(--info)]" size={26} />
              <div className="min-w-0 flex-1">
                <h2 className="card-title">The assistant is handling this</h2>
                <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">It isn&apos;t in the team queue yet. Take over to answer it yourself; the assistant stops replying.</p>
              </div>
              <TakeOverButton threadId={thread.id} />
            </section>
          ) : null}

          <section className="card p-4 sm:p-5">
            <HelpdeskTranscript messages={messages} />
          </section>

          <section className="card p-5">
            <HelpdeskComposer
              customerLabel={customerLabel}
              note={thread.mode === "ai" ? `${replyNote} Sending a reply also takes the conversation over from the assistant.` : replyNote}
              savedReplies={SAVED_REPLIES}
              threadId={thread.id}
            />
          </section>
        </div>

        <aside className="min-w-0 space-y-4">
          <section className="card p-5">
            <ConversationControls
              assignedTo={thread.assignedTo}
              assigneeName={thread.assigneeName}
              meId={me.userId}
              mode={thread.mode}
              priority={thread.priority}
              status={thread.status}
              tags={thread.tags}
              threadId={thread.id}
            />
          </section>

          {business ? (
            <section className="card space-y-2 p-5">
              <Link className="card-title block hover:text-[var(--primary)] hover:underline" href={`/platform/businesses/${business.id}` as Route}>
                {business.name}
              </Link>
              <div className="flex flex-wrap items-center gap-2">
                <StatusPill status={business.status} />
                <span className="text-[14px] font-semibold text-[var(--foreground-secondary)]">
                  {ADMIN_TIER_LABEL[business.tier] || business.tier} · {business.interval}
                </span>
              </div>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
                <dt className="font-semibold text-[var(--muted)]">Owner</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{business.ownerEmail ? <a className="text-[var(--primary)] hover:underline" href={`mailto:${business.ownerEmail}`}>{business.ownerEmail}</a> : "—"}</dd>
                <dt className="font-semibold text-[var(--muted)]">Country</dt>
                <dd className="font-medium">{business.country || "—"}</dd>
                <dt className="font-semibold text-[var(--muted)]">Vehicles</dt>
                <dd className="num font-medium">{business.vehicles}</dd>
                <dt className="font-semibold text-[var(--muted)]">Page</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{thread.page || "—"}</dd>
              </dl>
            </section>
          ) : (
            <section className="card space-y-2 p-5">
              <h2 className="card-title">Website visitor</h2>
              <p className="font-medium text-[var(--foreground-secondary)]">Not signed in to RoveHQ.</p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[14px]">
                <dt className="font-semibold text-[var(--muted)]">Name</dt>
                <dd className="font-medium">{thread.visitorName || "—"}</dd>
                <dt className="font-semibold text-[var(--muted)]">Email</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{thread.visitorEmail ? <a className="text-[var(--primary)] hover:underline" href={`mailto:${thread.visitorEmail}`}>{thread.visitorEmail}</a> : "Not given"}</dd>
                <dt className="font-semibold text-[var(--muted)]">Page</dt>
                <dd className="font-medium [overflow-wrap:anywhere]">{thread.page || "—"}</dd>
              </dl>
            </section>
          )}

          {business?.planRequest ? (
            // A plan the business chose and is paying for: switch it on here when the money arrives (as on the old team page).
            <section className="card border-2 border-[var(--warning-line)] p-5">
              <h2 className="card-title">Waiting for payment</h2>
              <p className="mt-1 font-semibold text-[var(--foreground)]">
                {ADMIN_TIER_LABEL[business.planRequest.plan] || business.planRequest.plan} · {business.planRequest.interval} · {formatPlanPrice(business.planRequest.amount, business.planRequest.currency, "en-GB")}
              </p>
              <p className="mt-1 text-[14px] font-medium text-[var(--muted)]">Asked {adminDate(business.planRequest.requestedAt)}. Switch it on once the payment has arrived.</p>
              <div className="mt-3">
                <PlanActivateButton organizationId={business.id} />
              </div>
            </section>
          ) : null}

          <section className="card p-5">
            <h2 className="card-title">Previous conversations</h2>
            {previous.length ? (
              <ul className="mt-2 divide-y divide-[var(--border)]">
                {previous.map((item) => (
                  <li key={item.id}>
                    <Link className="block py-2 hover:text-[var(--primary)]" href={`/platform/support/${item.id}` as Route}>
                      <span className="block truncate font-semibold">{item.subject}</span>
                      <span className="block text-[13px] font-medium text-[var(--muted)]">
                        {item.channel === "chat" ? "Chat" : "Help"} · {STATUS_LABEL[item.status] || item.status} · {adminDate(item.lastMessageAt)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 font-medium text-[var(--muted)]">None before this one.</p>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
