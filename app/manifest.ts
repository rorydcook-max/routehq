import type { MetadataRoute } from "next";
import { getCurrentMembership } from "@/lib/auth/roles";
import { brandPalette, isBrandColour } from "@/lib/brand";
import { planById } from "@/lib/plans";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Lets owners add RouteHQ to their home screen, where it opens like an app and
 * can send alerts. On a white-label plan the app on their phone carries their
 * business name and colour.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  let name = "RouteHQ";
  let themeColour = "#0e5e6f";
  try {
    const membership = await getCurrentMembership();
    if (membership) {
      const supabase = (await createSupabaseServerClient()) as any;
      const { data: organization } = await supabase
        .from("organizations")
        .select("name, trading_name, contract_accent_colour, subscription_tier, subscription_status")
        .eq("id", membership.organizationId)
        .is("deleted_at", null)
        .maybeSingle();
      const whiteLabel = organization && (String(organization.subscription_status || "trial") === "trial" || planById(organization.subscription_tier).whiteLabel);
      if (whiteLabel) {
        name = String(organization.trading_name || organization.name || name).slice(0, 45) || name;
        if (isBrandColour(organization.contract_accent_colour)) themeColour = brandPalette(organization.contract_accent_colour).primary;
      }
    }
  } catch {
    // Signed out or offline: RouteHQ's own manifest.
  }
  return {
    name,
    short_name: name.length > 12 ? name.split(/\s+/)[0].slice(0, 12) : name,
    description: "Run your vehicle rental business from your phone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0f4f8",
    theme_color: themeColour,
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      // Android crops a maskable icon to a circle or squircle: this one keeps the mark inside the safe zone.
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
