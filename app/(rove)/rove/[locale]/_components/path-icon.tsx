import type { CSSProperties } from "react";
import s from "../rove.module.css";

/**
 * A Tabler icon drawn inline (icon-paths.ts), task perf, 8 Nov 2026: the same 24 x 24, 2px-stroke drawing the Tabler
 * webfont's glyphs are made from, without loading the whole 493 KB font on every page. Like the font's <i class="ti ...">, it is an <i>
 * one em square that takes the text's size and colour, so the page's CSS for icons (`.facts i` and so on) still applies.
 * Client components import this with just the outlines they draw (`import { tiSearch } from "./icon-paths"`);
 * server components use <Icon name="..."> (icon.tsx).
 */
export function PathIcon({ d, className, style }: { d: string; className?: string; style?: CSSProperties }) {
  return (
    <i aria-hidden="true" className={className ? `${s.icon} ${className}` : s.icon} style={style}>
      <svg fill="none" focusable="false" height="1em" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} viewBox="0 0 24 24" width="1em">
        <path d={d} />
      </svg>
    </i>
  );
}
