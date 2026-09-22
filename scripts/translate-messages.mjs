// Fills in missing interface translations for every supported language.
//
//   npm run translate            -> all namespaces, all languages
//   npm run translate -- inspection th my
//
// Rules:
//   * Only MISSING strings are translated. Anything already present - including
//     a native speaker's corrections - is never overwritten. To re-translate a
//     string, delete it from that language's file first.
//   * Every result is validated before it is saved: same placeholders as the
//     English, and it must format with next-intl's own formatter. Anything that
//     fails is left out, so the app shows English for it instead of a broken string.
//   * Machine translations still need native-speaker review before real use.
//
// Uses OPENAI_API_KEY from .env.local, and OPENAI_TRANSLATION_MODEL if set (default gpt-4o).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import OpenAI from "openai";

const require = createRequire(import.meta.url);
const { createTranslator } = require("next-intl");

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(root, ".env.local") });

const localesSource = fs.readFileSync(path.join(root, "lib", "i18n", "locales.ts"), "utf8");
const LANGUAGES = [...localesSource.matchAll(/code:\s*"([^"]+)",\s*label:\s*"[^"]*",\s*english:\s*"([^"]+)"/g)].map((m) => ({ code: m[1], name: m[2] }));
if (!LANGUAGES.length) throw new Error("Could not read the language list from lib/i18n/locales.ts");

const args = process.argv.slice(2);
const english = readLocale("en");
const namespaces = args.length && english[args[0]] ? [args.shift()] : Object.keys(english);
const onlyLocales = args.length ? new Set(args) : null;

const model = process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o";
if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set in .env.local");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function readLocale(code) {
  const file = path.join(root, "locales", code, "common.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
}
function writeLocale(code, data) {
  const dir = path.join(root, "locales", code);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "common.json"), JSON.stringify(data, null, 2) + "\n", "utf8");
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
// Ask the language itself whether it changes word form for plurals (Thai: no; French: yes).
function hasPluralForms(code) {
  try {
    return new Intl.PluralRules(code).resolvedOptions().pluralCategories.length > 1;
  } catch {
    return true;
  }
}
// The exact plural categories this language uses, from Intl itself, so the
// model does not have to guess (it tends to flatten plurals when it does).
function pluralNote(code) {
  let categories = ["other"];
  try {
    categories = new Intl.PluralRules(code).resolvedOptions().pluralCategories;
  } catch {}
  return categories.length > 1
    ? `This language has plural forms. Any string containing "{count, plural, ...}" MUST stay an ICU plural using exactly these categories: ${categories.join(", ")}.`
    : "This language has no plural forms: write count strings as a single form containing {count}, without plural syntax.";
}
function argNames(s) {
  return [...String(s).matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]).sort().join(",");
}

const SYSTEM = `You translate the user interface of RouteHQ, software used by vehicle rental businesses in Thailand and Southeast Asia. The readers are rental staff and delivery drivers using a phone while handing a car or motorbike to a customer or taking it back.

Rules:
- Translate the JSON values. Return a JSON object with exactly the same keys and nothing else.
- Keep every {placeholder} exactly as written, e.g. {km}, {date}, {area}, {count}. Never translate or remove them.
- ICU plurals such as "{count, plural, one {# photo} other {# photos}}": if the target language distinguishes plural forms (French, German, Spanish, Russian, Hebrew, Hindi, Tamil, Sinhala, Swedish, Norwegian, Filipino and similar), you MUST keep the ICU plural syntax and use the plural categories that language actually uses (for example Russian needs one, few, many, other). If it does not (for example Thai, Lao, Burmese, Vietnamese, Chinese, Japanese, Korean, Indonesian, Malay), write a single form that still contains {count}, e.g. "{count} ...". Keep the # sign only inside a plural block.
- Use the terms a vehicle rental company in that country would put in its own rental agreement, not general-purpose words:
  * "deposit" = the refundable security deposit held against the rental (French "caution", German "Kaution", Spanish "fianza", Thai "เงินมัดจำ"), not a bank deposit or down payment.
  * "damage excess" = the amount the renter must pay towards damage, like an insurance excess or deductible (French "franchise", German "Selbstbeteiligung", Spanish "franquicia").
  * "forfeited" = the deposit was kept by the company, not refunded.
  * "odometer" = the distance reading on the dashboard; "handover" = giving the vehicle to the customer; "return" = receiving it back.
- Keep "GPS" and "km" as they are unless the language has a clearly standard alternative.
- Short, plain, polite wording suitable for buttons and labels. No explanations.`;

async function translateBatch(language, batch) {
  const response = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content: `Target language: ${language.name} (${language.code}).\n${pluralNote(language.code)}\n\n${JSON.stringify(batch, null, 2)}`
      }
    ]
  });
  return JSON.parse(response.choices[0]?.message?.content || "{}");
}

const sample = { km: "90,124", date: "1 Oct 2026", area: "front left", count: 3 };
let totalAdded = 0;
let totalRejected = 0;

for (const language of LANGUAGES) {
  if (language.code === "en" || (onlyLocales && !onlyLocales.has(language.code))) continue;
  const data = readLocale(language.code);
  let added = 0;
  const rejected = [];

  for (const ns of namespaces) {
    const source = flatten(english[ns]);
    const existing = flatten(data[ns]);
    const missing = Object.fromEntries(Object.entries(source).filter(([key]) => !(key in existing)));
    const keys = Object.keys(missing);
    if (!keys.length) continue;

    for (let i = 0; i < keys.length; i += 60) {
      const batch = Object.fromEntries(keys.slice(i, i + 60).map((key) => [key, missing[key]]));
      let result;
      try {
        result = await translateBatch(language, batch);
      } catch (error) {
        rejected.push(`${ns}: batch failed (${error.message})`);
        continue;
      }
      for (const [key, en] of Object.entries(batch)) {
        const text = result[key];
        if (typeof text !== "string" || !text.trim()) { rejected.push(`${ns}.${key}: empty`); continue; }
        if (argNames(text) !== argNames(en)) { rejected.push(`${ns}.${key}: placeholders changed`); continue; }
        if (/\bplural\b/.test(en) && hasPluralForms(language.code) && !/\bplural\b/.test(text)) {
          rejected.push(`${ns}.${key}: plural forms dropped`);
          continue;
        }
        try {
          const probe = {};
          setDeep(probe, key, text);
          createTranslator({ locale: language.code, messages: probe })(key, sample);
        } catch (error) {
          rejected.push(`${ns}.${key}: does not format (${error.message})`);
          continue;
        }
        data[ns] = data[ns] || {};
        setDeep(data[ns], key, text);
        added++;
      }
    }
  }

  if (added) writeLocale(language.code, data);
  totalAdded += added;
  totalRejected += rejected.length;
  console.log(`${language.code.padEnd(6)} ${language.name.padEnd(30)} +${added}${rejected.length ? `  rejected ${rejected.length}: ${rejected.slice(0, 3).join("; ")}` : ""}`);
}

console.log(`\nDone. ${totalAdded} strings added, ${totalRejected} rejected (those show in English until fixed).`);
