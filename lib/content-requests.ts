import { readFileSync } from "node:fs";
import { join } from "node:path";
import { revalidatePath } from "next/cache";
import { aiTextConfigured, createChatCompletion } from "@/lib/ai-chat";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { DOC_CATEGORIES, DOCS_LOCALE, docExists, docMarkdown, listDocs, loadPublishedArticles, type DocCategory } from "@/lib/site/docs";
import { parseJson, pickArticles } from "@/lib/support-assistant";

/**
 * The help centre's content queue (Rory, 3 Nov 2026: "the assistant should collate and consider requests from users to
 * create new articles, FAQs, videos and support resources, though it should submit for approval before publishing").
 *
 * 1. Every question the support assistant answers is logged in support_questions (logSupportQuestion).
 * 2. collateContentRequests() groups the ones it couldn't answer, and the explicit "please write a guide for…" requests,
 *    into content_requests: one row per topic, with how many times it was asked.
 * 3. draftContentRequest() writes an article or FAQ draft in the help centre's voice. Videos and resources are not
 *    drafted: they stay as requests for the team to make.
 * 4. Nothing reaches /docs until a platform admin presses Approve (approveContentRequest), which writes help_articles;
 *    lib/site/docs.ts reads that table alongside the Markdown files.
 *
 * The tables have RLS on and no policies, so only the server (service role) touches them, and only platform admins
 * can reach the functions that change them (the actions in app/actions/content-requests.ts check). The model only ever
 * sees question text, the page path it was asked on, and the help centre itself: never a business's records or names.
 */

export const CONTENT_KINDS = ["article", "faq", "video", "resource"] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];
export const CONTENT_STATUSES = ["suggested", "drafted", "approved", "published", "rejected"] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export type ArticleDraft = {
  frontmatter: { title: string; description: string; category: DocCategory; order: number; appPath: string; related: string[]; updated: string; faq: { q: string; a: string }[] };
  body: string;
  /** Set once published: where it lives in the help centre. */
  slug?: string;
};
export type FaqDraft = { target_slug: string; q: string; a: string };

export type ContentRequest = {
  id: string;
  kind: ContentKind;
  title: string;
  summary: string;
  targetSlug: string | null;
  questionIds: string[];
  askCount: number;
  draft: ArticleDraft | FaqDraft | null;
  status: ContentStatus;
  decidedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
export type LoggedQuestion = { id: string; question: string; pathname: string | null; createdAt: string };

type Result<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: string };

// Grouping and writing are heavier than answering a question: the "smart" tier (see claudeModelFor in lib/ai-chat).
const MODEL = process.env.OPENAI_CONTENT_MODEL || "gpt-4o";
const LOOKBACK_DAYS = 60;
const MAX_QUESTIONS_PER_RUN = 150;
const OPEN: ContentStatus[] = ["suggested", "drafted"];
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const db = () => createSupabaseAdminClient() as any;
const str = (value: unknown) => (value === null || value === undefined ? "" : String(value).trim());

/** Today in Bangkok, where RoveHQ is run from, as YYYY-MM-DD for the article's "updated" date. */
function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function toRequest(row: any): ContentRequest {
  return {
    id: String(row.id),
    kind: (CONTENT_KINDS as readonly string[]).includes(row.kind) ? row.kind : "article",
    title: str(row.title),
    summary: str(row.summary),
    targetSlug: str(row.target_slug) || null,
    questionIds: Array.isArray(row.question_ids) ? row.question_ids.map(String) : [],
    askCount: Number(row.ask_count) || 0,
    draft: row.draft && typeof row.draft === "object" ? row.draft : null,
    status: (CONTENT_STATUSES as readonly string[]).includes(row.status) ? row.status : "suggested",
    decidedAt: row.decided_at || null,
    createdAt: String(row.created_at || ""),
    updatedAt: String(row.updated_at || row.created_at || "")
  };
}

/** Lowercased words for comparing titles, without the little joining words. */
function titleWords(text: string) {
  const skip = new Set(["the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "how", "your", "you", "with", "from", "into"]);
  return new Set(
    String(text || "")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]+/gu, " ")
      .split(/\s+/)
      .filter((word) => word.length > 1 && !skip.has(word))
  );
}

