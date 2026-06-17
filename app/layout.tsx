import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "RouteHQ",
    template: "%s | RouteHQ"
  },
  description: "The command centre for vehicle rental operations.",
  applicationName: "RouteHQ",
  metadataBase: new URL("https://routehq.app"),
  icons: {
    icon: "/routehq-icon.svg",
    shortcut: "/routehq-icon.svg",
    apple: "/routehq-icon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
      </head>
      <body>{children}</body>
    </html>
  );
}
