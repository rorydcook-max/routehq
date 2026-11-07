import { useId, type CSSProperties } from "react";
import type { ArtId } from "@/lib/sites/images";

/**
 * The website's built-in artwork (lib/sites/images.ts, "art"): scenes drawn as SVG in the page's own colours, so they
 * match any palette, weigh almost nothing and never shift the layout. Used behind the hero when there is no photo,
 * and offered in the editor's image library. Each fills its box (like object-fit: cover).
 */

const W = 1600;
const H = 1000;
const mix = (a: string, b: string, pct: number): CSSProperties => ({ fill: `color-mix(in oklab, ${a} ${pct}%, ${b})` });
const ACCENT = "var(--s-accent)";
const BG = "var(--s-bg)";
const INK = "var(--s-ink)";
const SOFT = "var(--s-accent-soft)";

/** A smooth wave across the whole width, closed down to the bottom. */
function wave(y: number, amp: number, length: number, phase = 0) {
  const parts = [`M ${-length + phase} ${y}`, `Q ${-length * 0.75 + phase} ${y - amp} ${-length / 2 + phase} ${y}`];
  for (let x = -length / 2 + phase; x < W + length; x += length / 2) parts.push(`T ${x + length / 2} ${y}`);
  return `${parts.join(" ")} L ${W + length} ${H} L ${-length} ${H} Z`;
}

/** A closed, gently wobbling ring for the contour map. */
function ring(cx: number, cy: number, r: number, wobble: number, seed: number) {
  const points: string[] = [];
  const steps = 48;
  for (let i = 0; i <= steps; i += 1) {
    const a = (i / steps) * Math.PI * 2;
    const rr = r + Math.sin(a * 3 + seed) * wobble + Math.cos(a * 5 + seed * 1.7) * wobble * 0.6;
    points.push(`${(cx + Math.cos(a) * rr * 1.35).toFixed(1)} ${(cy + Math.sin(a) * rr).toFixed(1)}`);
  }
  return `M ${points.join(" L ")} Z`;
}

function Tide({ u }: { u: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${u}-tide-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${SOFT} 70%, ${BG})` }} />
          <stop offset="1" style={{ stopColor: BG }} />
        </linearGradient>
      </defs>
      <rect height={H} style={{ fill: `url(#${u}-tide-sky)` }} width={W} />
      <circle cx="1220" cy="560" r="140" style={mix(ACCENT, BG, 30)} />
      <path d={wave(690, 22, 520, 40)} style={mix(ACCENT, BG, 22)} />
      <path d={wave(760, 26, 600, 210)} style={mix(ACCENT, BG, 42)} />
      <path d={wave(840, 28, 680, 90)} style={mix(ACCENT, INK, 82)} />
      <path d={wave(920, 24, 760, 330)} style={mix(ACCENT, INK, 58)} />
    </>
  );
}

function Dunes({ u }: { u: string }) {
  return (
    <>
      <rect height={H} style={mix(SOFT, BG, 60)} width={W} />
      <circle cx="1240" cy="520" r="110" style={mix(ACCENT, BG, 45)} />
      <path d="M0 720 C 300 600 620 640 900 700 S 1400 730 1600 640 L1600 1000 L0 1000 Z" style={mix(ACCENT, BG, 26)} />
      <path d="M0 800 C 360 700 700 730 1000 790 S 1420 820 1600 770 L1600 1000 L0 1000 Z" style={mix(ACCENT, BG, 48)} />
      <path d="M0 890 C 420 820 820 850 1120 900 S 1460 920 1600 890 L1600 1000 L0 1000 Z" style={mix(ACCENT, INK, 70)} />
    </>
  );
}

function Sun({ u }: { u: string }) {
  const stripes = [0, 1, 2, 3, 4, 5];
  return (
    <>
      <defs>
        <linearGradient id={`${u}-sun-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${SOFT} 70%, ${BG})` }} />
          <stop offset="0.62" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 45%, ${BG})` }} />
        </linearGradient>
        <clipPath id={`${u}-sun-clip`}>
          <rect height="620" width={W} />
        </clipPath>
      </defs>
      <rect height={H} style={{ fill: `url(#${u}-sun-sky)` }} width={W} />
      <g clipPath={`url(#${u}-sun-clip)`}>
        <circle cx="800" cy="600" r="300" style={mix(SOFT, BG, 85)} />
        {stripes.map((i) => (
          <rect height={6 + i * 4} key={i} style={{ fill: `color-mix(in oklab, ${ACCENT} 55%, ${BG})` }} width={W} y={430 + i * 32} />
        ))}
      </g>
      <rect height={H - 620} style={mix(ACCENT, INK, 55)} width={W} y="620" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect height="4" key={i} rx="2" style={mix(SOFT, BG, 60)} width={420 - i * 70} x={800 - (420 - i * 70) / 2} y={660 + i * 44} />
      ))}
    </>
  );
}

