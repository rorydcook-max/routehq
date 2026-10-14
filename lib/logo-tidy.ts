/**
 * Most logos people upload are a square export with a wide margin and a flat
 * background (white, grey, a tint). Shown small, the mark itself ends up tiny
 * and sits in a coloured box. This crops the margin away and turns a flat light
 * background transparent, so the logo fills its space and sits on any surface.
 * Returns null when there is nothing safe to do (the original is then kept).
 */
export async function tidyLogo(input: Buffer): Promise<Buffer | null> {
  let sharp: any;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    return null;
  }
  try {
    let current: Buffer = await sharp(input).rotate().resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true }).png().toBuffer();
    // Trim margin bands one at a time (a white edge around a grey card, say).
    for (let pass = 0; pass < 3; pass += 1) {
      const before = await sharp(current).metadata();
      const trimmed = await sharp(current).trim({ threshold: 24 }).png().toBuffer({ resolveWithObject: true }).catch(() => null);
      if (!trimmed || trimmed.info.width < 16 || trimmed.info.height < 8) break;
      if (trimmed.info.width === before.width && trimmed.info.height === before.height) break;
      current = trimmed.data;
    }

    const { data, info } = await sharp(current).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height } = info;
    const at = (x: number, y: number) => {
      const i = (y * width + x) * 4;
      return [data[i], data[i + 1], data[i + 2], data[i + 3]];
    };
    const corners = [at(0, 0), at(width - 1, 0), at(0, height - 1), at(width - 1, height - 1)];
    const [r, g, b, a] = corners[0];
    const close = (c: number[]) => Math.max(Math.abs(c[0] - r), Math.abs(c[1] - g), Math.abs(c[2] - b)) <= 12;
    const light = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.78;
    // A flat, light background behind the mark: fade it out, keeping soft edges.
    if (a > 200 && light && corners.every(close)) {
      for (let i = 0; i < data.length; i += 4) {
        const distance = Math.max(Math.abs(data[i] - r), Math.abs(data[i + 1] - g), Math.abs(data[i + 2] - b));
        if (distance <= 14) data[i + 3] = 0;
        else if (distance < 48) data[i + 3] = Math.round((data[i + 3] * (distance - 14)) / 34);
      }
    }
    const pad = Math.max(2, Math.round(Math.min(width, height) * 0.06));
    return await sharp(data, { raw: { width, height, channels: 4 } })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png({ compressionLevel: 9 })
      .toBuffer();
  } catch {
    return null;
  }
}
