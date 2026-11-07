/**
 * Dry run of the hourly crons (lib/scheduled-runs.ts) and a check of the translated operator alerts
 * (lib/operator-alert-text.ts). Sends nothing and never touches the database: the run store is in memory and the
 * senders are stubs that only record who would get what.
 *
 *   npx tsx scripts/simulate-hourly-crons.ts
 *
 * 1. Three fake businesses (Bangkok, London, Athens) through every UTC hour of a winter day and a summer day: who
 *    gets the morning summary and the customer reminders at which UTC hour, on which local date. Each hour is called
 *    twice (an overlapping cron call) to show the once-a-day guard, and the winter day skips the 08:00 UTC call to
 *    show the catch-up.
 * 2. Every operatorAlerts key in every language: present, and with the same {placeholders} as English.
 * 3. A few alerts rendered in several languages.
 */
import fs from "node:fs";
import path from "node:path";
import { businessToday } from "@/lib/business-time";
import { memoryRunStore, orgTimeZone, runDailyJob, type DailyJob, type ScheduleOrg } from "@/lib/scheduled-runs";
import { operatorAlertTextFrom, type AlertText } from "@/lib/operator-alert-text";

const root = path.join(__dirname, "..");

// ── 1. Scheduling ────────────────────────────────────────────────────────────
type FakeOrg = ScheduleOrg & { name: string };
const orgs: FakeOrg[] = [
  { id: "bkk", name: "Samui Wheels (Bangkok)", timezone: "Asia/Bangkok", country_code: "TH" },
  // Never picked a zone: the column default (Bangkok) is read as "not chosen" for a UK business.
  { id: "lon", name: "London Hire (no zone saved)", timezone: "Asia/Bangkok", country_code: "GB" },
  { id: "ath", name: "Athens Cars", timezone: "Europe/Athens", country_code: "GR" }
];

console.log("Time zones used:");
for (const org of orgs) console.log(`  ${org.name.padEnd(30)} -> ${orgTimeZone(org)}`);

async function simulateDay(day: string, skipUtcHours: number[] = []) {
  const stores: Record<DailyJob, ReturnType<typeof memoryRunStore>> = { morning_summary: memoryRunStore(), customer_reminders: memoryRunStore(), review_requests: memoryRunStore() };
  const sent: string[] = [];
  let duplicates = 0;
  console.log(`\n=== ${day} (UTC hours${skipUtcHours.length ? `, no cron call at ${skipUtcHours.map((h) => `${h}:00`).join(", ")} UTC` : ""}) ===`);
  for (let hour = 0; hour < 24; hour++) {
    if (skipUtcHours.includes(hour)) continue;
    const at = new Date(`${day}T${String(hour).padStart(2, "0")}:00:00Z`);
    // Same order as before: summary first, then reminders. Each called twice to show nothing goes out twice.
    for (const job of ["morning_summary", "customer_reminders"] as DailyJob[]) {
      for (let call = 0; call < 2; call++) {
        await runDailyJob({
          job,
          orgs,
          store: stores[job],
          at,
          // Stub sender. businessToday() is what code below the job reads: it follows the business's zone, but
          // from the real clock, so it only matches the local date on the simulated day when that day is today.
          work: async ({ zone, localDate, orgs: due }) => {
            for (const org of due) {
              const zoneToday = day === new Date().toISOString().slice(0, 10) ? `  businessToday()=${businessToday()}` : "";
              const line = `${String(hour).padStart(2, "0")}:00 UTC  ${job === "morning_summary" ? "summary  " : "reminders"}  ${(org as FakeOrg).name.padEnd(30)} ${zone.padEnd(15)} local date ${localDate}${zoneToday}`;
              if (call > 0) duplicates++;
              sent.push(line);
            }
          }
        });
      }
    }
  }
  sent.forEach((line) => console.log("  " + line));
  console.log(`  -> ${sent.length} sends (expected ${orgs.length * 2}), ${duplicates} duplicates (expected 0)`);
  return sent.length === orgs.length * 2 && duplicates === 0;
}

