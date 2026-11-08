// The website's link-preview pictures (1200 x 630), task perf, 8 Nov 2026: rovehq.io's pages said "summary_large_image"
// but had no og:image, so shares showed no picture. Static PNGs in public/site/og (no code runs to serve them; proxy.ts
// leaves .png alone). Run again after changing the words: node scripts/site-og-images.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const IMAGES = {
  home: { kicker: "Rental software", title: ["Rental software for cars,", "scooters and motorbikes"], body: "Online bookings, signed agreements, deposits and payments. Free for small fleets." },
  pricing: { kicker: "Pricing", title: ["Plans priced by the", "size of your fleet"], body: "Free for small fleets. Every feature switched on while you try it." },
  guides: { kicker: "Guides", title: ["Guides for vehicle", "rental businesses"], body: "Contracts, deposits, licences, pricing and getting more bookings." }
};

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = "Segoe UI, Helvetica Neue, Arial, sans-serif";

function svg({ kicker, title, body }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs><linearGradient id="t" x1="110" x2="300" y1="350" y2="468" gradientUnits="userSpaceOnUse"><stop stop-color="#06B6B6"/><stop offset="1" stop-color="#0EA5FF"/></linearGradient></defs>
  <rect width="1200" height="630" fill="#06162b"/>
  <circle cx="1080" cy="560" r="300" fill="#12bcb8" opacity="0.10"/>
  <g transform="translate(72 64) scale(0.125)">
    <rect width="512" height="512" rx="112" fill="#0B1320"/>
    <g transform="translate(256 256) scale(0.86) translate(-256 -256) translate(-33 -3.5)">
      <path d="M106 378V257L248 399H127C115.402 399 106 389.598 106 378Z" fill="url(#t)"/>
      <path d="M96 120H376C436 120 474 155 474 207C474 254 443 287 394 293L482 392H360L266 289H350C377 289 395 275 395 251C395 228 377 214 350 214H185L96 120Z" fill="#ffffff"/>
    </g>
  </g>
  <text x="152" y="110" fill="#ffffff" font-family="${FONT}" font-size="36" font-weight="700">RoveHQ</text>
  <text x="1128" y="110" fill="#8fa3b8" font-family="${FONT}" font-size="26" font-weight="600" text-anchor="end">rovehq.io</text>
  <text x="72" y="250" fill="#12bcb8" font-family="${FONT}" font-size="30" font-weight="700" letter-spacing="1">${escape(kicker.toUpperCase())}</text>
  ${title.map((line, index) => `<text x="72" y="${330 + index * 78}" fill="#ffffff" font-family="${FONT}" font-size="68" font-weight="800" letter-spacing="-1.5">${escape(line)}</text>`).join("\n  ")}
  <text x="72" y="${330 + title.length * 78 + 22}" fill="#b8c6d4" font-family="${FONT}" font-size="30">${escape(body)}</text>
</svg>`;
}

const dir = join(process.cwd(), "public", "site", "og");
mkdirSync(dir, { recursive: true });
for (const [name, image] of Object.entries(IMAGES)) {
  await sharp(Buffer.from(svg(image))).png({ compressionLevel: 9, palette: true, quality: 90 }).toFile(join(dir, `${name}.png`));
  console.log(`public/site/og/${name}.png`);
}
