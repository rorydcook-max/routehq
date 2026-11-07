// The website builder's template pictures (sites2): one picture per template, taken from its live example at
// /rent/demo/<template id> and saved as public/site/templates/<id>.webp. The template gallery (Booking page tool) and
// rovehq.io/booking-pages show them. Run again after changing a template, its example or its art.
//
//   npm run dev                                  (or any running copy of the app)
//   node scripts/site-template-previews.mjs [base URL] [ids, comma separated]
//
// Needs Chrome and playwright-core (npm i -D playwright-core, or run from a folder that has it); sharp comes with Next.
import { createRequire } from "module";
import { mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(join(process.cwd(), "package.json"));
const fromRepo = createRequire(join(ROOT, "package.json"));
const load = (name) => {
  for (const req of [require, fromRepo]) {
    try {
      return req(name);
    } catch {}
  }
  console.error(`${name} is not installed. Install it (npm i -D ${name}) or run this from a folder that has it.`);
  process.exit(1);
};
const { chromium } = load("playwright-core");
const sharp = load("sharp");

const BASE = process.argv[2] || "http://localhost:3000";
const TEMPLATES = fromRepo("fs")
  .readFileSync(join(ROOT, "lib/sites/templates.ts"), "utf8")
  .match(/TEMPLATE_IDS = \[([\s\S]*?)\]/)[1]
  .match(/"([a-z]+)"/g)
  .map((id) => id.replace(/"/g, ""));
const ONLY = process.argv[3] ? process.argv[3].split(",") : TEMPLATES;
const OUT = join(ROOT, "public/site/templates");
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ channel: "chrome", headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1.5, locale: "en-US", reducedMotion: "reduce" });
for (const id of ONLY) {
  const page = await context.newPage();
  await page.goto(`${BASE}/rent/demo/${id}`, { waitUntil: "networkidle", timeout: 240000 });
  await page.evaluate(() => document.fonts.ready);
  // The demo banner is dropped so the picture starts at the site's own header, and so is Next's dev badge.
  await page.evaluate(() => {
    document.querySelector("[data-template] > p")?.remove();
    document.querySelectorAll("nextjs-portal").forEach((element) => element.remove());
  });
  await page.waitForTimeout(800);
  const shot = await page.screenshot({ fullPage: false });
  await sharp(shot).resize(960, 600).webp({ quality: 78 }).toFile(join(OUT, `${id}.webp`));
  console.log(`saved public/site/templates/${id}.webp`);
  await page.close();
}
await browser.close();
