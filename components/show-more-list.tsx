"use client";

import { Children, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

/**
 * A long list shown a few at a time (Rory, 2 Nov 2026: a car's money in & out scrolled forever on a phone): the first
 * `first` items, then `step` more each tap.
 */
export function ShowMoreList({ children, first = 8, step = 10, className }: { children: ReactNode; first?: number; step?: number; className?: string }) {
  const t = useTranslations("common");
  const items = Children.toArray(children);
  const [shown, setShown] = useState(first);
  const left = items.length - shown;
  return (
    <div className={className}>
      {items.slice(0, shown)}
      {left > 0 ? (
        <button className="secondary-action pressable w-full justify-center" onClick={() => setShown((count) => count + step)} type="button">
          {t("showMore", { count: Math.min(step, left), left })}
        </button>
      ) : null}
    </div>
  );
}
