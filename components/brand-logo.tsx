import { clsx } from "clsx";
import { useId } from "react";

type RouteHqLogoProps = {
  variant?: "full" | "mark";
  /** "dark": on Ink Navy or a photo (white lettering). "light": on white (ink lettering). */
  tone?: "light" | "dark";
  className?: string;
  showDescriptor?: boolean;
  /** "fleet": RoveHQ, the operator software. "keys": Rove, the renter booking site (same mark). */
  product?: "fleet" | "keys";
};

/**
 * The RoveHQ / Rove logo (signed off by Rory, 11 Nov 2026): the folded-ribbon R, with the name in Unbounded Bold
 * drawn as outlines so no font has to load, centred on the height of the R.
 */
export function RouteHqLogo({ className, product = "fleet", tone = "light", variant = "full" }: RouteHqLogoProps) {
  if (variant === "mark") return <RouteHqMark className={clsx("h-9 w-auto", className)} />;
  const rove = product === "keys";
  return (
    <div className={clsx("flex items-center gap-2.5", className)}>
      <RouteHqMark className="h-8 w-auto shrink-0" />
      <svg
        aria-label={rove ? "Rove" : "RoveHQ"}
        className={clsx("h-[15px] w-auto shrink-0 overflow-visible", tone === "dark" ? "text-white" : "text-[var(--logo-ink,#1E1B4B)]")}
        role="img"
        viewBox={`0 0 ${rove ? 413 : 663} 100`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d={rove ? ROVE : ROVE + HQ} fill="currentColor" />
      </svg>
    </div>
  );
}

export function RouteHqMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg aria-hidden="true" className={className} viewBox="175 261 670 491" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={`${id}u`} gradientUnits="userSpaceOnUse" x1="450" y1="190" x2="707" y2="571"><stop offset="0.02" stopColor="#02E1FA" /><stop offset="0.15" stopColor="#04CCFD" /><stop offset="0.27" stopColor="#12A6FD" /><stop offset="0.40" stopColor="#2C86FC" /><stop offset="0.52" stopColor="#4171FC" /><stop offset="0.65" stopColor="#585CFB" /><stop offset="0.77" stopColor="#7940F5" /><stop offset="0.90" stopColor="#9E2EEB" /><stop offset="0.98" stopColor="#B725DF" /></linearGradient>
        <linearGradient id={`${id}l`} gradientUnits="userSpaceOnUse" x1="399" y1="521" x2="252" y2="775"><stop offset="0.02" stopColor="#552AD3" /><stop offset="0.15" stopColor="#6334E3" /><stop offset="0.27" stopColor="#7735E9" /><stop offset="0.40" stopColor="#8F3DF0" /><stop offset="0.52" stopColor="#A746F4" /><stop offset="0.65" stopColor="#BE51F7" /><stop offset="0.77" stopColor="#CE60FA" /><stop offset="0.90" stopColor="#D66FFA" /><stop offset="0.98" stopColor="#D979F6" /></linearGradient>
        <linearGradient id={`${id}r`} gradientUnits="userSpaceOnUse" x1="476" y1="434" x2="786" y2="778"><stop offset="0.02" stopColor="#CB4AE1" /><stop offset="0.15" stopColor="#DF44CF" /><stop offset="0.27" stopColor="#F541AD" /><stop offset="0.40" stopColor="#FC4B8A" /><stop offset="0.52" stopColor="#FD5967" /><stop offset="0.65" stopColor="#FD724A" /><stop offset="0.77" stopColor="#FD9034" /><stop offset="0.90" stopColor="#FCB325" /><stop offset="0.98" stopColor="#F8BF23" /></linearGradient>
        <linearGradient id={`${id}s`} gradientUnits="userSpaceOnUse" x1="478" y1="548" x2="420" y2="606"><stop offset="0" stopColor="#2A0A8F" stopOpacity=".62" /><stop offset=".45" stopColor="#3A12B0" stopOpacity=".3" /><stop offset="1" stopColor="#4A1BC8" stopOpacity="0" /></linearGradient>
        <clipPath id={`${id}c`}><path d={LEFT} /></clipPath>
      </defs>
      <path d={UPPER} fill={`url(#${id}u)`} />
      <path d={LEFT} fill={`url(#${id}l)`} />
      <rect clipPath={`url(#${id}c)`} fill={`url(#${id}s)`} height="200" width="320" x="300" y="480" />
      <path d={RIGHT} fill={`url(#${id}r)`} />
    </svg>
  );
}

