/**
 * The logo an operator adds to their free agreement: PNG or JPEG only (Word can't show WebP or SVG), up to 2 MB.
 * The type and size are read from the file's own bytes, never trusted from the browser.
 */

export const LOGO_MAX_BYTES = 2 * 1024 * 1024;

export type LogoInfo = { type: "png" | "jpg"; width: number; height: number; mime: "image/png" | "image/jpeg"; ext: "png" | "jpg" };

export function inspectLogo(data: Buffer): LogoInfo | null {
  if (data.length < 24 || data.length > LOGO_MAX_BYTES) return null;
  // PNG: signature, then the IHDR chunk with width and height.
  if (data.readUInt32BE(0) === 0x89504e47 && data.toString("ascii", 12, 16) === "IHDR") {
    return { type: "png", width: data.readUInt32BE(16), height: data.readUInt32BE(20), mime: "image/png", ext: "png" };
  }
  // JPEG: walk the markers to the first start-of-frame, which holds the size.
  if (data[0] === 0xff && data[1] === 0xd8) {
    let offset = 2;
    while (offset + 9 < data.length) {
      if (data[offset] !== 0xff) return null;
      const marker = data[offset + 1];
      const length = data.readUInt16BE(offset + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { type: "jpg", height: data.readUInt16BE(offset + 5), width: data.readUInt16BE(offset + 7), mime: "image/jpeg", ext: "jpg" };
      }
      offset += 2 + length;
    }
  }
  return null;
}
