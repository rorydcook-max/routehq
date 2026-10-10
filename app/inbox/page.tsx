import Link from "next/link";
import type { Route } from "next";
import { getTranslations } from "next-intl/server";
import { MessagesSquare } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { InboxView } from "@/app/inbox/inbox-view";
import { MessagesToSend, type ToSendGroup } from "@/app/inbox/messages-to-send";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getCurrentMembership } from "@/lib/auth/roles";
import type { InboxConversation, InboxMessage } from "@/lib/inbox/store";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InboxPage({ searchParams }: { searchParams: Promise<{ c?: string; show?: string }> }) {
  const { c: selectedId, show } = await searchParams;
  const [userEmail, organization, membership] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization(), getCurrentMembership()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const filter = show === "closed" ? "closed" : "open";

  const [{ data: channels }, { data: conversations }, { data: customers }] = await Promise.all([
    supabase.from("messaging_channels").select("id, provider, display_name, status").eq("organization_id", organization.id).neq("status", "disconnected"),
    supabase
      .from("conversations")
      .select("id, channel_id, provider, external_user_id, display_name, avatar_url, customer_id, status, unread_count, last_message_at, last_message_preview, last_message_direction")
      .eq("organization_id", organization.id)
      .eq("status", filter)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase.from("customers").select("id, full_name, phone").eq("organization_id", organization.id).is("deleted_at", null).order("full_name", { ascending: true }).limit(500)
  ]);

  const list = (conversations || []) as InboxConversation[];
  let selected = list.find((conversation) => conversation.id === selectedId) || null;
  // A link to a conversation that's in the other list (say, a closed one) still opens it.
  if (!selected && selectedId) {
    const { data } = await supabase
      .from("conversations")
      .select("id, channel_id, provider, external_user_id, display_name, avatar_url, customer_id, status, unread_count, last_message_at, last_message_preview, last_message_direction")
      .eq("organization_id", organization.id)
      .eq("id", selectedId)
      .maybeSingle();
    selected = (data as InboxConversation) || null;
  }

  const [{ data: messages }, { data: bookings }] = await Promise.all([
    selected
      ? supabase.from("conversation_messages").select("id, conversation_id, direction, message_type, body, status, error, created_at").eq("conversation_id", selected.id).order("created_at", { ascending: true }).limit(300)
      : Promise.resolve({ data: [] }),
    selected?.customer_id
      ? supabase
          .from("rentals")
          .select("id, status, start_date, end_date, balance_due, reference, display_code, vehicles(make, model, registration_number)")
          .eq("organization_id", organization.id)
          .eq("customer_id", selected.customer_id)
          .order("start_date", { ascending: false })
          .limit(4)
      : Promise.resolve({ data: [] })
  ]);

  const hasChannel = (channels || []).length > 0;

  // Messages the app wrote for customers with no chat open yet: they wait for the owner to send them in a tap.
  // Same rule as the booking page: the last three days, and not overtaken by a later message.
  const { data: waiting } = await supabase
    .from("communication_log")
    .select("id, rental_id, customer_id, content, metadata, created_at, customers(full_name), rentals(reference, display_code)")
    .eq("organisation_id", organization.id)
    .eq("type", "automated_reminder")
    .in("status", ["pending", "failed"])
    .not("metadata->handoff_label", "is", null)
    .gte("created_at", new Date(Date.now() - 3 * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(100);
  const toSend = new Map<string, ToSendGroup>();
  for (const row of (waiting || []) as any[]) {
    if (row.metadata?.superseded) continue;
    const key = String(row.rental_id || row.customer_id || row.id);
    const group: ToSendGroup = toSend.get(key) || {
      key,
      customerName: String(row.customers?.full_name || ""),
      bookingRef: String(row.rentals?.reference || row.rentals?.display_code || ""),
      rentalId: row.rental_id || null,
      messages: []
    };
    group.messages.push({ id: row.id, content: String(row.content || ""), url: row.metadata?.handoff_url || null });
    toSend.set(key, group);
  }
  const toSendGroups = [...toSend.values()];
  const t = await getTranslations("inbox");

  return (
    <AppShell userEmail={userEmail}>
      <div className="mb-4">
        <h1 className="page-title">{t("title")}</h1>
        <p className="page-subtitle mt-1">{t("subtitle")}</p>
      </div>

      {toSendGroups.length ? <MessagesToSend groups={toSendGroups} /> : null}

      {!hasChannel && list.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-white p-8 text-center shadow-[var(--shadow-sm)]">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
            <MessagesSquare size={22} />
          </span>
          <h2 className="mt-4 text-[17px] font-semibold text-[var(--foreground)]">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-[var(--muted)]">
            {t("emptyBody")}
          </p>
          {membership?.role === "owner" ? (
            <Link className="primary-action pressable mt-5 inline-flex" href={"/settings?tab=messaging" as Route}>
              {t("connect")}
            </Link>
          ) : (
            <p className="mt-4 text-sm text-[var(--muted)]">{t("askOwner")}</p>
          )}
        </div>
      ) : (
        <InboxView
          bookings={(bookings || []) as any[]}
          conversations={list}
          customers={(customers || []) as Array<{ id: string; full_name: string | null; phone: string | null }>}
          filter={filter}
          messages={(messages || []) as InboxMessage[]}
          selected={selected}
        />
      )}
    </AppShell>
  );
}
