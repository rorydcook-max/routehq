import { aiTextConfigured, createChatCompletion } from "@/lib/ai-chat";
import { BUSINESS_INCLUDED, PLANS, TRIAL_DAYS, YEARLY_MONTHS } from "@/lib/plans";
import { docForAppPath, docMarkdown, listDocs, loadPublishedArticles, publishedVersion, DOCS_LOCALE } from "@/lib/site/docs";

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
/** `video`/`poster` are set when the article has a screen recording, so the chat can play it right there. */
export type SupportArticle = { slug: string; title: string; href: string; video?: string | null; poster?: string | null };
/** `request` is true when the message asked for new help content (a guide, video…): it is logged for the team's content queue. */
export type SupportAnswer = { ok: true; answer: string; articles: SupportArticle[]; handoff: boolean; kind: "support"; request?: boolean } | { ok: false; error: string };

/** Words worth matching on: lowercased, punctuation off, the little joining words dropped. */
const STOP = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "my", "me", "i", "it", "is", "do", "does", "can", "how", "what", "where", "why", "when", "with", "from", "at", "this", "that", "be", "are", "you", "your"]);

/**
 * The words people use for things the articles name differently ("I sold a car" is **Archive vehicle**). Each
 * everyday word also searches for the app's word, so the right article is found.
 */
const SYNONYMS: Record<string, string[]> = {
  sell: ["archive"], sold: ["archive"], selling: ["archive"], retire: ["archive"], retired: ["archive"], remove: ["archive", "delete"], scrap: ["archive"], hide: ["archive"],
  contract: ["agreement"], contracts: ["agreement"], sign: ["agreement", "signature"], signing: ["agreement", "signature"],
  staff: ["team", "teammate"], employee: ["team", "teammate"], employees: ["team", "teammate"], worker: ["team"],
  refund: ["deposit", "refunds"], bond: ["deposit"], ticket: ["fine"], tickets: ["fine"], penalty: ["fine"],
  car: ["vehicle"], cars: ["vehicle"], bike: ["vehicle"], scooter: ["vehicle"], motorbike: ["vehicle"],
  pickup: ["handover"], delivery: ["handover"], collect: ["handover"], return: ["return"], inspection: ["handover", "inspection"],
  invoice: ["receipt"], invoices: ["receipt"], bill: ["charge"], expense: ["cost"], expenses: ["cost"],
  plate: ["registration"], tax: ["tax", "paperwork"], insurance: ["insurance", "paperwork"], renew: ["renewal", "paperwork"],
  website: ["booking", "page"], online: ["booking", "page"], reminder: ["reminders"], whatsapp: ["messaging", "inbox"], line: ["messaging", "inbox"]
};

function words(text: string) {
  const base = String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP.has(word));
  return base.flatMap((word) => [word, ...(SYNONYMS[word] || [])]);
}

/**
 * Picks the articles most likely to answer the question by counting how many of its words appear in each
 * article's title, description, FAQ and body. Title and description hits count for more. The article for the
 * screen the reader is on always comes along, since "this page" is usually what they mean.
 */
type Indexed = { doc: ReturnType<typeof listDocs>[number]; body: string; inTitle: Set<string>; inFaq: Set<string>; inBody: Set<string> };
const indexCache = new Map<string, Indexed[]>();

/**
 * The articles' words, read once per process: 45 files per question would be wasteful. Keyed on the published
 * articles' version too, so an article or FAQ approved from the content queue is picked up without a restart.
 */
function articleIndex(locale: string): Indexed[] {
  const key = `${locale}:${publishedVersion()}`;
  const cached = indexCache.get(key);
  if (cached) return cached;
  for (const old of indexCache.keys()) if (old.startsWith(`${locale}:`)) indexCache.delete(old);
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
  indexCache.set(key, built);
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
    return { slug: entry.doc.slug, title: entry.doc.title, description: entry.doc.description, body, video: entry.doc.video, poster: entry.doc.poster };
  });
}

/** "How much does it cost?", "is there a free plan?": the pricing page, not an article, has the answer. */
const PRICE_WORDS = /\b(cost|costs|price|prices|pricing|plan|plans|pay|paying|free|trial|subscription|subscribe|month|monthly|yearly|expensive|cheap|afford)\b|ราคา|แพลน|ฟรี|ค่าใช้จ่าย|ทดลอง/i;
const PRICING_SLUG = "pricing";

/** The plans as one short article, built from lib/plans so it can't drift from the pricing page. */
function pricingArticle() {
  const count = (value: number | null) => (value === null ? "unlimited" : String(value));
  const lines = PLANS.map((plan) => {
    const name = plan.id[0].toUpperCase() + plan.id.slice(1);
    const price = plan.monthly ? `฿${plan.monthly.toLocaleString("en-US")} a month` : "free";
    const fleet = plan.cars === null ? `up to ${BUSINESS_INCLUDED.cars} cars and ${BUSINESS_INCLUDED.motorbikes} motorbikes included, then ฿${plan.extraCar} a month per extra car and ฿${plan.extraMotorbike} per extra motorbike` : `up to ${plan.cars} cars and ${plan.motorbikes} motorbikes`;
    const extras = [plan.team === null ? "unlimited team logins" : `${count(plan.team)} team login${plan.team === 1 ? "" : "s"}`, plan.whiteLabel ? "your own branding" : "", plan.customDomain ? "booking page on your own domain" : "", plan.setupService ? "import and setup done for you on the yearly plan" : "", plan.prioritySupport ? "priority support" : ""].filter(Boolean).join(", ");
    return `- **${name}**: ${price}, ${fleet}; ${extras}.`;
  });
  return {
    slug: PRICING_SLUG,
    title: "Plans and pricing",
    description: "What RoveHQ costs: priced by fleet size, every feature on every plan.",
    body: [`Prices are in Thai baht. Every plan starts with ${TRIAL_DAYS} days of everything, free. Every feature is included on every plan: the plans differ by fleet size and team size. Yearly costs ${YEARLY_MONTHS} months, so one month is free.`, ...lines, "The pricing page has the full comparison and other currencies."].join("\n"),
    video: null,
    poster: null
  };
}

