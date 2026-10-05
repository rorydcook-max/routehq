/**
 * Reading photos and documents (passports, licences, odometers, blue books).
 *
 * Uses Claude when ANTHROPIC_API_KEY is set, otherwise OpenAI. Callers ask for
 * a JSON object and get one back; which provider answered is not their concern.
 */

type ReadInput = {
  system: string;
  prompt: string;
  bytes: Buffer;
  /** "image/jpeg", "image/png", "application/pdf"… */
  mediaType: string;
  maxTokens?: number;
};

export function visionProvider(): "anthropic" | "openai" | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENAI_API_KEY) return "openai";
  return null;
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

/** Reads a photo (or, with Claude, a PDF) and returns the JSON object asked for. Throws when it can't. */
export async function readFileAsJson(input: ReadInput): Promise<Record<string, unknown>> {
  const provider = visionProvider();
  if (provider === "anthropic") return readWithClaude(input);
  if (provider === "openai") return readWithOpenAi(input);
  throw new Error("No AI provider is configured.");
}
