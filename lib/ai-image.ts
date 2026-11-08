/**
 * Making and editing images with AI (task build-img, 8 Nov 2026): vehicle photos generated from the vehicle's details,
 * and owners' own photos enhanced. Claude can't make images, so this is its own small provider layer:
 *
 *   1. Google Gemini image models (GEMINI_API_KEY; model from GEMINI_IMAGE_MODEL, else the current Nano Banana models,
 *      newest first). Image output is not on Gemini's free tier: the key's Google Cloud project needs billing on.
 *   2. OpenAI gpt-image-1 (OPENAI_API_KEY; model from OPENAI_IMAGE_MODEL), when Gemini can't.
 *
 * Callers get bytes back (or an AiImageError saying why not, in a form the page can explain); which provider answered
 * is not their concern. Rough cost per image (Nov 2026): Gemini Nano Banana 2.1 at 2K about US$0.05, gpt-image-1
 * medium quality at 1536x1024 about US$0.06.
 */

export type AiImageProvider = "gemini" | "openai";

/** Why an image couldn't be made: no provider set up, the provider's quota or billing, or anything else. */
export class AiImageError extends Error {
  constructor(
    message: string,
    public reason: "no_provider" | "billing" | "busy" | "refused" | "failed"
  ) {
    super(message);
  }
}

export type AiImageResult = { bytes: Buffer; mediaType: string; provider: AiImageProvider; model: string };

type Request = {
  prompt: string;
  /** A photo to edit (enhance); without one, a new image is made. */
  image?: { bytes: Buffer; mediaType: string };
};

const GEMINI_MODELS = ["gemini-nano-banana-2.1", "gemini-3.1-flash-image", "gemini-3.1-flash-image-preview", "gemini-2.5-flash-image"];

export function imageProviders(): AiImageProvider[] {
  const list: AiImageProvider[] = [];
  if (process.env.GEMINI_API_KEY) list.push("gemini");
  if (process.env.OPENAI_API_KEY) list.push("openai");
  return list;
}

function classify(provider: AiImageProvider, status: number, message: string): AiImageError {
  const text = `${status} ${message}`;
  if (/billing|billed|paid|free tier|free_tier|limit: 0|insufficient_quota|exceeded your current quota|credit|payment/i.test(text)) return new AiImageError(`${provider}: ${message}`, "billing");
  if (status === 429 || /rate|quota|resource has been exhausted|overloaded|unavailable|503|high demand/i.test(text)) return new AiImageError(`${provider}: ${message}`, "busy");
  if (/safety|blocked|policy|moderation|refus/i.test(text)) return new AiImageError(`${provider}: ${message}`, "refused");
  return new AiImageError(`${provider}: ${message}`, "failed");
}

async function withGemini(input: Request): Promise<AiImageResult> {
  const models = [...new Set([process.env.GEMINI_IMAGE_MODEL, ...GEMINI_MODELS].filter(Boolean) as string[])];
  let last: AiImageError | null = null;
  for (const model of models) {
    const parts: any[] = [{ text: input.prompt }];
    if (input.image) parts.push({ inline_data: { mime_type: input.image.mediaType, data: input.image.bytes.toString("base64") } });
    const imageConfig: Record<string, string> = { aspectRatio: "3:2" };
    // The 2.5 model makes one size (about 1K); the newer ones take a size.
    if (!model.startsWith("gemini-2.5")) imageConfig.imageSize = "2K";
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: { "x-goog-api-key": process.env.GEMINI_API_KEY || "", "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig } }),
        signal: AbortSignal.timeout(90_000)
      });
    } catch (error) {
      last = new AiImageError(`gemini ${model}: ${error instanceof Error ? error.message : "no answer"}`, "busy");
      continue;
    }
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(payload?.error?.message || response.statusText);
      // A retired or unknown model: try the next one. Anything else (billing, quota) stands for every model.
      if (response.status === 404 || /not found|is not supported|unknown model|no longer available/i.test(message)) {
        last = new AiImageError(`gemini ${model}: ${message}`, "failed");
        continue;
      }
      throw classify("gemini", response.status, message);
    }
    const found = (payload.candidates?.[0]?.content?.parts || []).find((part: any) => part.inlineData?.data || part.inline_data?.data);
    const data = found?.inlineData || found?.inline_data;
    if (!data?.data) {
      const reason = String(payload.candidates?.[0]?.finishReason || payload.promptFeedback?.blockReason || "no image in the answer");
      throw classify("gemini", 200, reason);
    }
    return { bytes: Buffer.from(data.data, "base64"), mediaType: data.mimeType || data.mime_type || "image/png", provider: "gemini", model };
  }
  throw last || new AiImageError("gemini: no image model answered", "failed");
}

