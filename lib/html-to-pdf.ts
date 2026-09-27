import { existsSync } from "node:fs";
import type { Browser } from "puppeteer-core";

/**
 * HTML to PDF with headless Chrome.
 *
 * On Vercel (and other serverless Linux) Chrome comes from @sparticuz/chromium.
 * Locally it uses the Chrome installed on the machine, or CHROME_PATH.
 *
 * Serverless Chrome has no Thai, Burmese, Chinese or other non-Latin fonts, so
 * every document loads the Noto fonts it may need. Only the characters a page
 * actually uses are downloaded.
 */

const FONT_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&family=Noto+Sans+Thai:wght@400;700" +
  "&family=Noto+Sans+Myanmar:wght@400;700&family=Noto+Sans+Lao:wght@400;700&family=Noto+Sans+Khmer:wght@400;700" +
  "&family=Noto+Sans+SC:wght@400;700&family=Noto+Sans+JP:wght@400;700&family=Noto+Sans+KR:wght@400;700" +
  "&family=Noto+Sans+Arabic:wght@400;700&family=Noto+Sans+Hebrew:wght@400;700&family=Noto+Sans+Devanagari:wght@400;700" +
  "&display=block";

const FONT_FAMILY =
  "'Noto Sans', 'Noto Sans Thai', 'Noto Sans Myanmar', 'Noto Sans Lao', 'Noto Sans Khmer', 'Noto Sans SC', " +
  "'Noto Sans JP', 'Noto Sans KR', 'Noto Sans Arabic', 'Noto Sans Hebrew', 'Noto Sans Devanagari', sans-serif";

// Appended after the document's own styles: documents keep their own fonts
// first and fall back to Noto for scripts those fonts don't cover.
const FONT_FALLBACK_CSS = `<link rel="stylesheet" href="${FONT_STYLESHEET}"/><style>body{font-family:${FONT_FAMILY}}</style>`;

const LOCAL_CHROME_PATHS = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser"
];

const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

async function launchBrowser(): Promise<Browser> {
  const puppeteer = (await import("puppeteer-core")).default;
  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true
    });
  }
  const executablePath = process.env.CHROME_PATH || LOCAL_CHROME_PATHS.find((path) => existsSync(path));
  if (!executablePath) {
    throw new Error("Chrome was not found. Install Google Chrome or set CHROME_PATH to create PDFs.");
  }
  return puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });
}

/**
 * Strip leftover template tokens ({{...}}) so an unfilled placeholder never
 * appears in a customer's document.
 */
function stripTemplateTokens(html: string): string {
  return html
    .replace(/\{\{#if\s+[^}]+\}\}/g, "")
    .replace(/\{\{else\}\}/g, "")
    .replace(/\{\{\/if\}\}/g, "")
    .replace(/\{\{\/[^}]+\}\}/g, "")
    .replace(/\{\{[^}]+\}\}/g, "");
}

function withFonts(html: string): string {
  const cleaned = stripTemplateTokens(html);
  const isDocument = /^\s*<!doctype|^\s*<html/i.test(cleaned);
  if (!isDocument) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"/>${FONT_FALLBACK_CSS}</head><body>${cleaned}</body></html>`;
  }
  if (/<\/head>/i.test(cleaned)) return cleaned.replace(/<\/head>/i, `${FONT_FALLBACK_CSS}</head>`);
  return cleaned.replace(/<html[^>]*>/i, (tag) => `${tag}<head><meta charset="utf-8"/>${FONT_FALLBACK_CSS}</head>`);
}

export async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await launchBrowser();
  try {
    const page = await browser.newPage();
    // "load" waits for the font stylesheet and images; fonts.ready then waits
    // for the font files the text actually needs. Neither may hang the request.
    await page.setContent(withFonts(html), { waitUntil: "load", timeout: 30_000 });
    await Promise.race([
      page.evaluate(async () => {
        await (document as any).fonts?.ready;
      }),
      new Promise((resolve) => setTimeout(resolve, 15_000))
    ]);
    const pdf = await page.pdf({
      format: "A4",
      margin: { top: "14mm", bottom: "14mm", left: "15mm", right: "15mm" },
      printBackground: true
    });
    return Buffer.from(pdf);
  } finally {
    await browser.close().catch(() => undefined);
  }
}
