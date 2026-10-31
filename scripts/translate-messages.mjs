// Fills in missing translations for every supported language: the interface strings (locales/<lang>/common.json)
// and the sentences the server sends back (locales/<lang>/server-text.json, keyed by the English sentence).
//
//   npm run translate                      -> every namespace, every language
//   npm run translate -- inspection th my  -> one namespace, chosen languages
//   npm run translate -- de fr             -> every namespace, chosen languages
//   npm run translate -- --server de fr    -> the server sentences only
//
// Rules:
//   * Only MISSING strings are translated. Anything already present, including a native speaker's corrections, is
//     never overwritten. To re-translate a string, delete it from that language's file first.
//   * Every result is validated before it is saved: same placeholders and tags as the English, and it must format
//     with next-intl's own formatter. Anything that fails is left out, so the app shows English for it instead of a
//     broken string.
//   * Saved after every batch, so a stopped run keeps what it has done.
//   * Machine translations still need native-speaker review before real use.
//
// Provider: OpenAI (OPENAI_API_KEY, OPENAI_TRANSLATION_MODEL, default gpt-4o) when TRANSLATE_PROVIDER=openai, else
// Google Gemini (GEMINI_API_KEY, GEMINI_TRANSLATION_MODEL; tries a list of models, newest first).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import dotenv from "dotenv";

const require = createRequire(import.meta.url);
const { createTranslator } = require("next-intl");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const localesSource = fs.readFileSync(path.join(root, "lib", "i18n", "locales.ts"), "utf8");
const LANGUAGES = [...localesSource.matchAll(/code:\s*"([^"]+)",\s*label:\s*"[^"]*",\s*english:\s*"([^"]+)"/g)].map((m) => ({ code: m[1], name: m[2] }));
if (!LANGUAGES.length) throw new Error("Could not read the language list from lib/i18n/locales.ts");

const args = process.argv.slice(2);
const serverOnly = args.includes("--server");
const rest = args.filter((a) => a !== "--server");
const english = readLocale("en");
const namespaces = rest.length && english[rest[0]] ? [rest.shift()] : Object.keys(english);
const onlyLocales = rest.length ? new Set(rest) : null;
const BATCH = Number(process.env.TRANSLATE_BATCH || 60);

const provider = process.env.TRANSLATE_PROVIDER || (process.env.GEMINI_API_KEY ? "gemini" : "openai");
let openai = null;
if (provider === "openai") {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set in .env.local");
  const OpenAI = require("openai");
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
} else if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in .env.local");
}
const GEMINI_MODELS = [...new Set([process.env.GEMINI_TRANSLATION_MODEL, "gemini-3.5-flash-lite", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"].filter(Boolean))];

function readLocale(code) {
  const file = path.join(root, "locales", code, "common.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")) : {};
}
function writeLocale(code, data) {
  const dir = path.join(root, "locales", code);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "common.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
}
function readServerText(code) {
  const file = path.join(root, "locales", code, "server-text.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, "")) : {};
}
function writeServerText(code, data) {
  const dir = path.join(root, "locales", code);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "server-text.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
}
function flatten(obj, prefix = "") {
  return Object.entries(obj || {}).reduce((acc, [k, v]) => {
    if (v && typeof v === "object") Object.assign(acc, flatten(v, prefix + k + "."));
    else acc[prefix + k] = v;
    return acc;
  }, {});
}
function setDeep(obj, dotted, value) {
  const parts = dotted.split(".");
  let node = obj;
  for (const part of parts.slice(0, -1)) node = node[part] = node[part] && typeof node[part] === "object" ? node[part] : {};
  node[parts.at(-1)] = value;
}
function hasPluralForms(code) {
  try {
    return new Intl.PluralRules(code).resolvedOptions().pluralCategories.length > 1;
  } catch {
    return true;
  }
}
function pluralNote(code) {
  let categories = ["other"];
  try {
    categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  } catch {}
  return categories.length > 1
    ? `This language has plural forms. Any string containing "{count, plural, ...}" (or {days, plural, ...} etc.) MUST stay an ICU plural using exactly these categories: ${categories.join(", ")}.`
    : "This language has no plural forms: write count strings as a single form containing the placeholder, without plural syntax.";
}
function argNames(s) {
  return [...String(s).matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]).sort().join(",");
}
function tagNames(s) {
  return [...String(s).matchAll(/<\/?([a-zA-Z][\w-]*)\s*\/?>/g)].map((m) => m[1]).sort().join(",");
}

/** Every English sentence the server can send back (said("...") in the code), with ${...} parts written as {}. */
function serverSentences() {
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!/node_modules|\.next/.test(p)) walk(p);
      } else if (/\.(ts|tsx)$/.test(entry.name)) files.push(p);
    }
  };
  ["app", "lib", "components"].forEach((d) => walk(path.join(root, d)));
  const sentences = new Set();
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(/\bsaid\(\s*("((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`((?:[^`\\]|\\.)*)`)/g)) {
      let s = m[2] ?? m[3] ?? m[4];
      if (m[4] !== undefined) s = s.replace(/\$\{[^}]*\}/g, "{}");
      sentences.add(s.replace(/\\"/g, '"').replace(/\\'/g, "'"));
    }
  }
  return [...sentences].sort();
}

