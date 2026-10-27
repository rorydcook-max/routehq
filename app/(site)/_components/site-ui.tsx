import type { Route } from "next";
import Link from "next/link";
import type { MouseEventHandler, ReactNode } from "react";
import s from "../site.module.css";

/** Website addresses as typed routes (the marketing pages are new, so their route types may not be generated yet). */
export const r = (path: string) => path as Route;

/** Website pages that open each other in place. */
const IN_SITE = new Set(["/pricing", "/owners"]);

/**
 * A link from the website. Between website pages it opens in place; anywhere else (the app's sign-in, the directory,
 * "/" which is the dashboard once signed in) it is a normal page load, because the root layout, which holds the app's
 * words, is not drawn again on an in-place change and the website sends none.
 */
export function SiteLink({
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
}) {
  if (IN_SITE.has(href.split(/[?#]/)[0])) {
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
  owners: "/owners",
  directory: "/rent",
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

/** A deliberate line break in a headline (<br></br> in the string), kept only from 640px up; narrower screens wrap naturally. */
export function Br() {
  return <br className={s.br} />;
}

/** The tags a headline string may use: t.rich("key", RICH). */
export const RICH = { hl: Hl, br: Br };

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
