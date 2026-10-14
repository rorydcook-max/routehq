import OpenAI from "openai";

export type ResearchSource = { url: string; title: string };

function parseJsonObject(text: string): Record<string, any> {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("No JSON in the reply.");
  return JSON.parse(text.slice(start, end + 1));
}

/** Every page the model opened or cited while answering, once each. */
function collectSources(response: any): ResearchSource[] {
  const seen = new Map<string, ResearchSource>();
  const add = (url: unknown, title: unknown) => {
    if (typeof url !== "string" || !/^https?:\/\//.test(url)) return;
    const clean = url.replace(/[?&]utm_[^&]+/g, "").replace(/[?&]$/, "");
    if (!seen.has(clean)) seen.set(clean, { url: clean, title: typeof title === "string" && title ? title : new URL(clean).hostname.replace(/^www\./, "") });
  };
  for (const item of response?.output || []) {
    for (const source of item?.action?.sources || []) add(source?.url, source?.title);
    for (const content of item?.content || []) {
      for (const annotation of content?.annotations || []) {
        if (annotation?.type === "url_citation") add(annotation.url, annotation.title);
      }
    }
  }
  return Array.from(seen.values());
}

export function researchAvailable() {
  return Boolean(process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY);
}

/**
 * The same look-up through Gemini with Google Search, used when OpenAI is not
 * set up or cannot answer (out of credit, busy). Lighter models first: they
 * answer in seconds and search just as well.
 */
async function researchJsonGemini(prompt: string): Promise<{ data: Record<string, any>; sources: ResearchSource[] }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Research is not set up.");
  const models = [...new Set([process.env.GEMINI_RESEARCH_MODEL, "gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.1-flash-lite"].filter(Boolean) as string[])];
  // Google Search is not in Gemini's free allowance. Without it the model answers from what it knows of the
  // market: rougher than live prices (so marked low confidence), but far closer than a share of the price.
  const offline = `You cannot browse the web for this answer. Answer from what you know of this market, for this exact vehicle, and set "confidence" to "low". Leave "rent_quotes" empty.\n\n${prompt}`;
  const attempts = [...models.map((model) => ({ model, search: true })), ...["gemini-flash-lite-latest", "gemini-3.1-flash-lite"].map((model) => ({ model, search: false }))];
  let lastError: unknown = null;
  for (const { model, search } of attempts) {
    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({ contents: [{ role: "user", parts: [{ text: search ? prompt : offline }] }], ...(search ? { tools: [{ google_search: {} }] } : {}), generationConfig: { temperature: 0.2 } }),
        signal: AbortSignal.timeout(100_000)
      });
      const body: any = await response.json().catch(() => null);
      if (!response.ok) throw new Error(`gemini ${model} ${response.status}: ${String(body?.error?.message || "").slice(0, 160)}`);
      const candidate = body?.candidates?.[0];
      const text = (candidate?.content?.parts || []).map((part: any) => part?.text || "").join("");
      const seen = new Map<string, ResearchSource>();
      for (const chunk of candidate?.groundingMetadata?.groundingChunks || []) {
        const url = chunk?.web?.uri;
        if (typeof url === "string" && /^https?:\/\//.test(url) && !seen.has(url)) seen.set(url, { url, title: String(chunk?.web?.title || new URL(url).hostname) });
      }
      const data = parseJsonObject(text);
      if (!search) data.confidence = "low";
      return { data, sources: Array.from(seen.values()) };
    } catch (error) {
      lastError = error;
      console.error("[ai-research]", String((error as any)?.message || error).slice(0, 200));
    }
  }
  throw lastError || new Error("Research failed.");
}

/**
 * Asks the model to look the answer up on the live web and reply with one JSON
 * object. Returns the object and the pages it used.
 */
export async function researchJson(prompt: string): Promise<{ data: Record<string, any>; sources: ResearchSource[] }> {
  if (!process.env.OPENAI_API_KEY) return researchJsonGemini(prompt);
  try {
    return await researchJsonOpenAI(prompt);
  } catch (error) {
    if (!process.env.GEMINI_API_KEY) throw error;
    console.error("[ai-research] openai:", String((error as any)?.message || error).slice(0, 200));
    return researchJsonGemini(prompt);
  }
}

