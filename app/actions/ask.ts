"use server";

import { getLocale } from "next-intl/server";
import { answerQuestion, type AskAnswer } from "@/lib/ask";
import { getCurrentMembership } from "@/lib/auth/roles";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

/** "Ask RouteHQ": a question about the signed-in person's own business, answered from its records. */
export async function askRouteHq(question: string): Promise<AskAnswer> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Please sign in again." };
  // Money questions are the owner's business; teammates handle day-to-day work.
  if (membership.role !== "owner") return { ok: false, error: "Only the business owner can ask about the business's figures." };

  let language = "English";
  try {
    const locale = await getLocale();
    language = supportedLocaleOptions.find((option) => option.code === locale)?.english || "English";
  } catch {
    // English is fine.
  }
  return answerQuestion(question, language);
}
