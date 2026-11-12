import { RouteHqLogo } from "@/components/brand-logo";

/**
 * Rove's logo: the signed-off R with "Rove" beside it (11 Nov 2026). The colours are fixed by tone, not by the app's
 * theme: "dark" (white word) for the night header and footer, "light" (ink word) for light surfaces.
 */
export function RoveLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return <RouteHqLogo className={tone === "dark" ? "" : "[--logo-ink:#1e1b4b]"} product="keys" tone={tone} />;
}