/** "Very similar" titles: most of their words are shared (so "Cancel a booking" and "Cancelling a booking" don't double up). */
function similarTitles(a: string, b: string) {
  const left = titleWords(a);
  const right = titleWords(b);
  if (!left.size || !right.size) return false;
  const stem = (word: string) => word.replace(/(ing|ed|es|s)$/, "");
  const leftStems = new Set([...left].map(stem));
  const rightStems = new Set([...right].map(stem));
  const shared = [...leftStems].filter((word) => rightStems.has(word)).length;
  return shared / new Set([...leftStems, ...rightStems]).size >= 0.6;
}

/**
 * Logs one question the support assistant answered. Called after the reply has been sent (see askSupport), and never
 * throws: losing a log line must not cost anyone their answer.
 */
export async function logSupportQuestion(input: { organizationId: string | null; userId: string | null; question: string; pathname: string | null; articles: string[]; handoff: boolean; request: boolean }) {
  try {
    const question = str(input.question).slice(0, 500);
    if (!question) return;
    const { error } = await db()
      .from("support_questions")
      .insert({
        organization_id: input.organizationId,
        user_id: input.userId,
        question,
        pathname: input.pathname && input.pathname.startsWith("/") ? input.pathname.slice(0, 200) : null,
        articles: (input.articles || []).filter((slug) => SLUG.test(slug)).slice(0, 5),
        handoff: Boolean(input.handoff),
        kind: input.request ? "request" : "question"
      });
    if (error) throw error;
  } catch (error) {
    console.warn("[content-requests] question not logged:", (error instanceof Error ? error.message : String(error)).slice(0, 200));
  }
}

export type CollateResult = Result<{ questions: number; created: number; merged: number }>;

/**
 * Groups new unanswered questions and content requests (last 60 days, not yet in any request) into topics with one
 * model call, then merges them into content_requests: a topic matching an open request (same kind and article, or a
 * very similar title) adds its questions to it; anything else becomes a new "suggested" request.
 */