function Road({ u }: { u: string }) {
  const dashes = [0, 1, 2, 3, 4, 5, 6];
  return (
    <>
      <defs>
        <linearGradient id={`${u}-road-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 18%, ${BG})` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 55%, ${BG})` }} />
        </linearGradient>
      </defs>
      <rect height="560" style={{ fill: `url(#${u}-road-sky)` }} width={W} />
      <circle cx="1220" cy="400" r="120" style={mix(ACCENT, BG, 90)} />
      <path d="M0 560 L 260 430 L 470 520 L 700 380 L 980 540 L 1240 450 L 1600 560 Z" style={mix(ACCENT, INK, 35)} />
      <rect height={H - 560} style={mix(INK, BG, 82)} width={W} y="560" />
      <path d="M 760 560 L 840 560 L 1500 1000 L 100 1000 Z" style={mix(INK, BG, 94)} />
      {dashes.map((i) => {
        const t0 = i / dashes.length;
        const t1 = t0 + 0.06;
        const y0 = 560 + (H - 560) * t0 ** 1.6;
        const y1 = 560 + (H - 560) * t1 ** 1.6;
        const w0 = 2 + 22 * t0;
        const w1 = 2 + 22 * t1;
        return <path d={`M ${800 - w0 / 2} ${y0} L ${800 + w0 / 2} ${y0} L ${800 + w1 / 2} ${y1} L ${800 - w1 / 2} ${y1} Z`} key={i} style={{ fill: ACCENT }} />;
      })}
    </>
  );
}

function Contour({ u }: { u: string }) {
  const rings = Array.from({ length: 11 }, (_, i) => i);
  return (
    <>
      <rect height={H} style={mix(SOFT, BG, 45)} width={W} />
      <g fill="none" strokeWidth="2.2" style={{ stroke: `color-mix(in oklab, ${ACCENT} 45%, ${BG})` }}>
        {rings.map((i) => (
          <path d={ring(1080, 470, 60 + i * 52, 10 + i * 3, 1.3)} key={`a${i}`} />
        ))}
        {rings.slice(0, 7).map((i) => (
          <path d={ring(260, 860, 50 + i * 48, 8 + i * 3, 4.1)} key={`b${i}`} />
        ))}
      </g>
      <path d={ring(1080, 470, 46, 8, 1.3)} style={{ fill: ACCENT }} />
    </>
  );
}

function Bloom({ u }: { u: string }) {
  const spots = [
    { cx: 1300, cy: 820, r: 560, a: ACCENT, pct: 60 },
    { cx: 1250, cy: 260, r: 480, a: SOFT, pct: 95 },
    { cx: 500, cy: 980, r: 520, a: ACCENT, pct: 40 },
    { cx: 200, cy: 980, r: 420, a: INK, pct: 25 }
  ];
  return (
    <>
      <defs>
        {spots.map((spot, i) => (
          <radialGradient id={`${u}-bloom-${i}`} key={i}>
            <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${spot.a} ${spot.pct}%, ${BG})`, stopOpacity: 0.95 }} />
            <stop offset="1" style={{ stopColor: BG, stopOpacity: 0 }} />
          </radialGradient>
        ))}
      </defs>
      <rect height={H} style={{ fill: BG }} width={W} />
      {spots.map((spot, i) => (
        <circle cx={spot.cx} cy={spot.cy} key={i} r={spot.r} style={{ fill: `url(#${u}-bloom-${i})` }} />
      ))}
    </>
  );
}

const SCENES: Record<ArtId, (props: { u: string }) => React.JSX.Element> = { tide: Tide, dunes: Dunes, sun: Sun, road: Road, contour: Contour, bloom: Bloom };

export function SiteArt({ id, className = "" }: { id: ArtId; className?: string }) {
  const Scene = SCENES[id] || Tide;
  const u = `art${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg aria-hidden="true" className={className} focusable="false" preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      <Scene u={u} />
    </svg>
  );
}
