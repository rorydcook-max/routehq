import type { ResolvedImage } from "@/lib/sites/images";
import { SiteArt } from "./site-art";
import s from "./site.module.css";

/**
 * A site image filling its box (the box sets the shape, so nothing moves while it loads): a photo, or built-in art
 * drawn in the page's colours. `priority` for the hero, so it starts loading first.
 */
export function SiteImage({ image, priority = false, settle = false, className = "" }: { image: ResolvedImage; priority?: boolean; settle?: boolean; className?: string }) {
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
      src={image.url}
      width={1600}
    />
  );
}