async function researchJsonOpenAI(prompt: string): Promise<{ data: Record<string, any>; sources: ResearchSource[] }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("Research is not set up.");
  const client = new OpenAI({ apiKey }) as any;
  const ask = (model: string) =>
    client.responses.create({
      model,
      tools: [{ type: "web_search" }],
      tool_choice: "required",
      include: ["web_search_call.action.sources"],
      input: prompt
    });
  let response: any;
  try {
    response = await ask(process.env.OPENAI_MARKET_RESEARCH_MODEL || "gpt-5.4");
  } catch (error: any) {
    // The preferred model is not on every account; the older one always is.
    if (error?.status !== 404 && error?.status !== 400) throw error;
    response = await ask("gpt-4o");
  }
  return { data: parseJsonObject(response.output_text || ""), sources: collectSources(response) };
}

const middle = (values: number[]) => {
  const sorted = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!sorted.length) return undefined;
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[half] : (sorted[half - 1] + sorted[half]) / 2;
};

/**
 * One look at the web can land on an unusual price. This asks the same question
 * several times at once and takes the middle answer for every number, so a
 * single odd advert or a misread page does not swing the result.
 */
export async function researchJsonSteady(prompt: string, times = 3): Promise<{ data: Record<string, any>; sources: ResearchSource[] }> {
  const settled = await Promise.allSettled(Array.from({ length: times }, () => researchJson(prompt)));
  const runs = settled.filter((run): run is PromiseFulfilledResult<{ data: Record<string, any>; sources: ResearchSource[] }> => run.status === "fulfilled").map((run) => run.value);
  if (!runs.length) throw (settled[0] as PromiseRejectedResult).reason;

  const data: Record<string, any> = { ...runs[0].data };
  for (const field of Object.keys(data)) {
    const values = runs.map((run) => run.data[field]);
    if (values.every((value) => typeof value === "number")) {
      data[field] = Math.round((middle(values) as number) * 10) / 10;
    } else if (values.every((value) => Array.isArray(value) && value.every((item: unknown) => typeof item === "number"))) {
      const length = Math.min(...values.map((value) => value.length));
      data[field] = Array.from({ length }, (_, index) => Math.round((middle(values.map((value) => Number(value[index]))) as number) * 10) / 10);
    }
  }
  // Every price each look found counts: together they show the real spread.
  if (runs.some((run) => Array.isArray(run.data.rent_quotes))) data.rent_quotes = runs.flatMap((run) => (Array.isArray(run.data.rent_quotes) ? run.data.rent_quotes : []));
  // Only as sure as the least sure look.
  const order = ["low", "medium", "high"];
  const confidences = runs.map((run) => order.indexOf(String(run.data.confidence))).filter((index) => index >= 0);
  if (confidences.length) data.confidence = order[Math.min(...confidences)];

  const seen = new Map<string, ResearchSource>();
  // Take pages from each look in turn so every kind of source is represented.
  for (let index = 0; index < 30; index++) for (const run of runs) if (run.sources[index] && !seen.has(run.sources[index].url)) seen.set(run.sources[index].url, run.sources[index]);
  return { data, sources: Array.from(seen.values()) };
}

/** Where the business works and what money it uses, for a research prompt. */
export function businessPlace(organization: { currency?: string | null; settings?: Record<string, any> | null }) {
  const place = organization.settings?.main_location || {};
  const country = place.country || organization.settings?.country || "Thailand";
  const area = [place.town, place.region].filter(Boolean).join(", ") || organization.settings?.location || country;
  return { country, area, currency: organization.currency || organization.settings?.preferred_currency || "THB" };
}

const LANGUAGE_NAMES: Record<string, string> = { en: "English", th: "Thai" };
export function languageName(locale: string) {
  if (LANGUAGE_NAMES[locale]) return LANGUAGE_NAMES[locale];
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(locale) || "English";
  } catch {
    return "English";
  }
}
