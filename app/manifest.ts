import type { MetadataRoute } from "next";

/**
 * Lets owners add RoveHQ to their home screen, where it opens like an app and can send alerts.
 * Always RoveHQ's own name and icon (Rory, 27 Oct: better for the brand), whatever the business's plan;
 * a business's own logo and colour still show inside the app and on its customer pages.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RoveHQ",
    short_name: "RoveHQ",
    description: "Run your vehicle rental business from your phone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f0f4f8",
    theme_color: "#06162b",
    icons: [
      { src: "/icon-192.png?v=6", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png?v=6", sizes: "512x512", type: "image/png" },
      // Android crops a maskable icon to a circle or squircle: this one keeps the mark inside the safe zone.
      { src: "/icon-maskable-512.png?v=6", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