/**
 * Whether a message asks for new help content rather than (or as well as) asking how to do something: "there should
 * be a guide for…", "can you add a video", "please write…", "I wish there was…", and the Thai "อยากให้มี" (I'd like
 * there to be), "ขอวิดีโอ" (a video please), "ขอคู่มือ" (a guide please). These go to the team's content queue.
 */
const CONTENT_WORDS = "(guide|article|video|tutorial|faq|help page|page|doc|docs|walkthrough|template|checklist|explanation|instructions)";
const CONTENT_REQUEST_PATTERNS = [
  new RegExp(`\\bthere (should|needs to|ought to) be (an? |some )?(\\w+ ){0,3}${CONTENT_WORDS}`, "i"),
  new RegExp(`\\b(can|could|would|will) you (please )?(add|make|write|create|record|do|put up) (an? |some )?(\\w+ ){0,3}${CONTENT_WORDS}`, "i"),
  new RegExp(`\\bplease (add|make|write|create|record) (an? |some )?(\\w+ ){0,3}${CONTENT_WORDS}`, "i"),
  /\bplease write\b/i,
  /\bi wish there (was|were|is)\b/i,
  new RegExp(`\\b(need|want|would like|request|requesting) (an? |some )?(\\w+ ){0,2}(video|tutorial|guide|walkthrough|template|checklist) (on|for|about|of|showing|explaining)\\b`, "i"),
  new RegExp(`\\bis there (an? |any )?${CONTENT_WORDS} (on|for|about)\\b.*\\?\\s*if not`, "i"),
  /อยากให้มี/,
  /ขอวิดีโอ|ขอวีดีโอ|ขอคลิป/,
  /ขอคู่มือ/
];

export function isContentRequest(text: string) {
  const value = String(text || "");
  return CONTENT_REQUEST_PATTERNS.some((pattern) => pattern.test(value));
}

/** Gemini sometimes wraps JSON in ``` fences or a sentence; the first whole object inside is taken. Also used by lib/content-requests.ts. */
export function parseJson(content: string): any {
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
  const askedForContent = isContentRequest(asked);

  let articles: ReturnType<typeof pickArticles>;
  // Articles approved from the content queue are in the database; refreshed (at most once a minute) before picking.
  await loadPublishedArticles();
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
  // Pricing isn't an article: when the question is about cost or plans, the plans come along too.
  if (PRICE_WORDS.test(asked)) articles = [...articles.slice(0, MAX_ARTICLES - 1), pricingArticle()];

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
            `Answer ONLY from the help articles below. Answer in ${language}.`,
            "Tone: friendly and personable but professional, like a helpful colleague. Direct and instructional. No padding: no restating the question, no \"follow these steps\", no closing summary, no \"let me know if\", no sign-off.",
            "Length: at most 60 words of prose. If there are steps, one short lead-in line (or none) then the steps, at most 6, each one action. Mention a detail only if the reader needs it to finish the task.",
            'Write steps as lines starting with "• ". Keep button, tab and field names in **bold**, spelled exactly as the articles spell them.',
            "Articles marked (has video) have a screen recording that the reader will see under your answer; don't describe or link it yourself.",
            input.role && input.role !== "owner" ? "The reader is a teammate, not the owner: if an article says something is for the owner only, say so." : "",
            "If the articles don't cover the question, say so in one sentence and offer to send it to the RoveHQ team. Never invent a feature, button or setting that the articles don't mention.",
            // Requests for new help content are collected for the RoveHQ team's content queue (/help/team/content).
            `If the message asks for new help content (a guide, article, video, FAQ, template or checklist), answer anything the articles do cover, then end with "Thanks, I've passed that on to the team." (in ${language}), and set "request" to true. A request for new content on its own is not a handoff.`,
            askedForContent ? "This message is a request for new help content." : "",
            'Reply as JSON: {"answer": string, "articles": [slugs of the articles you actually used], "handoff": boolean, "request": boolean}. "handoff" is true when the articles could not answer the question.',
            articles.length ? `Help articles:\n${articles.map((article) => `--- slug: ${article.slug}\ntitle: ${article.title}${article.video ? " (has video)" : ""}\n${article.description}\n\n${article.body}`).join("\n\n")}` : "Help articles: none matched this question."
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
    const shown = (linked.length ? linked : articles.slice(0, 1)).map((article) => ({ slug: article.slug, title: article.title, href: article.slug === PRICING_SLUG ? "/pricing" : `/docs/${article.slug}`, video: article.video, poster: article.poster }));
    const request = parsed.request === true || askedForContent;
    // A content request has already been "passed on" in the answer: no second offer to send it to the team.
    const handoff = request ? parsed.handoff === true : parsed.handoff === true || !articles.length;
    return { ok: true, kind: "support", answer, articles: parsed.handoff === true ? [] : shown, handoff, request };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    console.warn("[support-assistant] failed:", why.slice(0, 300));
    if (/no credits|insufficient_quota|exceeded your current quota|billing/i.test(why)) {
      return { ok: false, error: "The assistant's AI service is out of credit, so it can't answer right now. Everything else in RoveHQ works as normal." };
    }
    return { ok: false, error: "Couldn't reach the assistant just now. Try again in a moment." };
  }
}
