import { brandCss } from "@/lib/brand";

/**
 * Re-colours the page in the operator's brand colour. Renders nothing for
 * Lokalfleet's own colour. React hoists a style with href and precedence into
 * <head> (and keeps one per href), which also keeps streaming and hydration
 * happy wherever the component sits.
 */
export function BrandStyle({ colour }: { colour: string | null | undefined }) {
  const css = brandCss(colour);
  if (!css) return null;
  return (
    <style href={`brand-${String(colour).replace("#", "")}`} precedence="brand">
      {css}
    </style>
  );
}
