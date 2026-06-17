"use client";

import { useState } from "react";

export function BusinessLogoImage({
  alt,
  className,
  src
}: {
  alt: string;
  className?: string;
  src: string | null | undefined;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`${className || ""} flex items-center justify-center text-[10px] font-bold text-[var(--muted)]`}>
        Logo
      </div>
    );
  }

  return <img alt={alt} className={className} onError={() => setFailed(true)} src={src} />;
}