export async function collateContentRequests(): Promise<CollateResult> {
  const admin = db();
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86_400_000).toISOString();
  const [{ data: rows, error }, { data: existingRows, error: existingError }] = await Promise.all([
    admin.from("support_questions").select("id, question, pathname, handoff, kind, created_at").gte("created_at", since).or("handoff.eq.true,kind.eq.request").order("created_at", { ascending: false }).limit(1000),
    admin.from("content_requests").select("id, kind, title, summary, target_slug, question_ids, ask_count, status, created_at, updated_at").order("created_at", { ascending: false }).limit(2000)
  ]);
  if (error || existingError) return { ok: false, error: "Couldn't read the questions." };

  const existing = ((existingRows || []) as any[]).map(toRequest);
  const used = new Set(existing.flatMap((request) => request.questionIds));
  const fresh = ((rows || []) as any[]).filter((row) => !used.has(String(row.id))).slice(0, MAX_QUESTIONS_PER_RUN);
  if (!fresh.length) return { ok: true, questions: 0, created: 0, merged: 0 };
  if (!aiTextConfigured()) return { ok: false, error: "The assistant isn't switched on for this account yet." };

  await loadPublishedArticles();
  const docs = listDocs(DOCS_LOCALE);
  const known = new Set(docs.map((doc) => doc.slug));
  const open = existing.filter((request) => OPEN.includes(request.status));
  // Short labels (q1, q2…) rather than ids: a model copies "q12" reliably, a 36-character id less so.
  const label = new Map(fresh.map((row, index) => [`q${index + 1}`, String(row.id)]));

  let topics: any[] = [];
  try {
    const completion = await createChatCompletion(
      {
        model: MODEL,
        max_tokens: 3000,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: [
              "You sort questions that people asked RoveHQ's in-app support assistant into requests for new help content. RoveHQ is an app for small vehicle rental businesses.",
              "Each question either couldn't be answered from the help centre, or asked for new help content.",
              "Group questions about the same need into one topic. For each topic choose a kind:",
              '- "article": a topic no existing article covers.',
              '- "faq": an existing article almost covers it and one extra question and answer would do. Give its target_slug.',
              '- "video": people struggle to follow an existing article, or ask for a video of it. Give its target_slug.',
              '- "resource": a template, checklist or form people want to download or print.',
              "Don't propose content an existing article already covers fully. Leave out questions that aren't about using RoveHQ (greetings, test messages, complaints about one booking).",
              "If a topic is the same as one of the open requests listed below, use exactly its kind, title and target_slug so they can be merged.",
              'title: short and task-like, as a help article title ("Cancel a booking"). summary: one line on what people need. British English.',
              'Reply as JSON: {"topics": [{"kind": "article"|"faq"|"video"|"resource", "title": string, "summary": string, "target_slug": string|null, "questions": ["q1", "q4"]}]}',
              `Existing articles (slug: title, description):\n${docs.map((doc) => `${doc.slug}: ${doc.title}. ${doc.description}`).join("\n")}`,
              open.length ? `Open requests:\n${open.map((request) => `${request.kind} | ${request.title} | ${request.targetSlug || "-"}`).join("\n")}` : "Open requests: none."
            ].join("\n")
          },
          {
            role: "user",
            content: fresh
              .map((row, index) => `q${index + 1} [${row.kind === "request" ? "asked for content" : "couldn't answer"}${row.pathname ? `, page ${String(row.pathname).slice(0, 80)}` : ""}]: ${str(row.question).slice(0, 300).replace(/\s+/g, " ")}`)
              .join("\n")
          }
        ]
      },
      { timeout: 90_000 }
    );
    const parsed = parseJson(String(completion.choices[0]?.message?.content || ""));
    topics = Array.isArray(parsed?.topics) ? parsed.topics : [];
  } catch (error) {
    console.warn("[content-requests] collate failed:", (error instanceof Error ? error.message : String(error)).slice(0, 300));
    return { ok: false, error: "Couldn't collate the questions just now. Try again in a moment." };
  }

  let created = 0;
  let merged = 0;
  const assigned = new Set<string>();
  const now = new Date().toISOString();
  for (const topic of topics) {
    // Each question goes in one topic only, and only questions we actually sent count.
    const ids = [...new Set((Array.isArray(topic?.questions) ? topic.questions : []).map((item: unknown) => label.get(str(item))).filter(Boolean) as string[])].filter((id) => !assigned.has(id));
    const title = str(topic?.title).slice(0, 140);
    if (!ids.length || !title) continue;
    let kind: ContentKind = (CONTENT_KINDS as readonly string[]).includes(str(topic?.kind)) ? (str(topic.kind) as ContentKind) : "article";
    let target: string | null = known.has(str(topic?.target_slug)) ? str(topic.target_slug) : null;
    // An FAQ needs an article to sit under; without a real one it is a new article. A new article has no target.
    if (kind === "faq" && !target) kind = "article";
    if (kind === "article") target = null;
    const summary = str(topic?.summary).slice(0, 300);
    ids.forEach((id) => assigned.add(id));

    const match = open.find((request) => request.kind === kind && ((target && request.targetSlug === target) || similarTitles(request.title, title)));
    if (match) {
      const questionIds = [...new Set([...match.questionIds, ...ids])];
      const { error: updateError } = await admin.from("content_requests").update({ question_ids: questionIds, ask_count: questionIds.length, updated_at: now }).eq("id", match.id);
      if (updateError) continue;
      match.questionIds = questionIds;
      match.askCount = questionIds.length;
      merged += 1;
    } else {
      const { data: inserted, error: insertError } = await admin
        .from("content_requests")
        .insert({ kind, title, summary, target_slug: target, question_ids: ids, ask_count: ids.length, status: "suggested" })
        .select("id, kind, title, summary, target_slug, question_ids, ask_count, status, created_at, updated_at")
        .single();
      if (insertError || !inserted) continue;
      open.push(toRequest(inserted));
      created += 1;
    }
  }
  return { ok: true, questions: assigned.size, created, merged };
}

let lastAutoRun = 0;

/**
 * Fills the queue without a cron job: when a platform admin opens /help/team, collate at most once a day. "Once a day"
 * is judged by the newest request's date (shared by every server) plus a per-server timer (so a day with nothing new
 * to suggest doesn't trigger a model call on every visit). Never throws.
 */
