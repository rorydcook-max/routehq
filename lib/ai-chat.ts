import OpenAI from "openai";

/**
 * One way to ask a text model, whichever provider is available. OpenAI is tried first; if it fails (no key, out
 * of credit, down), Google Gemini through its OpenAI-compatible endpoint, trying current models in turn. Callers
 * keep writing OpenAI-style requests (messages, tools, JSON replies) and get an OpenAI-style answer back.
 */
type ChatParams = Omit<OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming, "stream">;

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai/";

function geminiModels() {
  return [...new Set([process.env.GEMINI_TEXT_MODEL, "gemini-flash-lite-latest", "gemini-3.1-flash-lite", "gemini-flash-latest", "gemini-3-flash-preview"].filter(Boolean) as string[])];
}

function message(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

/** True when some text model can be asked at all. */
export function aiTextConfigured() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

export async function createChatCompletion(params: ChatParams, options: { timeout?: number } = {}): Promise<OpenAI.Chat.Completions.ChatCompletion> {
  let lastError: unknown = new Error("No AI provider is configured.");

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
