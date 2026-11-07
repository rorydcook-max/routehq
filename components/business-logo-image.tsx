"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/** The same file keeps the same src even when a fresh signed token arrives: no reload, no blink. */
function stableKey(src: string) {
  return src.split("?")[0];
}

/**
 * Across pages too: every page draws its own shell, so each one mounted a new logo with a freshly signed link and the
 * browser downloaded the same file again on every tap. The first link for a file is reused for 45 minutes (links
 * are signed for an hour), then a fresh one is taken.
 */
const LINK_REUSE_MS = 45 * 60_000;
const firstLinks = new Map<string, { src: string; at: number }>();
function reusableLink(src: string) {
  // Browser only: on the server this list would be shared between requests.
  if (typeof window === "undefined") return src;
  const key = stableKey(src);
  const known = firstLinks.get(key);
  if (known && Date.now() - known.at < LINK_REUSE_MS) return known.src;
  firstLinks.set(key, { src, at: Date.now() });
  return src;
}

export function BusinessLogoImage({
  alt,
  className,
  src,
  fallback,
  onSize,
  onFail
}: {
  alt: string;
  className?: string;
  src: string | null | undefined;
  fallback?: ReactNode;
  /** The file's own width and height once it has loaded (the website's top bar decides from it whether to add the name). */
  onSize?: (width: number, height: number) => void;
  /** The file could not be loaded (the fallback shows). */
  onFail?: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // First src wins for a given file; later renders with only a new token are ignored.
  const srcRef = useRef<string | null>(src ? reusableLink(src) : null);
  if (src && (!srcRef.current || stableKey(src) !== stableKey(srcRef.current))) {
    srcRef.current = reusableLink(src);
  }
  const effectiveSrc = srcRef.current;
  const fileKey = effectiveSrc ? stableKey(effectiveSrc) : null;

  // The name steps in only when the file is slow (a quarter second), so a cached logo never blinks text first.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    setFailed(false);
    setLoaded(false);
    setSlow(false);
    const timer = window.setTimeout(() => setSlow(true), 250);
    return () => window.clearTimeout(timer);
  }, [fileKey]);

  const fallbackNode = fallback ?? (
    <div className={`${className || ""} flex items-center justify-center text-[10px] font-bold text-[var(--muted)]`}>
      Logo
    </div>
  );

  if (!effectiveSrc || failed) {
    return <>{fallbackNode}</>;
  }

  // The name shows until the file has painted, so there is never an empty box where the brand belongs.
  return (
    <>
      {!loaded && slow ? fallbackNode : null}
      <img
        alt={alt}
        className={`${className || ""}${loaded ? "" : " hidden"}`}
        onError={() => {
          setFailed(true);
          onFail?.();
        }}
        onLoad={(event) => {
          setLoaded(true);
          onSize?.(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight);
        }}
        ref={(node) => {
          // Cached files fire no load event once hydrated: read the flag straight off the element.
          if (node && node.complete && node.naturalWidth > 0 && !loaded) {
            setLoaded(true);
            onSize?.(node.naturalWidth, node.naturalHeight);
          }
        }}
        src={effectiveSrc}
      />
    </>
  );
}