export async function maybeAutoCollate() {
  if (Date.now() - lastAutoRun < 86_400_000) return;
  lastAutoRun = Date.now();
  try {
    const { data } = await db().from("content_requests").select("created_at").order("created_at", { ascending: false }).limit(1);
    const newest = data?.[0]?.created_at ? new Date(data[0].created_at).getTime() : 0;
    if (Date.now() - newest < 86_400_000) return;
    await collateContentRequests();
  } catch (error) {
    console.warn("[content-requests] auto collate failed:", (error instanceof Error ? error.message : String(error)).slice(0, 200));
  }
}

let uiCache: Record<string, unknown> | null = null;

/** Every text value in a namespace of the UI strings, however deeply nested. */
function stringsIn(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value);
  else if (value && typeof value === "object") for (const item of Object.values(value)) stringsIn(item, out);
  return out;
}

/**
 * The app's real English button and screen names for the draft, so it doesn't invent them: the values (not keys) of
 * the 3 or 4 namespaces of locales/en/common.json whose names and keys best match the questions' words, ~6,000
 * characters at most. The website's own namespaces are left out: they describe RoveHQ, not its buttons.
 */
function uiStringsFor(text: string, limit = 6000) {
  try {
    uiCache ||= JSON.parse(readFileSync(join(process.cwd(), "locales", "en", "common.json"), "utf8").replace(/^﻿/, "")) as Record<string, unknown>;
  } catch {
    return "";
  }
  const skip = new Set(["marketing", "site", "translation", "errorPages", "gallery"]);
  const stems = [...new Set(String(text || "").toLowerCase().replace(/[^a-z\s]+/g, " ").split(/\s+/).filter((word) => word.length >= 4).map((word) => word.slice(0, 5)))];
  const scored = Object.entries(uiCache)
    .filter(([name, value]) => !skip.has(name) && value && typeof value === "object")
    .map(([name, value]) => {
      const lowerName = name.toLowerCase();
      const keys = Object.keys(value as object).map((key) => key.toLowerCase());
      let score = 0;
      for (const stem of stems) {
        if (lowerName.includes(stem)) score += 5;
        score += keys.filter((key) => key.startsWith(stem)).length;
      }
      return { name, value, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
  const chosen = scored.length ? scored : [{ name: "shell", value: uiCache.shell }, { name: "nav", value: uiCache.nav }];
  const share = Math.floor(limit / chosen.length);
  return chosen
    .map((entry) => {
      const values = [...new Set(stringsIn(entry.value).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))];
      let block = "";
      for (const item of values) {
        if (block.length + item.length + 3 > share) break;
        block += `${block ? " | " : ""}${item}`;
      }
      return `[${entry.name}]\n${block}`;
    })
    .join("\n\n");
}

async function loadRequest(id: string): Promise<ContentRequest | null> {
  if (!/^[0-9a-f-]{36}$/i.test(String(id || ""))) return null;
  const { data } = await db().from("content_requests").select("*").eq("id", id).maybeSingle();
  return data ? toRequest(data) : null;
}

async function loadQuestions(ids: string[]): Promise<LoggedQuestion[]> {
  if (!ids.length) return [];
  const found: LoggedQuestion[] = [];
  // In slices: a long id list in one URL can be too long for the API.
  for (let start = 0; start < ids.length; start += 100) {
    const { data } = await db().from("support_questions").select("id, question, pathname, created_at").in("id", ids.slice(start, start + 100));
    for (const row of (data || []) as any[]) found.push({ id: String(row.id), question: str(row.question), pathname: str(row.pathname) || null, createdAt: String(row.created_at || "") });
  }
  return found.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Writes a first draft for an article or FAQ request, in the help centre's voice, and marks it "drafted". Given the
 * request, its questions, the closest three existing articles (for style and facts) and the matching UI strings (for
 * real button names). Anything it isn't sure of is marked [check] for the team.
 */
export async function draftContentRequest(id: string): Promise<Result> {
  const request = await loadRequest(id);
  if (!request) return { ok: false, error: "Couldn't find that request." };
  if (request.kind !== "article" && request.kind !== "faq") return { ok: false, error: "Only articles and FAQs get a written draft." };
  if (!OPEN.includes(request.status)) return { ok: false, error: "That request has already been decided." };
  if (!aiTextConfigured()) return { ok: false, error: "The assistant isn't switched on for this account yet." };

  await loadPublishedArticles();
  const questions = (await loadQuestions(request.questionIds)).slice(0, 30);
  const searchText = [request.title, request.summary, ...questions.map((item) => item.question)].join(" ");
  const pages = questions.map((item) => item.pathname).filter(Boolean) as string[];
  const commonPage = pages.sort((a, b) => pages.filter((p) => p === b).length - pages.filter((p) => p === a).length)[0] || null;
  let references = pickArticles(searchText, commonPage, DOCS_LOCALE);
  // An FAQ is written for one article: that one always comes first, in full (up to a sensible length).
  if (request.kind === "faq" && request.targetSlug && docExists(request.targetSlug)) {
    const target = listDocs(DOCS_LOCALE).find((doc) => doc.slug === request.targetSlug);
    const body = (docMarkdown(DOCS_LOCALE, request.targetSlug) || "").slice(0, 6000);
    if (target) references = [{ slug: target.slug, title: target.title, description: target.description, body, video: target.video, poster: target.poster }, ...references.filter((item) => item.slug !== target.slug)].slice(0, 3);
  }
  const existing = listDocs(DOCS_LOCALE).map((doc) => doc.slug);
  const ui = uiStringsFor(searchText);

  const rules = [
    "You write RoveHQ's help centre. RoveHQ is an app for small vehicle rental businesses; readers are owners and staff, often on a phone.",
    "Rules: as short as possible. Written like a real person talking: no fluff, no marketing, no \"In this article\". Numbered steps, with button, tab and field names in **bold**, spelled exactly as in the UI strings. British English. Match the style of the example articles.",
    "Only describe what the example articles or the UI strings show exists. Write [check] straight after anything you aren't sure exists or works that way."
  ];
  const reply =
    request.kind === "article"
      ? `Reply as JSON: {"title": string (short, task-like, like the examples), "description": string (one sentence, for search results), "category": one of ${JSON.stringify(DOC_CATEGORIES)}, "appPath": the app screen it is about (like "/bookings") or "", "related": [up to 4 slugs of existing articles], "body": Markdown, no top-level heading, ## headings only for separate tasks}`
      : `Write one extra common question and answer for the article "${request.targetSlug}". Reply as JSON: {"q": string (as a reader would ask it), "a": string (one to three sentences; **bold** for button names)}`;
  const user = [
    `Request (${request.kind}): ${request.title}\n${request.summary}`,
    `What people asked:\n${questions.map((item) => `- ${item.question.replace(/\s+/g, " ").slice(0, 300)}${item.pathname ? ` (on ${item.pathname})` : ""}`).join("\n") || "- (no questions kept)"}`,
    `Example articles:\n${references.map((item) => `--- slug: ${item.slug}\ntitle: ${item.title}\n${item.description}\n\n${item.body}`).join("\n\n") || "(none close)"}`,
    `UI strings (the app's real English text):\n${ui || "(not available)"}`,
    request.kind === "article" ? `Existing article slugs: ${existing.join(", ")}` : ""
  ]
    .filter(Boolean)
    .join("\n\n");

  let parsed: any;
  try {
    const completion = await createChatCompletion(
      {
        model: MODEL,
        max_tokens: request.kind === "article" ? 2500 : 600,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: [...rules, reply].join("\n") },
          { role: "user", content: user }
        ]
      },
      { timeout: 90_000 }
    );
    parsed = parseJson(String(completion.choices[0]?.message?.content || ""));
  } catch (error) {
    console.warn("[content-requests] draft failed:", (error instanceof Error ? error.message : String(error)).slice(0, 300));
    return { ok: false, error: "Couldn't write a draft just now. Try again in a moment." };
  }

  let draft: ArticleDraft | FaqDraft;
  if (request.kind === "article") {
    const body = str(parsed?.body);
    const title = str(parsed?.title) || request.title;
    if (!body) return { ok: false, error: "Couldn't write a draft just now. Try again in a moment." };
    draft = {
      frontmatter: {
        title: title.slice(0, 120),
        description: str(parsed?.description).slice(0, 300),
        category: (DOC_CATEGORIES as readonly string[]).includes(str(parsed?.category)) ? (str(parsed.category) as DocCategory) : "getting-started",
        order: 99,
        appPath: str(parsed?.appPath).startsWith("/") ? str(parsed.appPath).slice(0, 120) : "",
        related: (Array.isArray(parsed?.related) ? parsed.related : []).map(str).filter((slug: string) => existing.includes(slug)).slice(0, 4),
        updated: today(),
        faq: []
      },
      body
    };
  } else {
    const q = str(parsed?.q);
    const a = str(parsed?.a);
    if (!q || !a || !request.targetSlug) return { ok: false, error: "Couldn't write a draft just now. Try again in a moment." };
    draft = { target_slug: request.targetSlug, q: q.slice(0, 300), a: a.slice(0, 1500) };
  }
  const { error } = await db().from("content_requests").update({ draft, status: "drafted", updated_at: new Date().toISOString() }).eq("id", request.id);
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true };
}

