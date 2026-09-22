// Renders every interface string in every supported language, using
// next-intl's own formatter, to catch missing strings and broken plural rules
// or placeholders before someone opens the screen. Exits with an error if
// anything fails. Missing strings fall back to English in the app; here they
// are reported so they can be translated (npm run translate).
// Run with: npm run check:translations
const fs = require("fs");
const path = require("path");
const { createTranslator } = require("next-intl");

const root = path.join(__dirname, "..");
const codes = [...fs.readFileSync(path.join(root, "lib", "i18n", "locales.ts"), "utf8").matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]);
const read = (locale) => {
  const file = path.join(root, "locales", locale, "common.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : {};
};
const flat = (o, p = "") => Object.entries(o || {}).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, p + k + ".") : [p + k]));

const english = read("en");
const keys = flat(english);
const values = { km: "90,124", date: "1 Oct 2026", area: "front left", count: 3 };
let broken = 0;
let missingTotal = 0;

for (const locale of codes) {
  const own = read(locale);
  const present = new Set(flat(own));
  const missing = keys.filter((key) => !present.has(key));
  const errors = [];
  const t = createTranslator({ locale, messages: own, onError: (e) => errors.push(e.message) });
  for (const key of keys) {
    if (!present.has(key)) continue;
    try {
      t(key, values);
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
    }
  }
  broken += errors.length;
  missingTotal += missing.length;
  console.log(`${locale.padEnd(6)} ${String(keys.length - missing.length).padStart(4)}/${keys.length}  ${errors.length ? `${errors.length} BROKEN` : "ok"}${missing.length ? `  (${missing.length} missing, shown in English)` : ""}`);
  errors.slice(0, 5).forEach((e) => console.log(`       ${e}`));
}

console.log(`\n${broken} broken, ${missingTotal} missing across ${codes.length} languages.`);
process.exitCode = broken ? 1 : 0;
