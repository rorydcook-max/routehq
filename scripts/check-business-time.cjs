// Standalone check of lib/business-time.ts logic (compiled on the fly by stripping types).
const fs = require("fs");
const src = fs.readFileSync(__dirname + "/../lib/business-time.ts", "utf8")
  .replace(/export /g, "")
  .replace(/: string \| null/g, "").replace(/: string = BUSINESS_TIME_ZONE/g, " = BUSINESS_TIME_ZONE")
  .replace(/\(value: unknown, timeZone\b/g, "(value, timeZone").replace(/\(date: Date, timeZone: string\)/g, "(date, timeZone)")
  .replace(/\(timeZone: string, at: Date\)/g, "(timeZone, at)").replace(/\(type: string\)/g, "(type)")
  .replace(/\): string \{/g, ") {");
const { wallTimeToIso, toWallTime } = new Function(src + "; return { wallTimeToIso, toWallTime };")();
const cases = [
  ["form 10:00 Samui", wallTimeToIso("2026-09-25T10:00"), "2026-09-25T03:00:00.000Z"],
  ["form 00:30 Samui (previous UTC day)", wallTimeToIso("2026-09-25T00:30"), "2026-09-24T17:30:00.000Z"],
  ["read back from Postgres", toWallTime("2026-09-25T03:00:00+00:00"), "2026-09-25T10:00"],
  ["round trip 23:45", toWallTime(wallTimeToIso("2026-12-31T23:45")), "2026-12-31T23:45"],
  ["old zone-less value kept as wall time", toWallTime("2026-09-25T10:00"), "2026-09-25T10:00"],
  ["date-only value", toWallTime("2026-09-25"), "2026-09-25"],
  ["empty", String(wallTimeToIso("")), "null"],
];
let failed = 0;
for (const [name, got, want] of cases) { const ok = got === want; if (!ok) failed++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${got}${ok ? "" : "  (expected " + want + ")"}`); }
process.exitCode = failed ? 1 : 0;