/** The team's edits to a draft before approving it: the title and Markdown of an article, or an FAQ's question and answer. */
export async function saveContentDraft(id: string, edits: { title?: string; body?: string; q?: string; a?: string }): Promise<Result> {
  const request = await loadRequest(id);
  if (!request) return { ok: false, error: "Couldn't find that request." };
  if (request.status !== "drafted" || !request.draft) return { ok: false, error: "Write a draft first." };
  let draft: ArticleDraft | FaqDraft;
  if (request.kind === "article") {
    const current = request.draft as ArticleDraft;
    const title = str(edits.title) || current.frontmatter.title;
    const body = typeof edits.body === "string" && edits.body.trim() ? edits.body.replace(/\r\n/g, "\n").trim().slice(0, 30000) : current.body;
    draft = { ...current, frontmatter: { ...current.frontmatter, title: title.slice(0, 120) }, body };
  } else {
    const current = request.draft as FaqDraft;
    draft = { ...current, q: (str(edits.q) || current.q).slice(0, 300), a: (str(edits.a) || current.a).slice(0, 1500) };
  }
  const { error } = await db().from("content_requests").update({ draft, updated_at: new Date().toISOString() }).eq("id", request.id);
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true };
}

/** A title as a web address: "Cancel a booking" → "cancel-a-booking". */
function kebab(title: string) {
  return (
    String(title || "")
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "article"
  );
}

