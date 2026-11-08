// Smaller copies of each destination photo in public/rove/destinations (task perf, 8 Nov 2026): <slug>-480.webp,
// <slug>-800.webp and <slug>-1200.webp beside the 1600px <slug>.webp, so a 173px tile on a phone loads ~20 KB instead
// of ~250 KB (place-art.tsx picks them with srcset). AVIF copies of every size too (<slug>-480.avif … <slug>.avif;
// task perf2, 8 Nov 2026), offered first to browsers that take AVIF: about a quarter smaller at the same look
// (quality 55 against WebP's 72, compared side by side). Run after adding or replacing a photo:
// node scripts/rove-destination-sizes.mjs
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

export const DESTINATION_WIDTHS = [480, 800, 1200];
const dir = join(process.cwd(), "public", "rove", "destinations");

/** Whether `out` is already newer than `source`. */
function fresh(out, source) {
  try {
    return statSync(out).mtimeMs > statSync(source).mtimeMs;
  } catch {
    return false;
  }
}

for (const file of readdirSync(dir)) {
  const match = /^([a-z0-9-]+?)\.(webp|jpg)$/.exec(file);
  if (!match || /-\d+$/.test(match[1])) continue;
  const source = join(dir, file);
  const { width = 0 } = await sharp(source).metadata();
  for (const size of DESTINATION_WIDTHS) {
    // Never upscale: a photo narrower than the size is used as it is (the original stays in the srcset).
    if (width && width <= size) continue;
    const webp = join(dir, `${match[1]}-${size}.webp`);
    if (!fresh(webp, source)) {
      await sharp(source).resize({ width: size, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toFile(webp);
      console.log(`${file} -> ${size}w webp`);
    }
    const avif = join(dir, `${match[1]}-${size}.avif`);
    if (!fresh(avif, source)) {
      await sharp(source).resize({ width: size, withoutEnlargement: true }).avif({ quality: 55, effort: 6 }).toFile(avif);
      console.log(`${file} -> ${size}w avif`);
    }
  }
  // The full-size photo as AVIF (the largest entry in the AVIF srcset).
  const full = join(dir, `${match[1]}.avif`);
  if (!fresh(full, source)) {
    await sharp(source).avif({ quality: 55, effort: 6 }).toFile(full);
    console.log(`${file} -> avif`);
  }
}
