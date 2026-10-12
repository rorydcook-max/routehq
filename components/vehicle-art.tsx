import type { VehicleKind } from "@/lib/vehicle-groups";

/**
 * A picture of the vehicle (Lagoon look, Oct 2026): a simple side-on drawing in
 * the vehicle's own paint colour, on a tint of it. Cars, SUVs, pick-ups and
 * vans are told apart by the model ("Fortuner" is an SUV, "Hilux" a pick-up).
 * A real photo, when there is one, takes its place.
 */

type Shape = "car" | "suv" | "pickup" | "van" | "scooter" | "motorbike";

const PAINT: Array<[RegExp, string]> = [
  [/white|ขาว|pearl|ไข่มุก/i, "#f5f7f8"],
  [/silver|เงิน|บรอนซ์/i, "#a7b0b8"],
  [/grey|gray|เทา/i, "#7d8790"],
  [/black|ดำ/i, "#2b3036"],
  [/navy|กรม/i, "#26385e"],
  [/light blue|sky|ฟ้า/i, "#5aa9d6"],
  [/blue|น้ำเงิน/i, "#2f5d9c"],
  [/red|แดง|maroon|เลือดหมู/i, "#c0392b"],
  [/orange|ส้ม/i, "#e07a3a"],
  [/yellow|เหลือง/i, "#e6b422"],
  [/gold|ทอง|champagne/i, "#c9a24a"],
  [/green|เขียว/i, "#3f7d5a"],
  [/brown|น้ำตาล|bronze/i, "#7a5a40"],
  [/purple|ม่วง/i, "#6b4c8a"],
  [/pink|ชมพู/i, "#d97a9a"]
];

export function paintOf(colour: string | null | undefined) {
  const text = String(colour || "");
  return PAINT.find(([pattern]) => pattern.test(text))?.[1] || null;
}

function shapeOf(kind: VehicleKind, model: string) {
  if (kind === "scooter" || kind === "ebike") return "scooter";
  if (kind === "motorbike" || kind === "atv") return "motorbike";
  if (kind === "van" || /commuter|hiace|h-?1\b|alphard|staria|carnival|vellfire/i.test(model)) return "van";
  if (/hilux|revo|vigo|ranger|d-?max|navara|triton|bt-?50|raptor/i.test(model)) return "pickup";
  if (/fortuner|pajero|everest|mu-?x|cr-?v|hr-?v|cx-?[3589]|xpander|terra|veloz|innova|sienta|land cruiser|prado|tucson|santa fe|outlander|x-?trail|ertiga|br-?v|wr-?v|corolla cross|yaris cross|ativ/i.test(model)) return "suv";
  return "car";
}

function mixWithWhite(hex: string, amount: number) {
  const value = hex.replace("#", "");
  const parts = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
  return `#${parts.map((part) => Math.round(part + (255 - part) * amount).toString(16).padStart(2, "0")).join("")}`;
}

