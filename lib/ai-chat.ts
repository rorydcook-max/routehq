import OpenAI from "openai";

/**
 * One way to ask a text model, whichever provider is available. Claude is tried first (Rory, 2 Nov 2026: one
 * provider, Claude, billed on the Console; Haiku is also the cheapest). If it fails (no key, out of credit, down),
 * OpenAI, then Google Gemini through its OpenAI-compatible endpoint. Callers keep writing OpenAI-style requests
 * (messages, tools, JSON replies) and get an OpenAI-style answer back.
 */
type ChatParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "stream">;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

function geminiModels() {
  return [...new Set([process.env.GEMINI_TEXT_MODEL, "gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3-flash-preview"].filter(Boolean) as string[])];
}

/**
 * The Claude model for a request. Callers name OpenAI models: the light ones ("mini") get the fast model, the
 * heavier ones the smart model. Both default to Haiku; ANTHROPIC_SMART_MODEL can move the heavy work up a tier.
 */
export function claudeModelFor(openAiModel?: string | null) {
  const fast = process.env.ANTHROPIC_TEXT_MODEL || "claude-haiku-5-5";
  if (!openAiModel || /mini|nano|lite/i.test(openAiModel)) return fast;
  return process.env.ANTHROPIC_SMART_MODEL || fast;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** True when some text model can be asked at all. */
export function aiTextConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

/** The text of an OpenAI-style content value (a string, or parts). */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((part: any) => (part?.type === "text" ? String(part.text || "") : "")).join("\n");
  return "";
}

/** OpenAI content parts to Claude blocks: text stays text, data-URL images become base64 images. */
function claudeBlocks(content: unknown): any[] {
  if (typeof content === "string") return content ? [{ type: "text", text: content }] : [];
  if (!Array.isArray(content)) return [];
  const blocks: any[] = [];
  for (const part of content as any[]) {
    if (part?.type === "text" && part.text) blocks.push({ type: "text", text: String(part.text) });
    if (part?.type === "image_url") {
      const url = String(part.image_url?.url || "");
      const match = url.match(/^data:(image\/[a-z+]+);base64,(.+)$/i);
      if (match) blocks.push({ type: "image", source: { type: "base64", media_type: match[1].toLowerCase(), data: match[2] } });
      else if (/^https:\/\//.test(url)) blocks.push({ type: "image", source: { type: "url", url } });
    }
  }
  return blocks;
}

/** Turns an OpenAI-style request into a Claude Messages request. */
function toClaudeRequest(params: ChatParams) {
  const system: string[] = [];
  const messages: Array<{ role: "user" | "assistant"; content: any[] }> = [];
  const push = (role: "user" | "assistant", blocks: any[]) => {
    if (!blocks.length) return;
    const last = messages[messages.length - 1];
    // Claude wants turns to alternate: two in a row from the same side are joined.
    if (last && last.role === role) last.content.push(...blocks);
    else messages.push({ role, content: blocks });
  };

  for (const item of params.messages as any[]) {
    if (item.role === "system" || item.role === "developer") {
      system.push(textOf(item.content));
    } else if (item.role === "user") {
      push("user", claudeBlocks(item.content));
    } else if (item.role === "assistant") {
      const blocks = claudeBlocks(item.content);
      for (const call of item.tool_calls || []) {
        let input: unknown = {};
        try {
          input = JSON.parse(call.function?.arguments || "{}");
        } catch {
          input = {};
        }
        blocks.push({ type: "tool_use", id: call.id, name: call.function?.name, input });
      }
      push("assistant", blocks);
    } else if (item.role === "tool") {
      push("user", [{ type: "tool_result", tool_use_id: item.tool_call_id, content: textOf(item.content) }]);
    }
  }
  if (!messages.length || messages[0].role !== "user") messages.unshift({ role: "user", content: [{ type: "text", text: "(start)" }] });

  const wantsJson = (params.response_format as any)?.type === "json_object" || (params.response_format as any)?.type === "json_schema";
  if (wantsJson) system.push("Reply with one JSON object and nothing else: no code fences, no words before or after it.");

  const tools = ((params.tools || []) as any[])
    .filter((tool) => tool?.type === "function" && tool.function?.name)
    .map((tool) => ({ name: tool.function.name, description: tool.function.description || "", input_schema: tool.function.parameters || { type: "object", properties: {} } }));
  const choice = params.tool_choice as any;
  const toolChoice =
    !tools.length || choice === "none"
      ? undefined
      : choice === "required"
        ? { type: "any" }
        : choice?.type === "function"
          ? { type: "tool", name: choice.function?.name }
          : { type: "auto" };

  // Claude may think before answering and the thinking counts against max_tokens: leave room on top of the reply.
  const replyTokens = Number((params as any).max_completion_tokens || params.max_tokens || 0) || 4096;
  return {
    body: {
      model: claudeModelFor(params.model),
      max_tokens: replyTokens + 2048,
      // Short, high-volume work (chat replies, JSON extraction): little thinking, fast answers.
      output_config: { effort: process.env.ANTHROPIC_EFFORT || "low" },
      ...(system.filter(Boolean).length ? { system: system.filter(Boolean).join("\n\n") } : {}),
      messages,
      ...(tools.length && choice !== "none" ? { tools, tool_choice: toolChoice } : {})
    },
    wantsJson
  };
}

/** The first whole JSON object in a reply, for callers that asked for JSON. */
function jsonOnly(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  return start >= 0 && end > start ? text.slice(start, end + 1) : text;
}

async function askClaude(params: ChatParams, options: { timeout?: number }): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  const { body, wantsJson } = toClaudeRequest(params);
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(options.timeout || 60_000)
  });
  const payload: any = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`claude ${response.status}: ${payload?.error?.message || "request failed"}`);

  const parts: any[] = payload?.content || [];
  const text = parts.map((part) => (part.type === "text" ? String(part.text || "") : "")).join("");
  const toolCalls = parts
    .filter((part) => part.type === "tool_use")
    .map((part) => ({ id: String(part.id), type: "function" as const, function: { name: String(part.name), arguments: JSON.stringify(part.input || {}) } }));
  const finish = payload?.stop_reason === "tool_use" ? "tool_calls" : payload?.stop_reason === "max_tokens" ? "length" : "stop";
  return {
    id: String(payload?.id || "claude"),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: String(payload?.model || body.model),
    choices: [
      {
        index: 0,
        finish_reason: finish,
        logprobs: null,
        message: { role: "assistant", content: wantsJson && !toolCalls.length ? jsonOnly(text) : text, refusal: null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }
      }
    ],
    usage: {
      prompt_tokens: Number(payload?.usage?.input_tokens || 0),
      completion_tokens: Number(payload?.usage?.output_tokens || 0),
      total_tokens: Number(payload?.usage?.input_tokens || 0) + Number(payload?.usage?.output_tokens || 0)
    }
  } as OpenAI.Chat.Completions.ChatCompletion;
}