const UPPER = "M228.4 411.0 A13 13 0 0 1 218.5 389.5 L320.8 270.7 A28 28 0 0 1 342.0 261.0 L670 261 A152 153 0 0 1 822 414 A152 160 0 0 1 670 574 L600 574 L600 496 L612 496 A42.5 42.5 0 0 0 612 411 Z";
const LEFT = "M338.8 519.4 A66.0 66.0 0 0 1 389.1 496.0 L586.3 496.0 L365.9 743.9 A24.0 24.0 0 0 1 348.0 752.0 L206.6 752.0 A30.0 30.0 0 0 1 183.7 702.6 Z";
const RIGHT = "M337.1 519.4 A66 66 0 0 1 387.5 496 L636.5 496.0 A55.0 55.0 0 0 1 678.7 515.7 L837.7 706.1 A28.0 28.0 0 0 1 816.2 752.0 L645.7 752.0 A9.0 9.0 0 0 1 639.0 749.0 L509.8 603.0 C478 562 452 530 412 518 C392 509 362 506 337.1 519.4 Z";
/** "Rove" in Unbounded Bold, cap height 100. */
const ROVE = "M28.4 43.7H64.8Q71.4 43.7 75.2 40.6Q78.9 37.6 78.9 32.1Q78.9 26.5 75.2 23.5Q71.4 20.5 64.8 20.5H24.5L36.9 7.3V100.0H9.3V0.0H68.6Q80.1 0.0 88.6 4.0Q97.2 8.1 102.0 15.2Q106.8 22.4 106.8 32.1Q106.8 41.6 102.0 48.8Q97.2 56.0 88.6 60.0Q80.1 64.0 68.6 64.0H28.4ZM43.3 53.2H74.4L110.2 100.0H78.2ZM164.1 102.1Q149.4 102.1 138.5 97.1Q127.6 92.1 121.4 83.0Q115.3 73.8 115.3 62.0Q115.3 49.8 121.4 40.8Q127.6 31.7 138.5 26.6Q149.4 21.5 164.1 21.5Q178.6 21.5 189.6 26.6Q200.6 31.7 206.8 40.8Q212.9 49.8 212.9 62.0Q212.9 73.8 206.8 83.0Q200.6 92.1 189.6 97.1Q178.6 102.1 164.1 102.1ZM164.1 82.0Q170.8 82.0 175.5 79.6Q180.2 77.2 182.7 72.6Q185.3 68.1 185.3 62.0Q185.3 55.6 182.7 51.1Q180.2 46.6 175.5 44.2Q170.8 41.8 164.1 41.8Q157.4 41.8 152.6 44.2Q147.8 46.6 145.3 51.1Q142.7 55.6 142.7 61.8Q142.7 68.1 145.3 72.6Q147.8 77.2 152.6 79.6Q157.4 82.0 164.1 82.0ZM271.2 87.0 261.8 86.9 288.2 23.8H317.3L281.7 100.0H250.6L215.0 23.8H245.2ZM367.5 102.1Q353.7 102.1 342.8 97.0Q332.0 92.0 325.7 82.8Q319.4 73.7 319.4 61.6Q319.4 49.7 325.4 40.7Q331.4 31.7 341.9 26.6Q352.4 21.5 365.5 21.5Q379.3 21.5 389.0 27.5Q398.6 33.4 403.9 44.2Q409.2 55.0 409.2 69.7H341.4V53.3H393.8L384.9 59.0Q384.4 53.2 382.0 49.1Q379.5 45.0 375.6 42.9Q371.7 40.8 366.2 40.8Q360.2 40.8 356.0 43.2Q351.7 45.6 349.3 49.8Q346.9 54.0 346.9 59.6Q346.9 66.8 350.1 71.8Q353.4 76.8 359.7 79.4Q366.1 82.1 375.3 82.1Q383.7 82.1 392.0 79.9Q400.4 77.7 407.2 73.7V91.0Q399.3 96.4 389.2 99.2Q379.2 102.1 367.5 102.1Z";
/** "HQ", following on from ROVE. */
const HQ = "M420.6 0.0H448.2V100.0H420.6ZM499.3 0.0H527.0V100.0H499.3ZM436.1 36.9H510.7V61.4H436.1ZM581.4 59.3H614.5L658.0 107.4H624.2ZM598.6 102.1Q580.9 102.1 567.5 95.6Q554.1 89.0 546.7 77.3Q539.3 65.6 539.3 50.0Q539.3 34.4 546.7 22.6Q554.1 10.9 567.5 4.4Q580.9 -2.1 598.6 -2.1Q616.5 -2.1 629.8 4.4Q643.1 10.9 650.6 22.6Q658.1 34.4 658.1 50.0Q658.1 65.6 650.6 77.3Q643.1 89.0 629.8 95.6Q616.5 102.1 598.6 102.1ZM598.6 77.4Q608.4 77.4 615.4 74.1Q622.5 70.8 626.3 64.6Q630.1 58.5 630.1 50.0Q630.1 41.4 626.3 35.3Q622.5 29.2 615.4 25.8Q608.4 22.5 598.6 22.5Q589.0 22.5 582.0 25.8Q574.9 29.2 571.0 35.3Q567.1 41.4 567.1 50.0Q567.1 58.5 571.0 64.6Q574.9 70.8 582.0 74.1Q589.0 77.4 598.6 77.4Z";
