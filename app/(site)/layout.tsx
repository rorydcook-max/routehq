import type { ReactNode } from "react";
import { Geist, Instrument_Serif } from "next/font/google";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import s from "./site.module.css";

/* The website's two typefaces, only on the website: Geist for everything, and an italic serif for the one phrase
   a headline leans on. Non-Latin scripts fall through to Anuphan (Thai, self-hosted) and the system. */
const geist = Geist({ subsets: ["latin", "latin-ext"], display: "swap", variable: "--font-site" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: "italic", display: "swap", variable: "--font-site-serif" });

/**
 * RoveHQ's public website: the home page signed-out visitors see at "/" (proxy.ts rewrites "/" to /home for them),
 * /pricing. Server-rendered, in the visitor's language (the same choice the sign-in pages use).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("site");
  return (
    // light-island: the website has its own fixed look, so the app's dark mode (theme-dark.css) leaves it as drawn.
    <div className={`light-island ${s.site} ${geist.variable} ${serif.variable}`}>
      <a className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[#06162b]" href="#main">
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
