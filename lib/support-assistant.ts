import { aiTextConfigured, createChatCompletion } from "@/lib/ai-chat";
import { docForAppPath, docMarkdown, listDocs, DOCS_LOCALE } from "@/lib/site/docs";

/**
 * The support assistant: answers "how do I…" questions about using RoveHQ from the help centre's articles
 * (content/docs). It is deliberately given nothing but the articles and the question, so it can never see a
 * business's records, let alone another business's. Any member of a business may use it; the records assistant
 * in lib/ask.ts stays owner-only.
 */

// A light model is plenty: the answer is lifted from a handful of short articles.
const MODEL = process.env.OPENAI_SUPPORT_MODEL || "gpt-4o-mini";
const MAX_ARTICLES = 3;
const MAX_ARTICLE_CHARS = 9000;

export type SupportTurn = { role: "user" | "assistant"; content: string };
export type SupportArticle = { slug: string; title: string; href: string };
export type SupportAnswer = { ok: true; answer: string; articles: SupportArticle[]; handoff: boolean; kind: "support" } | { ok: false; error: string };

/** Words worth matching on: lowercased, punctuation off, the little joining words dropped. */
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "my", "me", "i", "it", "is", "do", "does", "can", "how", "what", "where", "why", "when", "with", "from", "at", "this", "that", "be", "are", "you", "your"]);

function words(text: string) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP.has(word));
}

/**
 * Picks the articles most likely to answer the question by counting how many of its words appear in each
 * article's title, description, FAQ and body. Title and description hits count for more. The article for the
 * screen the reader is on always comes along, since "this page" is usually what they mean.
 */
type Indexed = { doc: ReturnType<typeof listDocs>[number]; body: string; inTitle: Set<string>; inFaq: Set<string>; inBody: Set<string> };
const indexCache = new Map<string, Indexed[]>();

/** The articles' words, read once per process: 45 files per question would be wasteful. */
function articleIndex(locale: string): Indexed[] {
  const cached = indexCache.get(locale);
  if (cached) return cached;
  const built = listDocs(locale).map((doc) => {
    const body = docMarkdown(locale, doc.slug) || "";
    return {
      doc,
      body,
      inTitle: new Set(words(`${doc.title} ${doc.description}`)),
      inFaq: new Set(words(doc.faq.map((item) => `${item.q} ${item.a}`).join(" "))),
      inBody: new Set(words(body))
    };
  });
  indexCache.set(locale, built);
  return built;
}

export function pickArticles(question: string, pathname: string | null | undefined, locale = DOCS_LOCALE) {
  const asked = [...new Set(words(question))];
  const scored = articleIndex(locale).map((entry) => {
    let score = 0;
    for (const word of asked) {
      if (entry.inTitle.has(word)) score += 4;
      if (entry.inFaq.has(word)) score += 2;
      if (entry.inBody.has(word)) score += 1;
    }
    return { doc: entry.doc, body: entry.body, score };
  });

  const onThisScreen = pathname ? docForAppPath(pathname, locale) : null;
  const chosen = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_ARTICLES);
  if (onThisScreen && !chosen.some((entry) => entry.doc.slug === onThisScreen.slug)) {
    const current = scored.find((entry) => entry.doc.slug === onThisScreen.slug);
    if (current) chosen.splice(Math.min(chosen.length, MAX_ARTICLES - 1), 1, current);
  }

  // Keep the prompt small: the bodies are trimmed so the three together stay under the cap.
  let room = MAX_ARTICLE_CHARS;
  return chosen.slice(0, MAX_ARTICLES).map((entry, index, all) => {
    const share = Math.floor(room / (all.length - index));
    const body = entry.body.length > share ? `${entry.body.slice(0, share).replace(/\s+\S*$/, "")}\n…` : entry.body;
    room -= body.length;
    return { slug: entry.doc.slug, title: entry.doc.title, description: entry.doc.description, body };
  });
}

/** Gemini sometimes wraps JSON in ``` fences or a sentence; the first whole object inside is taken. */
function parseJson(content: string): any {
  const text = String(content || "").trim();
  try {
    return JSON.parse(text.replace(/^```(?:json)?\s*|\s*```$/g, "") || "{}");
  } catch {
    const inner = text.match(/\{[\s\S]*\}/)?.[0];
    try {
      return inner ? JSON.parse(inner) : { answer: text };
    } catch {
      return { answer: text };
    }
  }
}

