import type { Route } from "next";
import { redirect } from "next/navigation";

/** Old link to one conversation (e.g. in an earlier phone alert): open it in the helpdesk instead. */
export default async function HelpTeamConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/platform/support/${encodeURIComponent(id)}` as Route);
}