function isPale(hex: string) {
  const value = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((at) => parseInt(value.slice(at, at + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 200;
}

const BOX = {
  sm: "h-11 w-14 rounded-xl",
  md: "h-[74px] w-[104px] rounded-2xl",
  lg: "h-28 w-full rounded-[20px]",
  xl: "h-full min-h-[190px] w-full rounded-2xl"
} as const;

const ART = { sm: 48, md: 88, lg: 150, xl: 230 } as const;

export function VehicleArt({
  kind,
  model = "",
  colour,
  photoUrl,
  size = "md",
  className = ""
}: {
  kind: VehicleKind;
  model?: string | null;
  colour?: string | null;
  photoUrl?: string | null;
  size?: keyof typeof BOX;
  className?: string;
}) {
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt="" className={`${BOX[size]} flex-shrink-0 object-cover ${className}`} src={photoUrl} />;
  }
  const known = paintOf(colour);
  const paint = known || "var(--primary)";
  const pale = known ? isPale(known) : false;
  const dark = known ? !pale && parseInt(known.slice(1, 3), 16) < 70 : false;
  // White and black vehicles sit on the neutral aqua; coloured ones on a tint of their own paint.
  const backdrop = !known ? "var(--primary-light)" : pale || dark || known === "#a7b0b8" || known === "#7d8790" ? "#e3eeec" : mixWithWhite(known, 0.82);
  const glass = pale ? "#9fb3bb" : "#e8f1f2";
  const outline = pale ? "#9fb3bb" : "none";
  const shape: Shape = shapeOf(kind, String(model || ""));
  const width = ART[size];
  return (
    <span aria-hidden="true" className={`inline-flex flex-shrink-0 items-center justify-center ${BOX[size]} ${className}`} style={{ background: backdrop }}>
      <svg height={width / 2} viewBox="0 0 120 60" width={width}>
        {shape === "car" ? (
          <>
            <path d="M8 44 L16 29 Q22 20 36 19 L76 19 Q88 19 96 28 L106 33 Q113 35 113 42 L113 46 L8 46 Z" stroke={outline} strokeWidth="1.5" style={{ fill: paint }} />
            <path d="M28 30 L36 22 L56 22 L56 30 Z M60 22 L76 22 Q84 22 89 30 L60 30 Z" fill={glass} />
          </>
        ) : shape === "suv" ? (
          <>
            <path d="M6 44 L12 26 Q16 16 30 15 L84 15 Q96 15 102 24 L110 30 Q115 33 115 40 L115 46 L6 46 Z" stroke={outline} strokeWidth="1.5" style={{ fill: paint }} />
            <path d="M24 28 L30 19 L54 19 L54 28 Z M58 19 L82 19 Q90 19 95 28 L58 28 Z" fill={glass} />
          </>
        ) : shape === "pickup" ? (
          <>
            <path d="M6 46 L6 30 L58 30 L58 46 Z M58 46 L58 22 Q60 15 70 15 L88 15 Q96 15 102 24 L110 30 Q115 33 115 40 L115 46 Z" stroke={outline} strokeWidth="1.5" style={{ fill: paint }} />
            <path d="M65 28 L69 19 L86 19 Q92 19 96 28 Z" fill={glass} />
          </>
        ) : shape === "van" ? (
          <>
            <path d="M6 44 L6 18 Q6 12 14 12 L86 12 Q96 12 104 24 L112 30 Q115 33 115 40 L115 46 L6 46 Z" stroke={outline} strokeWidth="1.5" style={{ fill: paint }} />
            <path d="M15 17 h21 v11 h-21 z M41 17 h21 v11 h-21 z M67 17 h17 Q92 17 98 28 L67 28 Z" fill={glass} />
          </>
        ) : shape === "scooter" ? (
          <>
            <path d="M30 42 Q34 28 54 28 L76 28 L84 14 L94 14 L90 28 Q104 30 104 42 Z" stroke={outline} strokeWidth="1.5" style={{ fill: paint }} />
            <rect fill="#13262b" height="7" rx="3" width="24" x="48" y="22" />
          </>
        ) : (
          <>
            <path d="M34 42 Q38 28 56 27 L78 27 L88 16 L95 16 L87 31 Q97 34 99 42 Z" stroke={outline} strokeWidth="1.5" style={{ fill: paint }} />
            <path d="M50 27 Q54 20 66 20 L74 20 Q78 24 76 27 Z" fill="#13262b" />
          </>
        )}
        {shape === "scooter" || shape === "motorbike" ? (
          <>
            <circle cx="24" cy="44" fill="#13262b" r="11" />
            <circle cx="24" cy="44" fill="#ffffff" r="4" />
            <circle cx="96" cy="44" fill="#13262b" r="11" />
            <circle cx="96" cy="44" fill="#ffffff" r="4" />
          </>
        ) : (
          <>
            <circle cx={shape === "pickup" ? 26 : 32} cy="46" fill="#13262b" r={shape === "car" ? 9 : 10} />
            <circle cx={shape === "pickup" ? 26 : 32} cy="46" fill="#ffffff" r="3.5" />
            <circle cx={shape === "pickup" ? 94 : 91} cy="46" fill="#13262b" r={shape === "car" ? 9 : 10} />
            <circle cx={shape === "pickup" ? 94 : 91} cy="46" fill="#ffffff" r="3.5" />
          </>
        )}
      </svg>
    </span>
  );
}