export async function answerSupportQuestion(input: { question: string; pathname?: string | null; history?: SupportTurn[]; language?: string; role?: string | null }): Promise<SupportAnswer> {
  const asked = String(input.question || "").trim().slice(0, 500);
  if (asked.length < 3) return { ok: false, error: "Type a question first." };
  if (!aiTextConfigured()) return { ok: false, error: "The assistant isn't switched on for this account yet." };
  const language = input.language || "English";
  const history = (input.history || []).slice(-6);

  let articles: ReturnType<typeof pickArticles>;
  try {
    // The articles are English. A question in Thai (or any script without spaces between words) matches
    // nothing by itself, so it is first turned into a few English search words. One small, quick call.
    let searchText = asked;
    if (words(asked).length < 2 && /[^\x00-\x7F]/.test(asked)) {
      try {
        const keywords = await createChatCompletion(
          {
            model: MODEL,
            max_tokens: 40,
            temperature: 0,
            messages: [
              { role: "system", content: "Translate the question into 3 to 6 English search words about using a vehicle rental app (for example: deposit return refund). Reply with the words only." },
              { role: "user", content: asked }
            ]
          },
          { timeout: 8000 }
        );
        searchText = `${asked} ${String(keywords.choices[0]?.message?.content || "")}`;
      } catch {
        // The on-screen article still comes along below.
      }
    }
    articles = pickArticles(searchText, input.pathname);
  } catch {
    articles = [];
  }

  try {
    const completion = await createChatCompletion({
      model: MODEL,
      max_tokens: 500,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You are RoveHQ's support assistant. RoveHQ is an app for small vehicle rental businesses; the people asking are owners and staff, often on a phone.",
            `Answer ONLY from the help articles below. Answer in ${language}. Be short, plain and friendly: a sentence or two, then steps if there are steps.`,
            'Write steps as lines starting with "• ". Keep button, tab and field names in **bold**, spelled exactly as the articles spell them.',
            input.role && input.role !== "owner" ? "The reader is a teammate, not the owner: if an article says something is for the owner only, say so." : "",
            "If the articles don't cover the question, say so in one sentence and offer to send it to the RoveHQ team. Never invent a feature, button or setting that the articles don't mention.",
            'Reply as JSON: {"answer": string, "articles": [slugs of the articles you actually used], "handoff": boolean}. "handoff" is true when the articles could not answer the question.',
            articles.length ? `Help articles:\n${articles.map((article) => `--- slug: ${article.slug}\ntitle: ${article.title}\n${article.description}\n\n${article.body}`).join("\n\n")}` : "Help articles: none matched this question."
          ]
            .filter(Boolean)
            .join("\n")
        },
        ...history.map((turn) => ({ role: turn.role, content: String(turn.content || "").slice(0, 1500) })),
        { role: "user", content: asked }
      ]
    });

    const parsed = parseJson(String(completion.choices[0]?.message?.content || ""));
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    if (!answer) return { ok: false, error: "Couldn't work out an answer to that. Try asking it another way." };

    // Only articles that were really given to the model are linked, whatever it says it used.
    const used = new Set((Array.isArray(parsed.articles) ? parsed.articles : []).map((slug: unknown) => String(slug)));
    const linked = articles.filter((article) => used.has(article.slug));
    const shown = (linked.length ? linked : articles.slice(0, 1)).map((article) => ({ slug: article.slug, title: article.title, href: `/docs/${article.slug}` }));
    return { ok: true, kind: "support", answer, articles: parsed.handoff === true ? [] : shown, handoff: parsed.handoff === true || !articles.length };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    console.warn("[support-assistant] failed:", why.slice(0, 300));
    if (/no credits|insufficient_quota|exceeded your current quota|billing/i.test(why)) {
      return { ok: false, error: "The assistant's AI service is out of credit, so it can't answer right now. Everything else in RoveHQ works as normal." };
    }
    return { ok: false, error: "Couldn't reach the assistant just now. Try again in a moment." };
  }
}