/** A slug no file and no published row already uses: "cancel-a-booking", else "cancel-a-booking-2", and so on. */
async function uniqueSlug(title: string) {
  const base = kebab(title);
  const { data } = await db().from("help_articles").select("slug").like("slug", `${base}%`).limit(200);
  const taken = new Set(((data || []) as any[]).map((row) => String(row.slug)));
  for (let n = 1; n < 500; n += 1) {
    const slug = n === 1 ? base : `${base}-${n}`;
    if (!taken.has(slug) && !docExists(slug)) return slug;
  }
  return `${base}-${Date.now()}`;
}

/** After anything is published: this server sees it straight away, and the help centre's pages are rebuilt. */
async function refreshHelpCentre(slug: string | null) {
  await loadPublishedArticles(true);
  try {
    revalidatePath("/docs");
    if (slug) revalidatePath(`/docs/${slug}`);
    revalidatePath("/help");
    revalidatePath("/sitemap.xml");
  } catch {
    // Outside a request (a script) there is nothing to revalidate.
  }
}

/**
 * The Approve click, the only way anything reaches the help centre:
 * - an article draft becomes a help_articles row (its slug from the title, unique against files and rows);
 * - an FAQ draft is added to its article's extra questions (a help_articles row with frontmatter {} and body '' holds
 *   them for a file article; a published article's own row takes them directly);
 * - a video or resource request moves to "approved", meaning it is on the team's to-make list.
 */
