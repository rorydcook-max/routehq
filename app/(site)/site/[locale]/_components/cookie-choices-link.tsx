"use client";

import { openConsentChoices } from "@/lib/consent";

/** "Cookie choices" in the footer: opens the cookie notice again so a visitor can change their mind. */
export function CookieChoicesLink({ className, label }: { className?: string; label: string }) {
  return (
    <button className={className} onClick={() => openConsentChoices()} type="button">
      {label}
    </button>
  );
}
