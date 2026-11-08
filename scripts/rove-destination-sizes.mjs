// Smaller copies of each destination photo in public/rove/destinations (task perf, 8 Nov 2026): <slug>-480.webp,
// <slug>-800.webp and <slug>-1200.webp beside the 1600px <slug>.webp, so a 173px tile on a phone loads ~20 KB instead
// of ~250 KB (place-art.tsx picks them with srcset). Run after adding or replacing a photo: node scripts/rove-destination-sizes.mjs
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

export const DESTINATION_WIDTHS = [480, 800, 1200];
const dir = join(process.cwd(), "public", "rove", "destinations");

for (const file of readdirSync(dir)) {
  const match = /^([a-z0-9-]+?)\.(webp|jpg)$/.exec(file);
  if (!match || /-\d+$/.test(match[1])) continue;
  const source = join(dir, file);
  const { width = 0 } = await sharp(source).metadata();
  for (const size of DESTINATION_WIDTHS) {
    const out = join(dir, `${match[1]}-${size}.webp`);
    // Never upscale: a photo narrower than the size is used as it is (the original stays in the srcset).
    if (width && width <= size) continue;
    try {
      if (statSync(out).mtimeMs > statSync(source).mtimeMs) continue;
    } catch {
      // Not made yet.
    }
    await sharp(source).resize({ width: size, withoutEnlargement: true }).webp({ quality: 72, effort: 5 }).toFile(out);
    console.log(`${file} -> ${size}w`);
  }
}
