// Regression check for contract template conditionals.
//
// Mirrors the {{#if}} handling in lib/contract-rendering.ts (renderContractTemplate)
// and renders the real template for a rolling-monthly and a fixed-term rental.
// Fails if any {{#if}}/{{else}}/{{/if}} tag leaks into the output, or if a
// fixed-term contract is missing any section a rolling-monthly one has.
// Keep the logic below identical to renderContractTemplate.
//
// Run: node scripts/check-contract-conditionals.cjs
const fs = require("fs");
const path = require("path");
const template = fs.readFileSync(path.join(__dirname, "..", "lib", "contract-templates", "default-en.html"), "utf8");

function render(variables) {
  let rendered = template.replace(/<!--\s*CONDITIONAL:\s*([a-zA-Z0-9_]+)\s*-->([\s\S]*?)<!--\s*END CONDITIONAL\s*-->/g, (_m, key, content) => (variables[key] ? content : ""));
  const innermostIf = /\{\{#if\s+([a-zA-Z0-9_]+)\s*\}\}((?:(?!\{\{#if\b)[\s\S])*?)\{\{\/if\}\}/g;
  for (let i = 0; i < 50; i += 1) {
    const before = rendered;
    rendered = rendered.replace(innermostIf, (_m, key, body) => {
      const elseIndex = body.indexOf("{{else}}");
      const truthy = elseIndex === -1 ? body : body.slice(0, elseIndex);
      const fallback = elseIndex === -1 ? "" : body.slice(elseIndex + "{{else}}".length);
      return variables[key] ? truthy : fallback;
    });
    if (rendered === before) break;
  }
  return rendered.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => String(variables[key] ?? ""));
}

const text = (html) => html.replace(/<style[\s\S]*?<\/style>/g, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
const leftover = (s) => s.match(/\{\{[#/]?(if|else)[^}]*\}\}/g) || [];
const base = { business_logo_url: "", owner_signature_url: "", customer_signature_url: "", special_conditions: "" };
const cases = {
  "rolling monthly": text(render({ ...base, is_rolling_monthly: true })),
  "fixed term": text(render({ ...base, is_rolling_monthly: false })),
  "all optional parts present": text(render({ business_logo_url: "logo.png", owner_signature_url: "o.png", customer_signature_url: "c.png", special_conditions: "Special terms", is_rolling_monthly: true }))
};

let failed = false;
for (const [name, output] of Object.entries(cases)) {
  const tags = leftover(output);
  console.log(`${name.padEnd(28)} ${String(output.split(" ").length).padStart(5)} words  ${tags.length ? "LEAKED TAGS " + JSON.stringify(tags) : "no leaked tags"}`);
  if (tags.length) failed = true;
}

const headings = [...template.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/g)].map((m) => text(m[1]).trim()).filter(Boolean);
const missing = headings.filter((h) => cases["rolling monthly"].includes(h) && !cases["fixed term"].includes(h));
console.log(`sections a fixed-term contract is missing: ${missing.length}`);
missing.forEach((h) => console.log("   -", h.replace(/[^\x20-\x7E]+/g, "").trim()));
if (missing.length) failed = true;

process.exitCode = failed ? 1 : 0;