export async function createChatCompletion(params: ChatParams, options: { timeout?: number } = {}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown = new Error("No AI provider is configured.");

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return await askClaude(params, options);
    } catch (error) {
      lastError = error;
      console.warn("[ai-chat] claude:", message(error).slice(0, 200));
    }
  }

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: options.timeout, maxRetries: 0 });
      return await openai.chat.completions.create({ ...params, stream: false });
    } catch (error) {
      lastError = error;
      console.warn("[ai-chat] openai:", message(error).slice(0, 200));
    }
  }

  if (process.env.GEMINI_API_KEY) {
    const gemini = new OpenAI({ apiKey: process.env.GEMINI_API_KEY, baseURL: GEMINI_BASE, timeout: options.timeout || 25_000, maxRetries: 0 });
    // Gemini thinks before answering, and the thinking counts against the token limit: give it room, keep it short.
    const room = params.max_tokens ? Math.max(params.max_tokens * 4, 4000) : undefined;
    for (const model of geminiModels()) {
      try {
        const { max_completion_tokens: _ignored, ...rest } = params as ChatParams & { max_completion_tokens?: number };
        return await gemini.chat.completions.create({ ...rest, model, max_tokens: room, reasoning_effort: "low", stream: false } as ChatParams & { stream: false });
      } catch (error) {
        lastError = error;
        console.warn(`[ai-chat] gemini ${model}:`, message(error).slice(0, 200));
        // Only a retired, unknown or busy model is worth trying the next one.
        if (!/no longer available|not found|is not supported|unknown model|404|429|503|high demand|overloaded|unavailable|try again later|resource.exhausted|timed out|timeout|connection error/i.test(message(error))) break;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(message(lastError));
}
