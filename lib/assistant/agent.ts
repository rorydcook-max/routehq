import { aiTextConfigured, createChatCompletion } from "@/lib/ai-chat";
import type { AskTurn } from "@/lib/ask";
import { businessTimeZone, businessToday } from "@/lib/business-time";
import { businessDistanceUnit } from "@/lib/business-units";
import { toolsForRole, type AssistantRole, type ToolName } from "@/lib/assistant/permissions";
import { runTool, toolSpecs, type Outcome, type ToolContext } from "@/lib/assistant/tools";
import type { ChatMeta } from "@/lib/chat";
import type { ChatFileKind } from "@/lib/chat-suggestions";
import type { SupportAttachment } from "@/lib/support";

/**
 * The one RoveHQ assistant (Rory, 3 Nov 2026: "We should really just have the one same assistant everywhere with full
 * capabilities"). One conversation, one model that decides what to do by calling tools (lib/assistant/tools.ts):
 * help articles, the owner's figures, cards for tasks (vehicles, paperwork, a cost from a receipt, a payment, a
 * booking), buttons to the screens that need a full review (imports, contracts), and a person.
 *
 * Kept cheap: Claude Haiku through lib/ai-chat.ts (OpenAI, then Gemini, if Claude fails); a short system prompt; only
 * the tools the person's role may use; help articles fetched by a tool instead of sent every time; photos sent to the
 * model only when nothing else says what they are (a chip or their words usually do). Every call must be a tool
 * call, so the answer comes back structured (reply) and a task finishes the turn the moment its card is made.
 */

const MAX_STEPS = 4;
// "mini" picks the fast Claude model (claudeModelFor): Haiku unless ANTHROPIC_TEXT_MODEL says otherwise.
const MODEL = process.env.OPENAI_SUPPORT_MODEL || "gpt-4o-mini";
const PLAIN_LINKS = new Set(["/reports", "/transactions", "/transactions/new", "/tasks", "/fleet", "/fleet/import", "/bookings", "/bookings/new", "/calendar", "/customers", "/settings"]);

export type AssistantInput = {
  role: AssistantRole;
  organizationId: string | null;
  text: string;
  files: SupportAttachment[];
  /** What the files are when a chip or their words say so; null means the model looks at the photos. */
  fileHint: ChatFileKind | null;
  /** Photos as data URLs, only when fileHint is null. */
  images: string[];
  pathname: string | null;
  language: string;
  history: AskTurn[];
  admin: any;
};

export type AssistantResult = Outcome | { type: "error"; error: string };

const ROLE_WORDS: Record<AssistantRole, string> = {
  owner: "the business owner",
  manager: "a manager at the business (not the owner)",
  teammate: "a teammate at the business (not the owner)",
  visitor: "a visitor on RoveHQ's website, not signed in"
};

