import type { Route } from "next";
import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import { useLocale } from "next-intl";
import { localizeSitePath } from "@/lib/site/locale-path";
import s from "../site.module.css";

/** Website addresses as typed routes (the marketing pages are new, so their route types may not be generated yet). */
export const r = (path: string) => path as Route;

/** Website pages that open each other in place. */
const IN_SITE = new Set(["/pricing", "/faq", "/contact", "/guides", "/resources"]);
const inSite = (path: string) => IN_SITE.has(path) || path.startsWith("/guides/") || path.startsWith("/resources/");

/**
 * A link from the website. Between website pages it opens in place; anywhere else (the app's sign-in, the directory,
 * "/" which is the dashboard once signed in) it is a normal page load, because the root layout, which holds the app's
 * words, is not drawn again on an in-place change and the website sends none.
 * Website addresses keep the page's language: on /th/pricing, "/faq" becomes "/th/faq" (lib/site/locale-path.ts).
 */
export function SiteLink({ locale: forced, ...props }: Omit<Parameters<typeof SiteAnchor>[0], "inPlace"> & { /** Link to this language's address instead of the page's (an English guide shown on a Thai page). */ locale?: string }) {
  const locale = useLocale();
  return <SiteAnchor {...props} href={localizeSitePath(props.href, forced ?? locale)} inPlace={inSite(props.href.split(/[?#]/)[0])} />;
}

function SiteAnchor({
  inPlace,
  href,
  className,
  children,
  onClick,
  ...aria
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
  "aria-label"?: string;
  "aria-current"?: "page";
  inPlace?: boolean;
}) {
  if (inPlace) {
    return (
      <Link className={className} href={r(href)} onClick={onClick} {...aria}>
        {children}
      </Link>
    );
  }
  return (
    <a className={className} href={href} onClick={onClick} {...aria}>
      {children}
    </a>
  );
}

export const SITE_LINKS = {
  home: "/",
  features: "/home#how",
  pricing: "/pricing",
  faq: "/faq",
  contact: "/contact",
  guides: "/guides",
  resources: "/resources",
  // No link to the renters' booking site (/rent): it is moving to its own consumer brand, and this site speaks to rental businesses.
  signIn: "/login",
  signUp: "/signup"
} as const;

/** The page column every section uses: 1180px, with 24px at the sides (16px on phones). */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${s.container} ${className}`}>{children}</div>;
}

/** A small label naming a section. */
export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`${s.eyebrow} ${className}`}>{children}</p>;
}

/** The phrase a headline leans on: the italic serif, in teal. Used with t.rich("...", { hl: Hl }). */
export function Hl(chunks: ReactNode) {
  return <em className={s.hl}>{chunks}</em>;
}

/**
 * A deliberate line break in a headline (<br></br> in the string), kept only from 640px up; narrower screens wrap
 * naturally. It carries a real space first, so "business,<br></br>for" never reads "business,for" when the break is
 * hidden (Chinese and Japanese, which use no word spaces, hide the space too: see .brSpace).
 */
export function Br() {
  return (
    <>
      <span className={s.brSpace}> </span>
      <br className={s.br} />
    </>
  );
}

/** One phrase in a headline set in teal, same face and weight (<em> in the string). Used once per page at most. */
export function TealWord(chunks: ReactNode) {
  return <span className={s.tealWord}>{chunks}</span>;
}

/**
 * The tags a headline string may use: t.rich("key", RICH). The italic serif belongs to exactly two headlines, the home
 * hero and the closing call to action (Rory, 27 Oct), which use RICH_SERIF; everywhere else an <hl> left in a string
 * (an older translation, say) is drawn as plain text.
 */
export const RICH = { hl: (chunks: ReactNode) => chunks, br: Br, em: TealWord };
export const RICH_SERIF = { hl: Hl, br: Br, em: TealWord };

/** The arrow after a link, turned round for right-to-left languages. */
export function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className={s.arrow} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** A small check beside a line that is true. */
export function Check({ size = 16 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className={s.check} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" viewBox="0 0 24 24" width={size}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/** The plus on a closed question. */
export function Plus({ size = 20 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className={s.plus} fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
