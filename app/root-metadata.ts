import type { Metadata, Viewport } from "next";

/**
 * Shared by the two root layouts: the app's (app/(app)/layout.tsx) and the website's
 * (app/(site)/site/[locale]/layout.tsx), so every page keeps the same title pattern, icons and browser colours.
 */
export const rootMetadata: Metadata = {
  title: {
    default: "RoveHQ",
    template: "%s | RoveHQ"
  },
  description: "The command center for vehicle rental operations.",
  applicationName: "RoveHQ",
  metadataBase: new URL("https://rovehq.app"),
  icons: {
    icon: "/rovehq-icon.svg?v=6",
    shortcut: "/rovehq-icon.svg?v=6",
    // ?v= so phones fetch the re-centred icon (27 Oct) instead of a cached copy.
    apple: "/apple-touch-icon.png?v=6"
  },
  // Opens full screen, like an app, when added to a phone's home screen.
  appleWebApp: { capable: true, title: "RoveHQ", statusBarStyle: "default" }
};

export const rootViewport: Viewport = {
  // Edge to edge on iPhones, so env(safe-area-inset-*) is real: the floating tab bar clears the home indicator
  // and the page pads itself away from the status bar and the notch (see "Phone pass" in globals.css).
  viewportFit: "cover",
  // The page header is light now (Oct 27), so the browser's top bar matches the page, not the old teal band.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef5f4" },
    { media: "(prefers-color-scheme: dark)", color: "#123f46" }
  ]
};