function systemPrompt(input: AssistantInput, tools: ToolName[]) {
  const has = (tool: ToolName) => tools.includes(tool);
  const vehicle = String(input.pathname || "").match(/^\/fleet\/([0-9a-f-]{36})/i)?.[1];
  const booking = String(input.pathname || "").match(/^\/bookings\/([0-9a-f-]{36})/i)?.[1];
  const tasks = (["add_vehicles", "renew_paperwork", "record_cost", "record_payment", "create_booking"] as ToolName[]).filter(has);
  return [
    "You are the RoveHQ assistant, in the chat of RoveHQ, an app for small vehicle rental businesses (owners and staff, mostly on phones). You are the only assistant: help, figures and tasks are all yours. Never mention other assistants.",
    // The business's own clock and distance unit (a UK business: Europe/London and miles), recorded when it was loaded.
    input.role === "visitor" ? "" : `Their time zone is ${businessTimeZone()}. Distances (odometer, services, limits) are in ${businessDistanceUnit() === "mi" ? "miles (mi)" : "kilometers (km)"}.`,
    `Today is ${businessToday()}. Reply in ${input.language}. They are ${ROLE_WORDS[input.role]}, on the page ${input.pathname || "/"}${vehicle ? ` (vehicle ${vehicle})` : ""}${booking ? ` (booking ${booking})` : ""}.`,
    "Always call a tool. Finish with reply, unless another tool finishes the turn.",
    "How to use RoveHQ, features, problems, plans and pricing: call search_help, then reply only from what it returns. Never invent a feature, button or setting. If it doesn't cover the question, say so in one sentence and set handoff.",
    "Tone: friendly, professional and direct, like a helpful colleague. At most 60 words of prose. Steps as lines starting with \"• \", at most 6, one action each. Button and field names in **bold**, spelled as the articles spell them. No padding, no restating the question, no sign-off. Articles marked (has video) play under your reply: don't describe them.",
    "If they ask for new help content (a guide, video, FAQ), answer what you can, end with \"Thanks, I've passed that on to the team.\" and set request.",
    has("business_records")
      ? "Questions about their own business (money in and out, who owes what, what's due, vehicles, renewals, bookings, forecasts): call business_records, then answer from it. Lead with the answer, in plain words, amounts in the records' currency (฿12,500 for THB), dates like 14 Oct 2026. Use only its figures and totals; never show field names. You may add up to 3 links in the text as [label](/fleet/<id>) or [label](/bookings/<id>) with ids from the records, or to /transactions, /reports, /bookings, /fleet, /calendar, /tasks."
      : input.role === "visitor"
        ? "They aren't signed in: talk about RoveHQ itself only. You can't open files here: say a person from the RoveHQ team can, and set handoff."
        : "Their business's figures (money, who owes what, forecasts), imports and contracts are for the owner: if asked, say so in one sentence. Help questions and tasks are fine.",
    tasks.length
      ? `Tasks (${tasks.join(", ")}): call the tool as soon as you have the essentials. Its card lets them check and change every detail and nothing is saved until they tap Save, so don't ask about details the card can take, and never say it's done. Work dates out from today (YYYY-MM-DD). If the last reply showed vehicle or paperwork cards and they're adding details or answering its question, call that tool again.`
      : "",
    input.role === "visitor"
      ? ""
      : `Files: receipts and bills go to record_cost${has("add_vehicles") ? "; vehicle photos and registration books to add_vehicles; policies, tax receipts and inspection certificates to renew_paperwork" : ""}${has("import_sheet") ? "; spreadsheets to import_sheet; their own contract to contract_upload" : ""}; damage, odometer and fuel photos to damage_photos.${has("add_vehicles") ? "" : " Adding vehicles and their paperwork is for the owner or a manager."}`,
    "Things you can't do here (deleting, editing or canceling records, messaging customers): say so and name the page to do it on.",
    "When you can't read what they sent, an import keeps failing, or you're going round in circles, say a person from the RoveHQ team can bring it in for them for free, and set handoff.",
    "Only call talk_to_person when they ask for a person."
  ]
    .filter(Boolean)
    .join("\n");
}

/** What they sent this turn, for the model: names and what a chip or their words say they are. */
function fileNote(input: AssistantInput) {
  if (!input.files.length) return "";
  const list = input.files.map((file, index) => `${index + 1}. ${file.name} (${file.type || "file"})`).join("; ");
  const what = input.fileHint && input.fileHint !== "other" ? ` They said these are: ${input.fileHint}.` : input.images.length ? " The photos are attached." : "";
  return `\n[Files sent: ${list}.${what}]`;
}

/** Links written as [label](/path) in the reply: kept when they go to a real page or record, as a button under it. */
function pullLinks(text: string, ctx: ToolContext) {
  const links: Array<{ label: string; href: string }> = [];
  const body = text.replace(/\[([^\]]{1,80})\]\((\/[^)\s]*)\)/g, (_match, label: string, href: string) => {
    const id = href.match(/^\/(fleet|bookings)\/([0-9a-f-]{36})$/i)?.[2];
    const ok = ctx.role !== "visitor" && (PLAIN_LINKS.has(href) || (id && ctx.state.knownIds.has(id)));
    if (ok && links.length < 3 && !links.some((link) => link.href === href)) links.push({ label: label.trim(), href });
    return label;
  });
  return { body: body.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(), links };
}

