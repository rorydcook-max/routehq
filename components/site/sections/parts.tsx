"use client";

import type { ReactNode } from "react";
import type { TextSlot } from "@/lib/sites/config";
import type { TemplateDef } from "@/lib/sites/templates";
import { Txt } from "../site-context";
import s from "../site.module.css";

/** A section's heading (and optional line under it), in the template's display face. */
export function SectionHead({ id, title, sub, align = "start", children }: { id: string; title: TextSlot; sub?: TextSlot; align?: "start" | "center"; children?: ReactNode }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-x-8 gap-y-4 ${align === "center" ? "flex-col items-center text-center" : ""}`}>
      <div className="max-w-[720px]">
        <Txt as="h2" className={`${s.display} text-[36px] sm:text-[48px] lg:text-[56px]`} id={`${id}-title`} slot={title} />
        {sub ? <Txt as="p" className={`${s.soft} mt-3 max-w-[52ch] text-[18px]`} slot={sub} /> : null}
      </div>
      {children}
    </div>
  );
}

/** The template's photo framing as a class: Moto-style slant, arch or printed frame (none for soft and crisp). */
export function imageTreatment(template: TemplateDef) {
  return template.image === "slant" ? s.slant : template.image === "arch" ? s.arch : template.image === "frame" ? s.frame : "";
}

/** Five stars, filled to the rating (read out as "4 out of 5"). */
export function Stars({ rating, label, size = 18 }: { rating: number; label: string; size?: number }) {
  return (
    <span aria-label={label} className="inline-flex gap-0.5" role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <svg aria-hidden="true" height={size} key={n} viewBox="0 0 24 24" width={size}>
          <path
            d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.3L12 17.1l-5.7 3.1 1.2-6.3L2.8 9.5l6.4-.8z"
            style={{ fill: n <= Math.round(rating) ? "var(--s-accent)" : "color-mix(in oklab, var(--s-line) 80%, transparent)" }}
          />
        </svg>
      ))}
    </span>
  );
}
