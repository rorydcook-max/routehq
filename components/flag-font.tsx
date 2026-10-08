"use client";

import { useEffect } from "react";
import { polyfillCountryFlagEmojis } from "country-flag-emoji-polyfill";

/**
 * Windows has no flag emoji, so a customer's nationality showed as two letters
 * ("TH", "IT"). This loads a small flags-only font where the system has none.
 */
export function FlagFont() {
  useEffect(() => {
    polyfillCountryFlagEmojis("Twemoji Country Flags", "/fonts/TwemojiCountryFlags.woff2");
  }, []);
  return null;
}