function finishReply(args: Record<string, any>, ctx: ToolContext): Outcome {
  const { body, links } = pullLinks(String(args.text || "").trim(), ctx);
  const handoff = args.handoff === true;
  const used = new Set((Array.isArray(args.articles) ? args.articles : []).map(String));
  const linked = ctx.state.articles.filter((article) => used.has(article.slug));
  // Only articles that were really found are shown; with none named, the best match (as the help assistant did).
  const articles = handoff ? [] : linked.length ? linked : ctx.state.articles.slice(0, 1);
  const meta: ChatMeta = {
    ...(articles.length ? { articles } : {}),
    ...(links.length ? { links } : {}),
    ...(handoff ? { offerHandoff: true } : {})
  };
  return {
    type: "reply",
    body: body || "…",
    meta,
    helpUsed: ctx.state.helpSearched ? { articles: articles.map((article) => article.slug), handoff, request: args.request === true } : undefined
  };
}

/** Runs a tool directly, without the model, when a chip already says what the files are (cheaper and quicker). */
export async function runToolDirectly(tool: ToolName, input: AssistantInput): Promise<AssistantResult | null> {
  if (!toolsForRole(input.role).includes(tool)) return null;
  const result = await runTool(tool, {}, contextFor(input));
  return result.done ? result.outcome : null;
}

function contextFor(input: AssistantInput): ToolContext {
  return {
    role: input.role,
    organizationId: input.organizationId,
    pathname: input.pathname,
    text: input.text,
    files: input.files,
    admin: input.admin,
    state: { articles: [], knownIds: new Set(), helpSearched: false }
  };
}

export async function runAssistant(input: AssistantInput): Promise<AssistantResult> {
  if (!aiTextConfigured()) return { type: "error", error: "The assistant isn't switched on for this account yet." };
  const tools = toolsForRole(input.role);
  const ctx = contextFor(input);
  const userText = `${input.text || "(no message)"}${fileNote(input)}`;
  const messages: any[] = [
    { role: "system", content: systemPrompt(input, tools) },
    ...input.history.slice(-8).map((turn) => ({ role: turn.role, content: String(turn.content || "").slice(0, 1500) })),
    { role: "user", content: input.images.length ? [{ type: "text", text: userText }, ...input.images.slice(0, 4).map((url) => ({ type: "image_url", image_url: { url, detail: "high" } }))] : userText }
  ];

  try {
    for (let step = 0; step < MAX_STEPS; step += 1) {
      const last = step === MAX_STEPS - 1;
      const completion = await createChatCompletion(
        {
          model: MODEL,
          temperature: 0,
          max_tokens: 900,
          messages,
          tools: toolSpecs(last ? ["reply"] : tools) as any,
          tool_choice: last ? { type: "function", function: { name: "reply" } } : "required"
        },
        { timeout: 45_000 }
      );
      const message: any = completion.choices[0]?.message;
      const calls: any[] = message?.tool_calls || [];
      if (!calls.length) {
        // A provider that answered in words instead of a tool call: still an answer.
        const text = String(message?.content || "").trim();
        if (text) return finishReply({ text }, ctx);
        throw new Error("empty reply");
      }
      messages.push({ role: "assistant", content: message.content || "", tool_calls: calls });
      for (const call of calls) {
        let args: Record<string, any> = {};
        try {
          args = JSON.parse(call.function?.arguments || "{}") || {};
        } catch {
          args = {};
        }
        const name = String(call.function?.name || "");
        if (name === "reply") return finishReply(args, ctx);
        const result = await runTool(name, args, ctx);
        if (result.done) return result.outcome;
        messages.push({ role: "tool", tool_call_id: call.id, content: result.content });
      }
    }
    return { type: "error", error: "Couldn't work out an answer to that. Try asking it another way." };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    console.warn("[assistant] failed:", why.slice(0, 300));
    if (/no credits|insufficient_quota|exceeded your current quota|billing/i.test(why)) {
      return { type: "error", error: "The assistant's AI service is out of credit, so it can't answer right now. Everything else in RoveHQ works as normal." };
    }
    return { type: "error", error: "Couldn't reach the assistant just now. Try again in a moment." };
  }
}