const SYSTEM = `You translate the user interface of RoveHQ, software used by vehicle rental businesses in Thailand and Southeast Asia. The readers are rental business owners and staff (on the staff screens) and their customers, who are often tourists (on the booking pages).

Rules:
- Translate the JSON values. Return a JSON object with exactly the same keys and nothing else.
- Keep every {placeholder} exactly as written, e.g. {km}, {date}, {area}, {count}, {}. Never translate, rename or remove them.
- Keep every tag exactly as written and around the same words: <b>...</b>, <link>...</link>, <br/>. Never add or drop a tag.
- ICU plurals such as "{count, plural, one {# photo} other {# photos}}": if the target language distinguishes plural forms (French, German, Spanish, Russian, Hebrew, Hindi, Tamil, Sinhala, Swedish, Norwegian, Filipino and similar), you MUST keep the ICU plural syntax and use the plural categories that language actually uses (for example Russian needs one, few, many, other). If it does not (for example Thai, Lao, Burmese, Vietnamese, Chinese, Japanese, Korean, Indonesian, Malay), write a single form that still contains the placeholder, e.g. "{count} ...". Keep the # sign only inside a plural block. ICU "select" blocks keep their syntax and option names.
- Keep product and brand names as they are: RoveHQ, LINE, WhatsApp, PromptPay, Wise, Revolut, Telegram, Messenger, Instagram, Google, Por Ror Bor (the Thai compulsory motor insurance; you may add the local word for it in brackets once if helpful), DLT.
- Use the terms a vehicle rental company in that country would put in its own rental agreement, not general-purpose words:
  * "deposit" = the refundable security deposit held against the rental (French "caution", German "Kaution", Spanish "fianza"), not a bank deposit or down payment.
  * "damage excess" = the amount the renter must pay towards damage, like an insurance excess or deductible (French "franchise", German "Selbstbeteiligung", Spanish "franquicia").
  * "forfeited" = the deposit was kept by the company, not refunded.
  * "odometer" = the distance reading on the dashboard; "handover" = giving the vehicle to the customer; "return" = receiving it back.
- Keep "GPS", "km", "VIN", "QR" and currency codes as they are unless the language has a clearly standard alternative. Keep ฿ and numbers as they are.
- Short, plain, polite wording suitable for buttons and labels; about the same length as the English where possible. No explanations, no quotation marks around the whole value.`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function askOpenAi(language, batch) {
  const response = await openai.chat.completions.create({
    model: process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o",
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      { role: "user", content: `Target language: ${language.name} (${language.code}).\n${pluralNote(language.code)}\n\n${JSON.stringify(batch, null, 2)}` }
    ]
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

async function askGemini(language, batch) {
  // Each model has its own rate limit: a busy or rate-limited model is skipped for the next one straight away,
  // and only when every model is busy does the run pause before going round again.
  let lastError = null;
  for (let round = 0; round < 6; round += 1) {
    for (const model of GEMINI_MODELS) {
      try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
          method: "POST",
          headers: { "x-goog-api-key": process.env.GEMINI_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: `${SYSTEM} Return only JSON.` }] },
            contents: [{ role: "user", parts: [{ text: `Target language: ${language.name} (${language.code}).\n${pluralNote(language.code)}\n\n${JSON.stringify(batch, null, 2)}` }] }],
            generationConfig: { temperature: 0.2, responseMimeType: "application/json", maxOutputTokens: 16000 }
          }),
          signal: AbortSignal.timeout(120_000)
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          lastError = new Error(`${model}: ${response.status} ${payload?.error?.message || ""}`.slice(0, 160));
          continue;
        }
        const text = (payload.candidates?.[0]?.content?.parts || []).map((part) => String(part.text || "")).join("");
        const first = text.indexOf("{");
        const last = text.lastIndexOf("}");
        return JSON.parse(text.slice(first, last + 1));
      } catch (error) {
        lastError = error;
      }
    }
    await sleep(15_000 * (round + 1));
  }
  throw lastError || new Error("No Gemini model answered.");
}