// ── 2. Keys in every language ────────────────────────────────────────────────
function checkKeys() {
  const codes = [...fs.readFileSync(path.join(root, "lib/i18n/locales.ts"), "utf8").matchAll(/code:\s*"([^"]+)"/g)].map((m) => m[1]);
  const read = (locale: string) => {
    const file = path.join(root, "locales", locale, "common.json");
    return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")).operatorAlerts || null : null;
  };
  const placeholders = (text: string) => [...String(text).matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]).sort().join(",");
  const english = read("en") as Record<string, string>;
  let problems = 0;
  const report: string[] = [];
  const sources: Array<[string, Record<string, string> | null]> = codes.filter((code) => code !== "tr").map((code) => [code, read(code)]);
  // Turkish waits in locales/_shots/keys/reminders-tr.json until it is merged into locales/tr.
  const shot = path.join(root, "locales/_shots/keys/reminders-tr.json");
  sources.push(["tr (shots file)", fs.existsSync(shot) ? JSON.parse(fs.readFileSync(shot, "utf8")).common.tr.operatorAlerts : null]);
  for (const [code, own] of sources) {
    if (!own) {
      report.push(`  ${code.padEnd(16)} MISSING namespace`);
      problems++;
      continue;
    }
    const missing = Object.keys(english).filter((key) => !(key in own));
    const broken = Object.keys(english).filter((key) => key in own && placeholders(own[key]) !== placeholders(english[key]));
    // Formats every message with sample values, as the app does, to catch ICU syntax errors.
    const words = operatorAlertTextFrom(code.slice(0, code.includes(" ") ? code.indexOf(" ") : undefined), english, own);
    const unformattable = Object.keys(english).filter((key) => {
      const values = Object.fromEntries(placeholders(english[key]).split(",").filter(Boolean).map((name) => [name, `<${name}>`]));
      const text = words.say(key, values);
      return text === key || (key in own && text !== String(own[key]).replace(/\{\s*(\w+)\s*\}/g, (_, name) => `<${name}>`));
    });
    problems += missing.length + broken.length + unformattable.length;
    report.push(`  ${code.padEnd(16)} ${Object.keys(english).length - missing.length}/${Object.keys(english).length} keys${missing.length ? `  missing: ${missing.join(", ")}` : ""}${broken.length ? `  placeholders differ: ${broken.join(", ")}` : ""}${unformattable.length ? `  not formatting cleanly: ${unformattable.join(", ")}` : ""}${!missing.length && !broken.length && !unformattable.length ? "  ok" : ""}`);
  }
  console.log(`\n=== operatorAlerts in every language (${Object.keys(english).length} keys) ===`);
  report.forEach((line) => console.log(line));
  return problems === 0;
}

// ── 3. Samples ───────────────────────────────────────────────────────────────
function samples() {
  const english = JSON.parse(fs.readFileSync(path.join(root, "locales/en/common.json"), "utf8")).operatorAlerts;
  const alerts: Array<[string, AlertText]> = [
    ["portal_action", { emoji: "🧾", key: "receiptSent", values: { amount: "€240" } }],
    [
      "operator_notification",
      { emoji: "⚠️", key: "lateReturn", values: { vehicle: "Toyota Yaris", customer: "Maria K." }, dates: { due: "2026-11-05" }, then: [{ key: "lateHandoverSoon", values: { next: null }, dates: { start: "2026-11-09" } }] }
    ],
    [
      "operator_notification",
      { emoji: "❌", key: "bookingCancelled", values: { customer: null, vehicle: "Honda Click", when: { key: "whenRange", dates: { start: "2026-12-01", end: "2026-12-08" } } }, then: [{ key: "cancelPaid", values: { amount: "฿3,000" } }] }
    ]
  ];
  console.log("\n=== Sample alerts (title | words) ===");
  for (const locale of ["en", "th", "el", "de", "ja"]) {
    const own = JSON.parse(fs.readFileSync(path.join(root, "locales", locale, "common.json"), "utf8")).operatorAlerts;
    const words = operatorAlertTextFrom(locale, english, own);
    console.log(`  [${locale}] subject: ${words.say("summarySubject", { business: "Athens Cars" })}`);
    for (const [type, alert] of alerts) console.log(`  [${locale}] ${words.title(type)} | ${words.render(alert)}`);
  }
}

(async () => {
  const winter = await simulateDay("2026-11-07", [8]);
  const summer = await simulateDay("2026-07-15");
  const keys = checkKeys();
  samples();
  console.log(`\nScheduling: ${winter && summer ? "ok" : "FAILED"}; keys: ${keys ? "ok" : "FAILED"}`);
  process.exitCode = winter && summer && keys ? 0 : 1;
})();
