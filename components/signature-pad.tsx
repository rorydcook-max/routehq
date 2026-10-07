"use client";

import { useRef, useState } from "react";

/**
 * Sign with a finger (or a mouse). Gives back a PNG with a clear background,
 * so the signature sits cleanly on the white agreement, or "" when cleared.
 */
export function SignaturePad({ onChange, hint, clearLabel }: { onChange: (dataUrl: string) => void; hint: string; clearLabel: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  }

  function finish() {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setSigned(true);
      onChange(canvas.toDataURL("image/png"));
    }
  }

  return (
    <div>
      <div className="relative">
        <canvas
          className="h-44 w-full touch-none rounded-xl border-2 border-dashed border-[var(--border-strong,var(--border))] bg-white"
          height={280}
          onPointerDown={(event) => {
            const context = canvasRef.current?.getContext("2d");
            if (!context) return;
            event.currentTarget.setPointerCapture(event.pointerId);
            drawing.current = true;
            const { x, y } = point(event);
            context.lineWidth = 4;
            context.lineCap = "round";
            context.lineJoin = "round";
            context.strokeStyle = "#14233a";
            context.beginPath();
            context.moveTo(x, y);
            // A dot for a tap, so a short mark is not lost.
            context.lineTo(x + 0.1, y + 0.1);
            context.stroke();
          }}
          onPointerLeave={finish}
          onPointerMove={(event) => {
            if (!drawing.current) return;
            const context = canvasRef.current?.getContext("2d");
            if (!context) return;
            const { x, y } = point(event);
            context.lineTo(x, y);
            context.stroke();
          }}
          onPointerUp={finish}
          ref={canvasRef}
          width={800}
        />
        {!signed ? <p className="pointer-events-none absolute inset-0 flex items-center justify-center font-semibold text-[var(--foreground-secondary)]">{hint}</p> : null}
      </div>
      {signed ? (
        <button
          className="pressable mt-1 min-h-11 px-1 font-bold text-[var(--primary)]"
          onClick={() => {
            const canvas = canvasRef.current;
            canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
            setSigned(false);
            onChange("");
          }}
          type="button"
        >
          {clearLabel}
        </button>
      ) : null}
    </div>
  );
}
