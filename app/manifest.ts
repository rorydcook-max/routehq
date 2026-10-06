import type { MetadataRoute } from "next";

/** Lets owners add RouteHQ to their home screen, where it opens like an app and can send alerts. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RouteHQ",
    short_name: "RouteHQ",
    description: "Run your vehicle rental business from your phone.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f3ef",
    theme_color: "#24456b",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}
