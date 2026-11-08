import type { ResolvedImage } from "@/lib/sites/images";
import { photoProps } from "@/lib/photo-url";
import { SiteArt } from "./site-art";
import s from "./site.module.css";

/**
 * A site image filling its box (the box sets the shape, so nothing moves while it loads): a photo, or built-in art
 * drawn in the page's colours. `priority` for the hero, so it starts loading first. Served photos come at the width
 * the box needs (srcset), not the full upload.
 */
export function SiteImage({
  image,
  priority = false,
  settle = false,
  className = "",
  sizes
}: {
  image: ResolvedImage;
  priority?: boolean;
  settle?: boolean;
  className?: string;
  sizes?: string;
}) {
  const motion = settle ? s.settle : "";
  if (image.type === "art") return <SiteArt className={`absolute inset-0 h-full w-full ${motion} ${className}`} id={image.id} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt={image.alt}
      className={`absolute inset-0 h-full w-full object-cover ${motion} ${className}`}
      decoding="async"
      fetchPriority={priority ? "high" : "auto"}
      height={1000}
      loading={priority ? "eager" : "lazy"}
      {...photoProps(image.url, sizes || (priority ? "100vw" : "(min-width: 1024px) 50vw, 100vw"), 1280)}
      width={1600}
    />
  );
}
