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
/** Suns and moons: the palette's secondary (the accent itself for palettes from before 7 Nov 2026). */
const SECOND = "var(--s-second)";

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
      <circle cx="1220" cy="560" r="140" style={mix(SECOND, BG, 30)} />
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
      <circle cx="1240" cy="520" r="110" style={mix(SECOND, BG, 45)} />
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
      <circle cx="1220" cy="400" r="120" style={mix(SECOND, BG, 90)} />
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

/* Phase 2 (sites2) scenes. */

/** One palm: a curved trunk and fronds fanning from the crown. */
function palm(x: number, base: number, height: number, lean: number, key: string, style: CSSProperties) {
  const cx = x + lean;
  const cy = base - height;
  const trunk = `M ${x - 13} ${base} Q ${x + lean * 0.25 - 11} ${base - height * 0.55} ${cx - 6} ${cy} L ${cx + 6} ${cy} Q ${x + lean * 0.25 + 11} ${base - height * 0.55} ${x + 13} ${base} Z`;
  const length = height * 0.48;
  const leaf = `M 0 0 Q ${length * 0.5} ${-length * 0.3} ${length} ${length * 0.16} Q ${length * 0.5} ${-length * 0.05} 0 0 Z`;
  return (
    <g key={key} style={style}>
      <path d={trunk} />
      {[-200, -160, -125, -95, -55, -20, 15].map((angle) => (
        <path d={leaf} key={angle} transform={`translate(${cx} ${cy}) rotate(${angle})`} />
      ))}
    </g>
  );
}

function Palms({ u }: { u: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${u}-palms-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${SOFT} 80%, ${BG})` }} />
          <stop offset="0.7" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 18%, ${BG})` }} />
        </linearGradient>
      </defs>
      <rect height={H} style={{ fill: `url(#${u}-palms-sky)` }} width={W} />
      <circle cx="1040" cy="610" r="190" style={mix(SECOND, BG, 38)} />
      <rect height="160" style={mix(ACCENT, BG, 55)} width={W} y="700" />
      <path d={wave(780, 10, 380, 60)} style={mix(ACCENT, INK, 70)} />
      <path d="M0 880 C 400 840 900 860 1600 830 L1600 1000 L0 1000 Z" style={mix(SOFT, BG, 90)} />
      {palm(240, 900, 560, 90, "a", mix(ACCENT, INK, 28))}
      {palm(420, 920, 420, -70, "b", mix(ACCENT, INK, 40))}
      {palm(1420, 910, 600, -120, "c", mix(ACCENT, INK, 28))}
    </>
  );
}