export async function approveContentRequest(id: string, userId: string): Promise<Result<{ slug: string | null }>> {
  const request = await loadRequest(id);
  if (!request) return { ok: false, error: "Couldn't find that request." };
  const admin = db();
  const now = new Date().toISOString();
  const decided = { decided_by: userId, decided_at: now, updated_at: now };

  if (request.kind === "video" || request.kind === "resource") {
    if (request.status !== "suggested") return { ok: false, error: "That request has already been decided." };
    const { error } = await admin.from("content_requests").update({ status: "approved", ...decided }).eq("id", request.id);
    return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true, slug: null };
  }

  if (request.status !== "drafted" || !request.draft) return { ok: false, error: "Write a draft first." };
  await loadPublishedArticles(true);

  if (request.kind === "article") {
    const draft = request.draft as ArticleDraft;
    if (!str(draft.frontmatter?.title) || !str(draft.body)) return { ok: false, error: "Write a draft first." };
    const slug = await uniqueSlug(draft.frontmatter.title);
    const frontmatter = { ...draft.frontmatter, updated: today() };
    const { error } = await admin.from("help_articles").upsert({ slug, locale: DOCS_LOCALE, frontmatter, body: draft.body, published_at: now, request_id: request.id, updated_at: now }, { onConflict: "slug" });
    if (error) return { ok: false, error: "Couldn't save that. Try again." };
    await admin.from("content_requests").update({ status: "published", draft: { ...draft, frontmatter, slug }, ...decided }).eq("id", request.id);
    await refreshHelpCentre(slug);
    return { ok: true, slug };
  }

  const draft = request.draft as FaqDraft;
  const slug = str(draft.target_slug);
  if (!SLUG.test(slug) || !docExists(slug)) return { ok: false, error: "The article this FAQ belongs to no longer exists." };
  if (!str(draft.q) || !str(draft.a)) return { ok: false, error: "Write a draft first." };
  const item = { q: str(draft.q), a: str(draft.a) };
  const { data: row } = await admin.from("help_articles").select("slug, extra_faq").eq("slug", slug).maybeSingle();
  const { error } = row
    ? await admin
        .from("help_articles")
        .update({ extra_faq: [...(Array.isArray(row.extra_faq) ? row.extra_faq : []), item], updated_at: now })
        .eq("slug", slug)
    : await admin.from("help_articles").insert({ slug, locale: DOCS_LOCALE, frontmatter: {}, body: "", extra_faq: [item], published_at: now, request_id: request.id, updated_at: now });
  if (error) return { ok: false, error: "Couldn't save that. Try again." };
  await admin.from("content_requests").update({ status: "published", ...decided }).eq("id", request.id);
  await refreshHelpCentre(slug);
  return { ok: true, slug };
}

/** "Not doing this one": any request still open or on the to-make list. */
export async function rejectContentRequest(id: string, userId: string): Promise<Result> {
  const request = await loadRequest(id);
  if (!request) return { ok: false, error: "Couldn't find that request." };
  if (!["suggested", "drafted", "approved"].includes(request.status)) return { ok: false, error: "That request has already been decided." };
  const now = new Date().toISOString();
  const { error } = await db().from("content_requests").update({ status: "rejected", decided_by: userId, decided_at: now, updated_at: now }).eq("id", request.id);
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true };
}

/** A video or resource on the to-make list has been made (and added to the help centre by hand). */
export async function markContentMade(id: string, userId: string): Promise<Result> {
  const request = await loadRequest(id);
  if (!request) return { ok: false, error: "Couldn't find that request." };
  if ((request.kind !== "video" && request.kind !== "resource") || request.status !== "approved") return { ok: false, error: "That request has already been decided." };
  const now = new Date().toISOString();
  const { error } = await db().from("content_requests").update({ status: "published", decided_by: userId, decided_at: now, updated_at: now }).eq("id", request.id);
  return error ? { ok: false, error: "Couldn't save that. Try again." } : { ok: true };
}

/** Requests waiting for the team (suggested or drafted), for the link on /help/team. */
export async function countOpenContentRequests() {
  try {
    const { count } = await db().from("content_requests").select("id", { count: "exact", head: true }).in("status", OPEN);
    return count || 0;
  } catch {
    return 0;
  }
}

/** Everything for the team page: the requests (newest activity first) and the questions behind them. */
export async function listContentRequestsForTeam(): Promise<{ requests: ContentRequest[]; questions: Record<string, LoggedQuestion> }> {
  const { data } = await db().from("content_requests").select("*").order("updated_at", { ascending: false }).limit(300);
  const requests = ((data || []) as any[]).map(toRequest);
  const ids = [...new Set(requests.flatMap((request) => request.questionIds.slice(0, 50)))];
  const questions: Record<string, LoggedQuestion> = {};
  for (const question of await loadQuestions(ids)) questions[question.id] = question;
  return { requests, questions };
}
