import { SITE_FONT_FACES } from "@/lib/sites/font-faces";
import { fontPairing } from "@/lib/sites/fonts";
import { templateDef } from "@/lib/sites/templates";
import type { SiteConfig } from "@/lib/sites/config";

/**
 * The booking page's font pairing, self-hosted (task perf2, 8 Nov 2026): its @font-face rules written into the page
 * (a few KB, files in public/fonts/sites/, scripts/site-fonts.mjs), so there is no stylesheet from Google to wait for
 * and no restyle of the whole page when one arrives. Only this pairing's rules; each file carries its alphabet's
 * unicode-range, so only the alphabets the page's words use are downloaded. Returns the pairing's id when its rules
 * were written here (SitePage then links nothing), else null (SitePage links public/fonts/sites/<id>.css).
 */
export function siteFontFaces(config: SiteConfig): { id: string; css: string | null } {
  const id = fontPairing(config.font, templateDef(config.template).font).id;
  return { id, css: SITE_FONT_FACES[id] ?? null };
}

export function SiteFontFaces({ css }: { css: string | null }) {
  return css ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null;
}