function Arches({ u }: { u: string }) {
  const openings = [170, 620, 1070].map((x) => `M ${x} 1000 L ${x} 430 A 180 180 0 0 1 ${x + 360} 430 L ${x + 360} 1000 Z`);
  return (
    <>
      <defs>
        <linearGradient id={`${u}-arch-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 30%, ${BG})` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${SOFT} 70%, ${BG})` }} />
        </linearGradient>
      </defs>
      <rect height="640" style={{ fill: `url(#${u}-arch-sky)` }} width={W} />
      <circle cx="1250" cy="430" r="90" style={mix(SOFT, BG, 80)} />
      <rect height="360" style={mix(ACCENT, INK, 78)} width={W} y="640" />
      {[0, 1, 2, 3].map((i) => (
        <rect height="3" key={i} style={mix(SOFT, BG, 55)} width={300 - i * 50} x={300 + i * 330} y={690 + i * 46} />
      ))}
      <path d={`M0 0 H${W} V${H} H0 Z ${openings.join(" ")}`} fillRule="evenodd" style={{ fill: `color-mix(in oklab, ${SOFT} 45%, var(--s-surface))` }} />
      {[170, 620, 1070].map((x) => (
        <path d={`M ${x} 1000 L ${x} 430 A 180 180 0 0 1 ${x + 360} 430`} fill="none" key={x} strokeWidth="10" style={{ stroke: `color-mix(in oklab, ${INK} 10%, var(--s-surface))` }} />
      ))}
      <rect height="70" style={mix(ACCENT, BG, 22)} width={W} y="930" />
      {/* Potted plants between the arches. */}
      {[575, 1025].map((x) => (
        <g key={x}>
          <path d={`M ${x - 26} 860 L ${x + 26} 860 L ${x + 18} 930 L ${x - 18} 930 Z`} style={mix(ACCENT, INK, 55)} />
          <circle cx={x} cy="830" r="38" style={mix(ACCENT, SOFT, 40)} />
        </g>
      ))}
    </>
  );
}

function Groove({ u }: { u: string }) {
  const bands = [
    { r: 980, style: mix(ACCENT, INK, 72) },
    { r: 830, style: { fill: ACCENT } },
    { r: 690, style: mix(ACCENT, BG, 55) },
    { r: 560, style: mix(SOFT, BG, 90) },
    { r: 430, style: mix(ACCENT, BG, 30) }
  ];
  return (
    <>
      <rect height={H} style={mix(SOFT, BG, 45)} width={W} />
      <g data-scene={u}>
        {bands.map((band) => (
          <circle cx="800" cy="1060" key={band.r} r={band.r} style={band.style} />
        ))}
      </g>
      <circle cx="800" cy="820" r="170" style={mix(ACCENT, INK, 88)} />
      {[0, 1, 2].map((i) => (
        <rect height={10 + i * 4} key={i} style={mix(ACCENT, BG, 30)} width="420" x="590" y={820 + i * 44} />
      ))}
    </>
  );
}

/** A small fixed "random" from a seed, so the skyline is the same on server and browser. */
const rand = (seed: number) => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

function City({ u }: { u: string }) {
  // Whole numbers, so the server and the browser write exactly the same SVG.
  const back = Array.from({ length: 14 }, (_, i) => ({ x: i * 120 - 20, w: 110, h: Math.round(260 + rand(i + 3) * 300) }));
  const front = Array.from({ length: 10 }, (_, i) => ({ x: i * 170 - 30, w: 150, h: Math.round(180 + rand(i + 40) * 330) }));
  return (
    <>
      <defs>
        <linearGradient id={`${u}-city-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: BG }} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 40%, ${BG})` }} />
        </linearGradient>
      </defs>
      <rect height={H} style={{ fill: `url(#${u}-city-sky)` }} width={W} />
      <circle cx="1260" cy="220" r="80" style={mix(SOFT, BG, 70)} />
      {back.map((b, i) => (
        <rect height={b.h} key={`b${i}`} style={mix(INK, BG, 14)} width={b.w} x={b.x} y={860 - b.h} />
      ))}
      {front.map((b, i) => (
        <g key={`f${i}`}>
          <rect height={b.h} style={mix(INK, BG, 26)} width={b.w} x={b.x} y={900 - b.h} />
          {Array.from({ length: Math.floor(b.h / 46) * 3 }, (_, k) => {
            const col = k % 3;
            const row = Math.floor(k / 3);
            return rand(i * 50 + k) > 0.55 ? <rect height="16" key={k} style={{ fill: ACCENT, opacity: 0.85 }} width="22" x={b.x + 22 + col * 40} y={900 - b.h + 24 + row * 46} /> : null;
          })}
        </g>
      ))}
      <rect height="100" style={mix(INK, BG, 8)} width={W} y="900" />
      {[0, 1, 2, 3, 4].map((i) => (
        <rect height="6" key={i} rx="3" style={{ fill: ACCENT }} width={90 + i * 30} x={80 + i * 320} y={945} />
      ))}
    </>
  );
}

