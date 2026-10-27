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
  features: "/#features",
  pricing: "/pricing",
  owners: "/owners",
  directory: "/rent",
  signIn: "/login",
  signUp: "/signup"
} as const;

/** The page column every section uses: 1240px, with a 16px gutter on phones. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1240px] px-4 sm:px-6 lg:px-10 ${className}`}>{children}</div>;
}

/** A small label naming a section. */
export function Eyebrow({ children, dark = false, className = "" }: { children: ReactNode; dark?: boolean; className?: string }) {
  return <p className={`${s.eyebrow} ${dark ? s.eyebrowDark : ""} ${className}`}>{children}</p>;
}

/** The arrow after a link, turned round for right-to-left languages. */
export function Arrow({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="shrink-0 rtl:-scale-x-100" fill="none" height={size} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width={size}>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}
