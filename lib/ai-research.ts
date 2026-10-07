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
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Asks the model to look the answer up on the live web and reply with one JSON
 * object. Returns the object and the pages it used.
 */
export async function researchJson(prompt: string): Promise<{ data: Record<string, any>; sources: ResearchSource[] }> {
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
