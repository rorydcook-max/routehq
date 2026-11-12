// Makes the app's icon files from public/rovehq-icon.svg (the signed-off R on Ink Navy).
// Run: node scripts/gen-brand-icons.cjs
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const full = fs.readFileSync(path.join(root, "public", "rovehq-icon.svg"), "utf8").trim();
// Maskable icons keep the mark inside the middle 60%, so a round or squircle mask never clips it.
const masked = full.replace('translate(76.8 124.7) scale(0.53493)', 'translate(112.6 150.9) scale(0.42794)');
// The browser tab icon is the R alone, no background, as large as the square allows (Rory, 12 Nov 2026).
const tab = full.replace(/<rect width="512" height="512"[^>]*\/>/, "").replace('translate(76.8 124.7) scale(0.53493)', 'translate(16 80.2) scale(0.71642)');
if (tab === full || tab.includes('fill="#1E1B4B"')) throw new Error("tab icon: the background or the transform was not found");

async function png(svg, size, file) {
  await sharp(Buffer.from(svg), { density: 300 }).resize(size, size).png().toFile(path.join(root, "public", file));
  console.log("wrote", file);
}

(async () => {
  await png(full, 192, "icon-192.png");
  await png(full, 512, "icon-512.png");
  await png(masked, 512, "icon-maskable-512.png");
  await png(full, 180, "apple-touch-icon.png");
  fs.writeFileSync(path.join(root, "app", "icon.svg"), tab);
  fs.writeFileSync(path.join(root, "public", "rovehq-tab.svg"), tab);
  console.log("wrote app/icon.svg");
})();
