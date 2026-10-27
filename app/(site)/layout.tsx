import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import s from "./site.module.css";

/**
 * RouteHQ's public website: the home page signed-out visitors see at "/" (proxy.ts rewrites "/" to /home for them),
 * /pricing and /owners. Server-rendered, light, and in the visitor's language (the same choice the sign-in pages use).
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const t = await getTranslations("site");
  return (
    <div className={s.site}>
      <a className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:shadow" href="#main">
        {t("skipToContent")}
      </a>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </div>
  );
}
