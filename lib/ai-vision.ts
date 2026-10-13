/**
 * Reading photos and documents (passports, licences, odometers, blue books).
 *
 * Providers: Claude (ANTHROPIC_API_KEY), OpenAI (OPENAI_API_KEY) and Google Gemini (GEMINI_API_KEY).
 * Callers ask for a JSON object and get one back; which provider answered is not their concern.
 *
 * Gemini has a free tier, but on it Google may use what is sent to improve its models and people may
 * read it. So it reads only photos with nothing personal in them (an odometer, a fuel gauge) unless
 * GEMINI_PAID=true says the key is on a paid plan. Passports and licences go to it only then.
 * When a provider fails (no credit, down), the next one is tried.
 */

type ReadInput = {
  system: string;
  prompt: string;
  bytes: Buffer;
  /** "image/jpeg", "image/png", "application/pdf"… */
  mediaType: string;
  maxTokens?: number;
  /** Anything about a person (passport, licence, selfie, documents). Defaults to true: the safe side. */
  personal?: boolean;
};

type Provider = "anthropic" | "openai" | "gemini";

/** The providers that may read this kind of photo, in the order to try them: free first for vehicle photos. */
function providersFor(personal = true): Provider[] {
  const geminiAllowed = Boolean(process.env.GEMINI_API_KEY) && (!personal || process.env.GEMINI_PAID === "true");
  const paid: Provider[] = [];
  if (process.env.ANTHROPIC_API_KEY) paid.push("anthropic");
  if (process.env.OPENAI_API_KEY) paid.push("openai");
  if (!geminiAllowed) return paid;
  return personal ? [...paid, "gemini"] : ["gemini", ...paid];
}

export function visionProvider(personal = true): Provider | null {
  return providersFor(personal)[0] || null;
}

function parseJsonObject(text: string): Record<string, unknown> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the reply.");
  return JSON.parse(text.slice(start, end + 1));
}

async function readWithClaude(input: ReadInput) {
  const data = input.bytes.toString("base64");
  const file =
    input.mediaType === "application/pdf"
      ? { type: "document", source: { type: "base64", media_type: "application/pdf", data } }
      : { type: "image", source: { type: "base64", media_type: input.mediaType || "image/jpeg", data } };
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_VISION_MODEL || "claude-sonnet-5",
      max_tokens: input.maxTokens || 600,
      temperature: 0,
      system: `${input.system} Reply with one JSON object and nothing else.`,
      messages: [{ role: "user", content: [file, { type: "text", text: input.prompt }] }]
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "The photo could not be read.");
  const text = (payload.content || []).map((part: any) => (part.type === "text" ? part.text : "")).join("");
  return parseJsonObject(text);
}

async function readWithOpenAi(input: ReadInput) {
  if (!input.mediaType.startsWith("image/")) throw new Error("Only photos can be read.");
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: process.env.OPENAI_VISION_MODEL || "gpt-4o",
      response_format: { type: "json_object" },
      temperature: 0,
      max_tokens: input.maxTokens || 600,
      messages: [
        { role: "system", content: `${input.system} Return only JSON.` },
        {
          role: "user",
          content: [
            { type: "text", text: input.prompt },
            { type: "image_url", image_url: { url: `data:${input.mediaType};base64,${input.bytes.toString("base64")}`, detail: "high" } }
          ]
        }
      ]
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "The photo could not be read.");
  return parseJsonObject(String(payload.choices?.[0]?.message?.content || ""));
}

async function readWithGemini(input: ReadInput) {
  const model = process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || "", "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: `${input.system} Return only JSON.` }] },
      contents: [{ role: "user", parts: [{ inline_data: { mime_type: input.mediaType || "image/jpeg", data: input.bytes.toString("base64") } }, { text: input.prompt }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: Math.max(input.maxTokens || 600, 1024) }
    })
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "The photo could not be read.");
  const text = (payload.candidates?.[0]?.content?.parts || []).map((part: any) => String(part.text || "")).join("");
  return parseJsonObject(text);
}

/** Reads a photo (or, with Claude or Gemini, a PDF) and returns the JSON object asked for. Throws when none can. */
export async function readFileAsJson(input: ReadInput): Promise<Record<string, unknown>> {
  const providers = providersFor(input.personal ?? true);
  if (!providers.length) throw new Error("No AI provider is configured.");
  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      if (provider === "anthropic") return await readWithClaude(input);
      if (provider === "openai") return await readWithOpenAi(input);
      return await readWithGemini(input);
    } catch (error) {
      // Out of credit or down: say which in the server log and try the next one.
      console.error(`[ai-vision] ${provider}:`, error instanceof Error ? error.message : error);
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("The photo could not be read.");
}
