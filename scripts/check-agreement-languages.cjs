// Checks that every Thai text in the RoveHQ agreement (lib/contract-templates/default-en.html) has its translations in
// lib/contract-templates/second-languages.ts. A Thai text without one is left out (English only) for businesses outside
// Thailand, so after changing the template's Thai wording, run: node scripts/check-agreement-languages.cjs
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const template = fs.readFileSync(path.join(root, "lib", "contract-templates", "default-en.html"), "utf8");
const table = fs.readFileSync(path.join(root, "lib", "contract-templates", "second-languages.ts"), "utf8");
const rows = table.split("\n").filter((line) => line.startsWith("  {")).map((line) => JSON.parse(line.trim().replace(/,$/, "")));
const keys = new Set(rows.map((row) => row.th.trim()));

const missing = [];
const clauses = [...template.matchAll(/<div class="lang-th">([\s\S]*?)<\/div>/g)].map((match) => match[1].trim());
for (const clause of clauses) if (!keys.has(clause)) missing.push(`clause: ${clause.slice(0, 80)}`);
const rest = template.replace(/<div class="lang-th">[\s\S]*?<\/div>/g, "");
for (const match of rest.matchAll(/ \/ ([^<{]*[฀-๿][^<{]*)/g)) {
  const label = match[1].replace(/:\s*$/, "").trim();
  if (!keys.has(label)) missing.push(`label: ${label}`);
}
const LANGS = ["id", "vi", "ms", "fil", "lo", "km", "el", "es", "pt", "it", "hr", "fr", "de"];
const empty = rows.filter((row) => LANGS.some((lang) => !String(row[lang] || "").trim()));
for (const row of empty) missing.push(`untranslated: ${row.th.slice(0, 60)} (${LANGS.filter((lang) => !String(row[lang] || "").trim()).join(", ")})`);

// Every {{placeholder}} and <span>/<strong> of a row must survive in each language (country and law names are
// written into the European languages, so those three may differ).
const tokens = (text) => (String(text).match(/\{\{[^}]+\}\}|<\/?(span|strong)[^>]*>/g) || []).filter((t) => !/agreement_country|agreement_law_2|jurisdiction/.test(t)).sort().join("|");
for (const row of rows) {
  const want = tokens(row.id);
  for (const lang of LANGS) if (tokens(row[lang]) !== want) missing.push(`placeholders differ (${lang}): ${row.th.slice(0, 50)}`);
}

// The European country clauses (lib/contract-templates/country-clauses.ts): each shared one in all seven European
// languages, each one-country clause in that country's language.
const countryFile = fs.readFileSync(path.join(root, "lib", "contract-templates", "country-clauses.ts"), "utf8");
const countryRows = Object.fromEntries(
  countryFile.split("\n").filter((line) => /^  "[A-Za-z]+": \{/.test(line)).map((line) => {
    const match = line.match(/^  "([A-Za-z]+)": (\{.*\}),$/);
    return [match[1], JSON.parse(match[2])];
  })
);
const EUROPE_LANGS = ["el", "es", "pt", "it", "hr", "fr", "de"];
const COUNTRY_LANG = { CY: "el", GR: "el", ES: "es", PT: "pt", IT: "it", HR: "hr", FR: "fr", DE: "de" };
for (const key of ["use", "travel", "insurance", "fines", "law", "data", "esign"]) {
  if (!countryRows[key]) missing.push(`country clause missing: ${key}`);
  else for (const lang of EUROPE_LANGS) if (!String(countryRows[key][lang] || "").trim()) missing.push(`country clause ${key}: no ${lang}`);
}
for (const [code, lang] of Object.entries(COUNTRY_LANG)) if (countryRows[code] && !String(countryRows[code][lang] || "").trim()) missing.push(`country clause ${code}: no ${lang}`);

if (missing.length) {
  console.error(`Agreement translations: ${missing.length} problem(s)\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`Agreement translations OK: ${clauses.length} clauses, ${rows.length - clauses.length} labels, ${LANGS.length} languages; ${Object.keys(countryRows).length} European country clauses.`);