function Peaks({ u }: { u: string }) {
  return (
    <>
      <defs>
        <linearGradient id={`${u}-peaks-sky`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: `color-mix(in oklab, ${SOFT} 75%, ${BG})` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in oklab, ${ACCENT} 30%, ${BG})` }} />
        </linearGradient>
      </defs>
      <rect height={H} style={{ fill: `url(#${u}-peaks-sky)` }} width={W} />
      <circle cx="420" cy="330" r="110" style={mix(SECOND, BG, 70)} />
      <path d="M0 620 L 180 470 L 330 560 L 560 330 L 760 520 L 980 300 L 1200 500 L 1400 380 L 1600 520 L1600 1000 L0 1000 Z" style={mix(ACCENT, BG, 28)} />
      <path d="M 560 330 L 610 380 L 580 375 L 545 400 L 520 370 Z M 980 300 L 1040 360 L 1000 352 L 960 380 L 930 345 Z" style={mix(SOFT, BG, 95)} />
      <path d="M0 720 L 240 560 L 420 680 L 700 500 L 960 690 L 1240 540 L 1600 700 L1600 1000 L0 1000 Z" style={mix(ACCENT, INK, 62)} />
      <path d="M0 840 L 300 720 L 620 830 L 900 700 L 1220 820 L 1600 740 L1600 1000 L0 1000 Z" style={mix(ACCENT, INK, 38)} />
      <path d="M 820 1000 C 860 930 760 900 820 860 S 940 820 900 780" fill="none" strokeLinecap="round" strokeWidth="14" style={{ stroke: `color-mix(in oklab, ${SOFT} 70%, ${BG})` }} />
    </>
  );
}

function Ripple({ u }: { u: string }) {
  const set = (cx: number, cy: number) =>
    [58, 44, 30, 16].map((r) => <circle cx={cx} cy={cy} key={`${cx}-${cy}-${r}`} r={r} strokeWidth="3" style={{ fill: `color-mix(in oklab, ${SOFT} 45%, ${BG})`, stroke: `color-mix(in oklab, ${ACCENT} 60%, ${BG})` }} />);
  return (
    <>
      <defs>
        <pattern height="60" id={`${u}-ripple`} patternUnits="userSpaceOnUse" width="120" x="0" y="580">
          {set(0, 0)}
          {set(120, 0)}
          {set(60, 30)}
          {set(0, 60)}
          {set(120, 60)}
        </pattern>
      </defs>
      <rect height={H} style={{ fill: BG }} width={W} />
      <circle cx="1120" cy="330" r="170" style={{ fill: SECOND }} />
      <rect height="2" style={mix(INK, BG, 30)} width={W} y="578" />
      <rect height={H - 580} style={{ fill: `url(#${u}-ripple)` }} width={W} y="580" />
    </>
  );
}

function Grid({ u }: { u: string }) {
  return (
    <>
      <rect height={H} style={mix(SOFT, BG, 35)} width={W} />
      <g data-scene={u} strokeWidth="2" style={{ stroke: `color-mix(in oklab, ${INK} 12%, ${BG})` }}>
        {[200, 400, 600, 800, 1000, 1200, 1400].map((x) => (
          <line key={`x${x}`} x1={x} x2={x} y1="0" y2={H} />
        ))}
        {[200, 400, 600, 800].map((y) => (
          <line key={`y${y}`} x1="0" x2={W} y1={y} y2={y} />
        ))}
      </g>
      <rect height="600" style={mix(INK, BG, 88)} width="400" x="200" y="200" />
      <circle cx="1000" cy="500" r="300" style={{ fill: SECOND }} />
      <path d="M 0 1000 L 0 600 A 400 400 0 0 1 400 1000 Z" style={mix(ACCENT, BG, 45)} />
      <circle cx="1400" cy="800" r="70" style={mix(INK, BG, 88)} />
      <rect height="40" style={mix(SOFT, BG, 95)} width="400" x="800" y="760" />
    </>
  );
}

const SCENES: Record<ArtId, (props: { u: string }) => React.JSX.Element> = {
  tide: Tide,
  dunes: Dunes,
  sun: Sun,
  road: Road,
  contour: Contour,
  bloom: Bloom,
  palms: Palms,
  arches: Arches,
  groove: Groove,
  city: City,
  peaks: Peaks,
  ripple: Ripple,
  grid: Grid
};

export function SiteArt({ id, className = "" }: { id: ArtId; className?: string }) {
  const Scene = SCENES[id] || Tide;
  const u = `art${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <svg aria-hidden="true" className={className} focusable="false" preserveAspectRatio="xMidYMid slice" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg">
      <Scene u={u} />
    </svg>
  );
}
