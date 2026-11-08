import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { CSSProperties } from "react";
import { preload } from "react-dom";
import { photoProps } from "@/lib/photo-url";
import type { Destination } from "@/lib/rove/destinations";
import s from "../rove.module.css";

/**
 * A destination's picture (task build-rove, 8 Nov 2026). In order: a photo of the place put at
 * public/rove/destinations/<slug>.webp (or .jpg), a real listed vehicle there, else a drawn tile in the place's own
 * colour with its coordinates and contour lines, so no page shows a stock picture of somewhere else.
 */

/** Deep tones that keep white type readable; each place gets one from its name. */
const TONES = ["#0c3a3f", "#11463a", "#153f5c", "#2e3554", "#47331f", "#1f3d4f", "#173f33", "#3b2f45"];

function hash(text: string) {
  let value = 2166136261;
  for (let index = 0; index < text.length; index += 1) value = Math.imul(value ^ text.charCodeAt(index), 16777619) >>> 0;
  return value;
}

/** The place's own photo on disk, if one has been added. */
export function placePhoto(slug: string): string | null {
  for (const ext of ["webp", "jpg"]) {
    const file = `/rove/destinations/${slug}.${ext}`;
    if (existsSync(join(process.cwd(), "public", file))) return file;
  }
  return null;
}

/**
 * The place's photo with its smaller copies (scripts/rove-destination-sizes.mjs makes <slug>-480/-800/-1200.webp
 * beside the 1600px original), so a phone or a small tile loads a file its size (task perf, 8 Nov 2026).
 */
function placePhotoProps(slug: string, file: string, sizes: string) {
  const widths = [480, 800, 1200].filter((width) => existsSync(join(process.cwd(), "public", "rove", "destinations", `${slug}-${width}.webp`)));
  if (!widths.length) return { src: file };
  return { src: file, srcSet: [...widths.map((width) => `/rove/destinations/${slug}-${width}.webp ${width}w`), `${file} 1600w`].join(", "), sizes };
}

type Credit = { photographer: string; photographer_url: string; source_url: string; license: string };
let credits: Record<string, Credit> | null = null;

/** Who took a place's photo, from public/rove/destinations/credits.json (Unsplash photos, task dest-photos). */
function photoCredit(slug: string): Credit | null {
  if (!placePhoto(slug)) return null;
  if (!credits) {
    try {
      credits = JSON.parse(readFileSync(join(process.cwd(), "public", "rove", "destinations", "credits.json"), "utf8"));
    } catch {
      credits = {};
    }
  }
  return credits?.[slug] || null;
}

/** A small credit in a hero's top corner, only when the place's own photo is the one shown. */
export function PlaceCredit({ slug }: { slug: string }) {
  const credit = photoCredit(slug);
  if (!credit) return null;
  const ref = "?utm_source=rove&utm_medium=referral";
  return (
    <p className={s.placeCredit}>
      © <a href={`${credit.photographer_url}${ref}`} rel="noopener" target="_blank">{credit.photographer}</a> /{" "}
      <a href={`https://unsplash.com/${ref}`} rel="noopener" target="_blank">Unsplash</a>
    </p>
  );
}

function coords(center: { lat: number; lng: number }) {
  const lat = `${Math.abs(center.lat).toFixed(2)}° ${center.lat >= 0 ? "N" : "S"}`;
  const lng = `${Math.abs(center.lng).toFixed(2)}° ${center.lng >= 0 ? "E" : "W"}`;
  return `${lat}  ${lng}`;
}

/** Contour lines: nested, slightly irregular loops, the same for a place every time. */
function Contours({ seed }: { seed: number }) {
  const cx = 30 + (seed % 40);
  const cy = 25 + ((seed >> 8) % 40);
  const loops = Array.from({ length: 9 }, (_, ring) => {
    const r = 8 + ring * 9;
    const points = Array.from({ length: 12 }, (_, step) => {
      const angle = (step / 12) * Math.PI * 2;
      const wobble = 1 + (((seed >> ((step + ring) % 24)) & 7) - 3.5) / 22;
      return `${(cx + Math.cos(angle) * r * wobble * 1.25).toFixed(1)},${(cy + Math.sin(angle) * r * wobble).toFixed(1)}`;
    });
    return <polygon fill="none" key={ring} points={points.join(" ")} stroke="#fff" strokeLinejoin="round" strokeWidth="0.35" />;
  });
  return (
    <svg aria-hidden="true" preserveAspectRatio="xMidYMid slice" viewBox="0 0 100 100">
      {loops}
    </svg>
  );
}

export function PlaceArt({ destination, vehiclePhoto, eager = false, sizes = "(min-width: 900px) 50vw, 100vw" }: { destination: Pick<Destination, "slug" | "name" | "center">; vehiclePhoto?: string | null; eager?: boolean; sizes?: string }) {
  const seed = hash(destination.slug);
  const own = placePhoto(destination.slug);
  const style = { "--art": TONES[seed % TONES.length] } as CSSProperties;
  // The hero's picture is the page's largest paint: asked for from the <head>, before the stylesheets and fonts.
  if (eager) {
    const picture = own ? placePhotoProps(destination.slug, own, sizes) : vehiclePhoto ? photoProps(vehiclePhoto, sizes) : null;
    if (picture) preload(picture.src, { as: "image", fetchPriority: "high", ...("srcSet" in picture && picture.srcSet ? { imageSrcSet: picture.srcSet, imageSizes: sizes } : {}) });
  }
  return (
    <span aria-hidden="true" className={s.placeArt} style={style}>
      {own ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" decoding="async" fetchPriority={eager ? "high" : undefined} loading={eager ? "eager" : "lazy"} {...placePhotoProps(destination.slug, own, sizes)} />
      ) : vehiclePhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img alt="" decoding="async" fetchPriority={eager ? "high" : undefined} loading={eager ? "eager" : "lazy"} {...photoProps(vehiclePhoto, sizes)} />
      ) : (
        <>
          <Contours seed={seed} />
          <span className={s.placeCoords}>{coords(destination.center)}</span>
        </>
      )}
    </span>
  );
}
