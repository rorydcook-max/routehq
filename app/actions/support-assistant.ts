"use server";

import { after } from "next/server";
import { getLocale } from "next-intl/server";
import { logSupportQuestion } from "@/lib/content-requests";
import { startSupportThread } from "@/app/actions/support";
import { getCurrentMembership } from "@/lib/auth/roles";
import { said } from "@/lib/i18n/server-text";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { answerSupportQuestion, isContentRequest, type SupportAnswer, type SupportTurn } from "@/lib/support-assistant";

/** The reader's language, in English, for the model ("Thai"). */
async function readerLanguage() {
  try {
    const locale = await getLocale();
    return supportedLocaleOptions.find((option) => option.code === locale)?.english || "English";
  } catch {
    return "English";
  }
}

function cleanHistory(history: unknown): SupportTurn[] {
  return (Array.isArray(history) ? history : []).filter((turn): turn is SupportTurn => Boolean(turn) && (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string");
}

/**
 * "How do I…?" answered from the help centre. Open to every signed-in member, owner or teammate: it only ever
 * sees the help articles and the question, never the business's records.
 */
export async function askSupport(question: string, pathname?: string | null, history: SupportTurn[] = []): Promise<SupportAnswer> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  const page = typeof pathname === "string" ? pathname.slice(0, 200) : null;
  const result = await answerSupportQuestion({
    question,
    pathname: page,
    history: cleanHistory(history),
    language: await readerLanguage(),
    role: membership.role
  });
  // Every answered question is kept for the team's content queue (what people couldn't find, what they asked to be
  // written). It runs after the reply is sent, so a slow or failed write never holds up or breaks the answer.
  if (result.ok) {
    const asked = String(question || "").trim().slice(0, 500);
    const logged = {
      organizationId: membership.organizationId,
      userId: membership.userId,
      question: asked,
      pathname: page,
      articles: result.articles.map((article) => article.slug),
      handoff: result.handoff,
      request: result.request === true || isContentRequest(asked)
    };
    try {
      after(() => logSupportQuestion(logged));
    } catch {
      // after() is only unavailable outside a request; the answer matters more than the log.
    }
  }
  // The library speaks English; the reader may not.
  return result.ok ? result : { ok: false, error: await said(result.error) };
}

/**
 * Hands a question the assistant couldn't answer to the RoveHQ team, as an ordinary Help conversation. The
 * conversation so far goes in as the first message so the team can see what was already tried.
 */
export async function sendToTeam(input: { question: string; answer?: string; history?: SupportTurn[]; pathname?: string | null }): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: await said("Please sign in again.") };
  const question = String(input.question || "").trim().slice(0, 500);
  if (!question) return { ok: false, error: await said("Type a question first.") };

  const lines = cleanHistory(input.history).map((turn) => `${turn.role === "user" ? "You" : "Assistant"}: ${turn.content.trim().slice(0, 1500)}`);
  lines.push(`You: ${question}`);
  if (input.answer) lines.push(`Assistant: ${String(input.answer).trim().slice(0, 1500)}`);
  const page = typeof input.pathname === "string" && input.pathname.startsWith("/") ? input.pathname.slice(0, 200) : "";
  const body = `${lines.join("\n\n")}${page ? `\n\nPage: ${page}` : ""}`.slice(0, 8000);

  // Same path as the Help page's compose box, so the team sees it where every other message arrives.
  const data = new FormData();
  data.set("topic", "question");
  data.set("subject", question.split(/\n/).map((part) => part.trim()).find(Boolean)?.slice(0, 120) || question.slice(0, 120));
  data.set("body", body);
  return startSupportThread(data);
}
