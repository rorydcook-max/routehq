"use client";

import { useEffect } from "react";

const SHRUNK = "__routehqShrunk";

/**
 * Shrinks every photo the moment it is picked in any file input on the page,
 * before the page's own code sees it. A phone photo (3-5 MB) becomes a few
 * hundred KB, so forms stay under Vercel's 4.5 MB request limit and uploads
 * are quick on mobile data. Videos, PDFs and small images are left alone.
 *
 * It listens at the window in the capture phase, which runs before React's
 * own listeners, holds the original event back, swaps in the smaller file and
 * then sends the change on. Add data-keep-original to an input to opt out.
 */
export function ImageShrinker() {
  useEffect(() => {
    async function onChange(event: Event) {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || input.type !== "file" || (event as any)[SHRUNK]) return;
      if (input.hasAttribute("data-keep-original")) return;
      const files = Array.from(input.files || []);
      if (!files.some((file) => file.type.startsWith("image/") && file.size > 400 * 1024)) return;

      event.stopImmediatePropagation();
      input.setAttribute("data-shrinking", "true");
      try {
        // Loaded when a photo is first picked, not with every page (task perf, 8 Nov 2026): the upload helpers bring the
        // storage client with them (about 60 KB), which the website and booking pages otherwise never use.
        const { compressImage } = await import("@/lib/direct-upload-client");
        const smaller = await Promise.all(files.map((file) => compressImage(file)));
        const transfer = new DataTransfer();
        smaller.forEach((file) => transfer.items.add(file));
        input.files = transfer.files;
      } catch {
        // Keep the original files if anything goes wrong.
      } finally {
        input.removeAttribute("data-shrinking");
        for (const type of ["input", "change"]) {
          const resent = new Event(type, { bubbles: true });
          (resent as any)[SHRUNK] = true;
          input.dispatchEvent(resent);
        }
      }
    }
    window.addEventListener("change", onChange, true);
    return () => window.removeEventListener("change", onChange, true);
  }, []);
  return null;
}
