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

/** The page column every section uses: 1200px, with a 16px gutter on phones. */
export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1200px] px-4 sm:px-6 lg:px-8 ${className}`}>{children}</div>;
}

export function SectionHeading({
  eyebrow,
  title,
  body,
  align = "center",
  id
}: {
  eyebrow?: string;
  title: string;
  body?: string;
  align?: "center" | "start";
  id?: string;
}) {
  return (
    <div className={align === "center" ? "mx-auto max-w-[720px] text-center" : "max-w-[640px]"}>
      {eyebrow ? <p className={s.eyebrow}>{eyebrow}</p> : null}
      <h2 className={`${s.display} mt-3 text-[2rem] text-[var(--foreground)] sm:text-[2.6rem]`} id={id}>
        {title}
      </h2>
      {body ? <p className={`${s.lede} mt-4 text-[1.0625rem] leading-relaxed text-[var(--muted)] sm:text-[1.125rem]`}>{body}</p> : null}
    </div>
  );
}
