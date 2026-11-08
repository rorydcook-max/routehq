import s from "../rove.module.css";

/**
 * Rove's logo (task rove-design-2, 8 Nov 2026): RoveHQ's R mark with its wedge, and "Rove". Drawn here, in Rove's own
 * colours, instead of with the shared RouteHqLogo: that one takes its ink from --logo-ink, which the app's dark theme
 * turns pale mint, so on a phone in dark mode the logo all but vanished on Rove's light page. Here the colours are
 * fixed by tone: "dark" (white R and word, coral wedge) for the night header and footer, "light" (ink R and word,
 * coral wedge) for light surfaces.
 */
export function RoveLogo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className={tone === "dark" ? `${s.logo} ${s.logoOnDark}` : s.logo}>
      <svg aria-hidden="true" className={s.logoMark} viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg">
        <path className={s.logoWedge} d="M9 47.5 9 32.5 26.5 50H11.5A2.5 2.5 0 0 1 9 47.5Z" />
        <path
          className={s.logoR}
          d="M8 15.5h35.5c7.8 0 12.8 4.6 12.8 11.3 0 6.1-4 10.4-10.3 11.1L57.5 50H41.6L29.4 36.8h10.9c3.5 0 5.8-1.8 5.8-4.9 0-3-2.3-4.8-5.8-4.8H19.6L8 15.5Z"
        />
      </svg>
      <span className={s.logoWord}>Rove</span>
    </span>
  );
}
