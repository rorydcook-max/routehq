"use client";

import type { ReactNode } from "react";
import { useState } from "react";

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

  if (!src || failed) {
    return fallback ?? (
      <div className={`${className || ""} flex items-center justify-center text-[10px] font-bold text-[var(--muted)]`}>
        Logo
      </div>
    );
  }

  return <img alt={alt} className={className} onError={() => setFailed(true)} src={src} />;
}
