"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { approveContentRequest, collateContentRequests, draftContentRequest, markContentMade, rejectContentRequest, saveContentDraft } from "@/lib/content-requests";
import { said } from "@/lib/i18n/server-text";
import { isPlatformAdmin } from "@/lib/support";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * The buttons on /help/team/content. Every one checks the caller is a platform admin first: the queue holds what
 * businesses' staff asked, so nobody else may see or change it, and only these actions can publish to the help centre.
 */
type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function teamUser(): Promise<string | null> {
  const membership = await getCurrentMembership();
  if (!membership) return null;
  const supabase = (await createSupabaseServerClient()) as any;
  return (await isPlatformAdmin(supabase, membership.userId)) ? membership.userId : null;
}

/** Library results speak English; the reader may not. The page is refreshed after anything that changed. */
async function finish(result: { ok: true } | { ok: false; error: string }): Promise<ActionResult> {
  if (!result.ok) return { ok: false, error: await said(result.error) };
  revalidatePath("/help/team/content");
  // The "N waiting" badge on the helpdesk's Content requests card.
  revalidatePath("/platform/support");
  return { ok: true };
}

const notAllowed = async (): Promise<ActionResult> => ({ ok: false, error: await said("Only the RoveHQ team can do that.") });

export async function collateContentAction(): Promise<{ ok: true; questions: number; created: number; merged: number } | { ok: false; error: string }> {
  if (!(await teamUser())) return notAllowed() as Promise<{ ok: false; error: string }>;
  const result = await collateContentRequests();
  if (!result.ok) return { ok: false, error: await said(result.error) };
  revalidatePath("/help/team/content");
  // The "N waiting" badge on the helpdesk's Content requests card.
  revalidatePath("/platform/support");
  return result;
}

export async function draftContentAction(id: string): Promise<ActionResult> {
  if (!(await teamUser())) return notAllowed();
  return finish(await draftContentRequest(String(id || "")));
}

export async function saveContentDraftAction(id: string, edits: { title?: string; body?: string; q?: string; a?: string }): Promise<ActionResult> {
  if (!(await teamUser())) return notAllowed();
  const clean = {
    title: typeof edits?.title === "string" ? edits.title : undefined,
    body: typeof edits?.body === "string" ? edits.body : undefined,
    q: typeof edits?.q === "string" ? edits.q : undefined,
    a: typeof edits?.a === "string" ? edits.a : undefined
  };
  return finish(await saveContentDraft(String(id || ""), clean));
}

export async function approveContentAction(id: string): Promise<ActionResult> {
  const userId = await teamUser();
  if (!userId) return notAllowed();
  return finish(await approveContentRequest(String(id || ""), userId));
}

export async function rejectContentAction(id: string): Promise<ActionResult> {
  const userId = await teamUser();
  if (!userId) return notAllowed();
  return finish(await rejectContentRequest(String(id || ""), userId));
}

export async function markContentMadeAction(id: string): Promise<ActionResult> {
  const userId = await teamUser();
  if (!userId) return notAllowed();
  return finish(await markContentMade(String(id || ""), userId));
}