async function withOpenAi(input: Request): Promise<AiImageResult> {
  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  let response: Response;
  if (input.image) {
    const form = new FormData();
    form.set("model", model);
    form.set("prompt", input.prompt);
    form.set("size", "1536x1024");
    form.set("quality", "medium");
    form.set("input_fidelity", "high");
    form.set("image", new Blob([new Uint8Array(input.image.bytes)], { type: input.image.mediaType }), "photo.png");
    response = await fetch("https://api.openai.com/v1/images/edits", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}` }, body: form, signal: AbortSignal.timeout(120_000) });
  } else {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY || ""}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt: input.prompt, size: "1536x1024", quality: "medium", n: 1 }),
      signal: AbortSignal.timeout(120_000)
    });
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw classify("openai", response.status, String(payload?.error?.message || response.statusText));
  const data = payload.data?.[0]?.b64_json;
  if (!data) throw new AiImageError("openai: no image in the answer", "failed");
  return { bytes: Buffer.from(data, "base64"), mediaType: "image/png", provider: "openai", model };
}

/**
 * Local development only (AI_IMAGE_DEV_FAKE=1, never in production): a stand-in image without calling a provider, so
 * the previews, keep, discard and revert can be tried without image billing. An edit returns the photo given, a little brighter.
 */
async function devFake(input: Request): Promise<AiImageResult> {
  const sharp = (await import("sharp")).default;
  await new Promise((resolve) => setTimeout(resolve, 1200));
  if (input.image) return { bytes: await sharp(input.image.bytes).modulate({ brightness: 1.12, saturation: 1.05 }).png().toBuffer(), mediaType: "image/png", provider: "gemini", model: "dev-fake" };
  const view = /View: ([^.,]+)/.exec(input.prompt)?.[1] || "view";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024"><rect width="100%" height="100%" fill="#e9e6e1"/><ellipse cx="768" cy="760" rx="520" ry="40" fill="#cfcac2"/><text x="768" y="520" font-family="Arial" font-size="56" text-anchor="middle" fill="#6b6660">DEV FAKE · ${view.replace(/[<&>]/g, "")}</text></svg>`;
  return { bytes: await sharp(Buffer.from(svg)).png().toBuffer(), mediaType: "image/png", provider: "gemini", model: "dev-fake" };
}

/** Makes (or, with `image`, edits) one image. Tries each provider set up; throws an AiImageError when none can. */
export async function makeImage(input: Request): Promise<AiImageResult> {
  if (process.env.NODE_ENV !== "production" && process.env.AI_IMAGE_DEV_FAKE === "1") return devFake(input);
  const providers = imageProviders();
  if (!providers.length) throw new AiImageError("No image provider is set up.", "no_provider");
  const errors: AiImageError[] = [];
  for (const provider of providers) {
    try {
      return provider === "gemini" ? await withGemini(input) : await withOpenAi(input);
    } catch (error) {
      const failure = error instanceof AiImageError ? error : new AiImageError(`${provider}: ${error instanceof Error ? error.message : String(error)}`, "failed");
      console.error(`[ai-image] ${failure.message}`);
      errors.push(failure);
    }
  }
  // The most useful reason for the owner: a refusal, else billing, else busy.
  const order: AiImageError["reason"][] = ["refused", "billing", "busy", "failed"];
  errors.sort((a, b) => order.indexOf(a.reason) - order.indexOf(b.reason));
  throw errors[0];
}
