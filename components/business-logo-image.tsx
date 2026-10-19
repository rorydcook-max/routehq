"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";

/** The same file keeps the same src even when a fresh signed token arrives: no reload, no blink. */
function stableKey(src: string) {
  return src.split("?")[0];
}

export function BusinessLogoImage({
  alt,
  className,
  src,
  fallback
}: {
  alt: string;
  className?: string;
  src: string | null | undefined;
  fallback?: ReactNode;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  // First src wins for a given file; later renders with only a new token are ignored.
  const srcRef = useRef<string | null>(src || null);
  if (src && (!srcRef.current || stableKey(src) !== stableKey(srcRef.current))) {
    srcRef.current = src;
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
        onError={() => setFailed(true)}
        onLoad={() => setLoaded(true)}
        ref={(node) => {
          // Cached files fire no load event once hydrated: read the flag straight off the element.
          if (node && node.complete && node.naturalWidth > 0 && !loaded) setLoaded(true);
        }}
        src={effectiveSrc}
      />
    </>
  );
}
