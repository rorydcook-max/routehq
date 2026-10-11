import { brandCss } from "@/lib/brand";

/** Re-colours the page in the operator's brand colour. Renders nothing for RouteHQ's own colour. */
export function BrandStyle({ colour }: { colour: string | null | undefined }) {
  const css = brandCss(colour);
  if (!css) return null;
  return <style dangerouslySetInnerHTML={{ __html: css }} />;
}