const translateBatch = provider === "openai" ? askOpenAi : askGemini;

function sampleFor(english) {
  const values = {};
  for (const name of argNames(english).split(",").filter(Boolean)) values[name] = /count|days|hours|minutes|months|weeks|n|total|num/i.test(name) ? 3 : "sample";
  return values;
}

/** Checks one translated string against its English; returns a reason to reject, or null. */
function problem(code, key, en, text) {
  if (typeof text !== "string" || !text.trim()) return "empty";
  if (argNames(text) !== argNames(en)) return "placeholders changed";
  if (tagNames(text) !== tagNames(en)) return "tags changed";
  if (/\bplural\b/.test(en) && hasPluralForms(code) && !/\bplural\b/.test(text)) return "plural forms dropped";
  const formatErrors = [];
  try {
    const probe = {};
    setDeep(probe, key, text);
    const tags = Object.fromEntries(tagNames(en).split(",").filter(Boolean).map((tag) => [tag, (chunks) => chunks]));
    const t = createTranslator({ locale: code, messages: probe, onError: (e) => formatErrors.push(e.message) });
    if (Object.keys(tags).length) t.rich(key, { ...sampleFor(en), ...tags });
    else t(key, sampleFor(en));
  } catch (error) {
    formatErrors.push(error.message);
  }
  return formatErrors.length ? `does not format (${formatErrors[0]})` : null;
}

let totalAdded = 0;
let totalRejected = 0;

for (const language of LANGUAGES) {
  if (language.code === "en" || (onlyLocales && !onlyLocales.has(language.code))) continue;
  let added = 0;
  const rejected = [];
  const started = Date.now();

  if (!serverOnly) {
    const data = readLocale(language.code);
    for (const ns of namespaces) {
      const source = flatten(english[ns]);
      const existing = flatten(data[ns]);
      const missing = Object.fromEntries(Object.entries(source).filter(([key, value]) => !(key in existing) && typeof value === "string"));
      const keys = Object.keys(missing);
      if (!keys.length) continue;
      for (let i = 0; i < keys.length; i += BATCH) {
        const batch = Object.fromEntries(keys.slice(i, i + BATCH).map((key) => [key, missing[key]]));
        let result;
        try {
          result = await translateBatch(language, batch);
        } catch (error) {
          rejected.push(`${ns}: batch failed (${error.message})`);
          continue;
        }
        for (const [key, en] of Object.entries(batch)) {
          const text = result[key];
          const why = problem(language.code, key, en, text);
          if (why) {
            rejected.push(`${ns}.${key}: ${why}`);
            continue;
          }
          data[ns] = data[ns] || {};
          setDeep(data[ns], key, text);
          added++;
        }
        writeLocale(language.code, data);
        process.stdout.write(`${language.code} ${ns} ${Math.min(i + BATCH, keys.length)}/${keys.length}\n`);
      }
    }
  }

  // The sentences the server sends back: keyed by the English sentence itself.
  const server = readServerText(language.code);
  const sentences = serverSentences().filter((s) => !(s in server));
  for (let i = 0; i < sentences.length; i += BATCH) {
    const slice = sentences.slice(i, i + BATCH);
    const batch = Object.fromEntries(slice.map((s, index) => [`s${index}`, s]));
    let result;
    try {
      result = await translateBatch(language, batch);
    } catch (error) {
      rejected.push(`server-text: batch failed (${error.message})`);
      continue;
    }
    for (const [key, en] of Object.entries(batch)) {
      const text = result[key];
      if (typeof text !== "string" || !text.trim() || (en.match(/\{\}/g) || []).length !== (text.match(/\{\}/g) || []).length) {
        rejected.push(`server-text: ${en.slice(0, 40)}`);
        continue;
      }
      server[en] = text;
      added++;
    }
    writeServerText(language.code, server);
    process.stdout.write(`${language.code} server-text ${Math.min(i + BATCH, sentences.length)}/${sentences.length}\n`);
  }

  totalAdded += added;
  totalRejected += rejected.length;
  console.log(`${language.code.padEnd(6)} ${language.name.padEnd(30)} +${added} in ${Math.round((Date.now() - started) / 1000)}s${rejected.length ? `  rejected ${rejected.length}: ${rejected.slice(0, 3).join("; ")}` : ""}`);
  if (rejected.length) fs.writeFileSync(path.join(root, "locales", language.code, "rejected.log"), rejected.join("\n") + "\n");
}

console.log(`\nDone. ${totalAdded} strings added, ${totalRejected} rejected (those show in English until fixed).`);
