// Renders every inspection string in every translated language, using
// next-intl's own formatter, to catch broken plural rules or placeholders
// before a driver opens the screen. Exits with an error if anything fails.
// Run with: npm run check:translations
const fs = require("fs");
const path = require("path");
const { createTranslator } = require("next-intl");

const root = path.join(__dirname, "..");
const read = (locale) => JSON.parse(fs.readFileSync(path.join(root, "locales", locale, "common.json"), "utf8"));
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (typeof v === "object" ? flat(v, p + k + ".") : [p + k]));

const keys = flat(read("en").inspection);
const values = { km: "90,124", date: "1 Oct 2026", area: "front left", count: 3 };
let failures = 0;

for (const locale of ["en", "th", "vi", "my"]) {
  const own = read(locale);
  const errors = [];
  const missing = keys.filter((key) => !flat(own.inspection || {}).includes(key));
  const t = createTranslator({ locale, messages: own, namespace: "inspection", onError: (e) => errors.push(e.message) });
  for (const key of keys) {
    if (missing.includes(key)) continue;
    try {
      t(key, values);
    } catch (e) {
      errors.push(`${key}: ${e.message}`);
    }
  }
  failures += errors.length + missing.length;
  console.log(`${locale}: ${keys.length - missing.length}/${keys.length} strings, ${errors.length} formatting errors${missing.length ? `, missing: ${missing.join(", ")}` : ""}`);
  errors.slice(0, 5).forEach((e) => console.log(`   ${e}`));
}

process.exitCode = failures ? 1 : 0;
