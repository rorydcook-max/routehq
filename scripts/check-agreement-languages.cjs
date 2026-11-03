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
const empty = rows.filter((row) => ["id", "vi", "ms", "fil", "lo", "km"].some((lang) => !String(row[lang] || "").trim()));
for (const row of empty) missing.push(`untranslated: ${row.th.slice(0, 60)}`);

if (missing.length) {
  console.error(`Agreement translations: ${missing.length} problem(s)\n${missing.join("\n")}`);
  process.exit(1);
}
console.log(`Agreement translations OK: ${clauses.length} clauses, ${rows.length - clauses.length} labels, 6 languages.`);
