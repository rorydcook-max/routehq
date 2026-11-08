import { isStockUrl, stockWidth, type ResolvedImage } from "@/lib/sites/images";
import { photoProps } from "@/lib/photo-url";
import { SiteArt } from "./site-art";
import s from "./site.module.css";

const STOCK_WIDTHS = [640, 960, 1280, 1920];

/** Our own photos through app/api/rove-photo; Unsplash photos hotlinked at the width needed (their `w` parameter). */
function sizedProps(url: string, sizes: string) {
  if (!isStockUrl(url)) return photoProps(url, sizes, 1280);
  return { src: stockWidth(url, 1280), srcSet: STOCK_WIDTHS.map((width) => `${stockWidth(url, width)} ${width}w`).join(", "), sizes };
}

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
      {...sizedProps(image.url, sizes || (priority ? "100vw" : "(min-width: 1024px) 50vw, 100vw"))}
      width={1600}
    />
  );
}
