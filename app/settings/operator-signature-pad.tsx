"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveOperatorSignature } from "@/app/actions/settings";

export function OperatorSignaturePad({ currentSignatureUrl }: { currentSignatureUrl: string | null }) {
  const router = useRouter();
  const [showPad, setShowPad] = useState(false);
  const [signature, setSignature] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const acknowledgementRef = useRef<HTMLInputElement>(null);
  const drawing = useRef(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function startDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const ctx = canvas.getContext("2d");
    const pt = point(event);
    ctx?.beginPath();
    ctx?.moveTo(pt.x, pt.y);
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pt = point(event);
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#10252b";
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  }

  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignature(canvas.toDataURL("image/png", 0.72));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  }

  function handleSave() {
    if (!signature) {
      setMessage("Please draw your signature before saving.");
      return;
    }
    if (!acknowledgementRef.current?.checked) {
      setMessage("Please accept the signature authorisation before saving.");
      return;
    }
    setMessage(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("signature_data_url", signature);
        fd.set("signature_authorisation_acknowledged", "true");
        await saveOperatorSignature(fd);
        setShowPad(false);
        setSignature("");
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to save signature.");
      }
    });
  }

  function handleRemove() {
    setMessage(null);
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("remove_signature", "true");
        await saveOperatorSignature(fd);
        router.refresh();
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Failed to remove signature.");
      }
    });
  }

  if (currentSignatureUrl && !showPad) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <img
            alt="Operator signature"
            className="h-12 max-w-[140px] rounded-lg border border-[var(--border)] bg-white object-contain p-1.5"
            src={currentSignatureUrl}
          />
          <div>
            <p className="text-[13px] font-bold text-[#172026]">Operator signature</p>
            <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">Auto-applied to all new contracts.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="secondary-action w-full sm:w-auto" disabled={isPending} onClick={handleRemove} type="button">
            {isPending ? "Removing..." : "Remove"}
          </button>
          <button className="primary-action w-full sm:w-auto" disabled={isPending} onClick={() => setShowPad(true)} type="button">
            Replace
          </button>
        </div>
        {message ? <p className="mt-1 w-full text-xs text-[#dc2626]">{message}</p> : null}
      </div>
    );
  }

  if (!showPad) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-[#ecfeff] text-[#0e7490]">
            <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="24">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
            </svg>
          </div>
          <div>
            <p className="text-[13px] font-bold text-[#172026]">Add your operator signature</p>
            <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">Draw once — auto-applied to all new contracts.</p>
          </div>
        </div>
        <button className="primary-action w-full sm:w-auto" onClick={() => setShowPad(true)} type="button">
          Add signature
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-bold text-[#172026]">Draw your signature</p>
        <button className="pressable rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-xs font-bold text-[#344054]" onClick={clearSignature} type="button">
          Clear
        </button>
      </div>
      <canvas
        className="h-36 w-full touch-none rounded-xl border border-[#d6e5e2] bg-white"
        height={180}
        onPointerCancel={endDraw}
        onPointerDown={startDraw}
        onPointerLeave={endDraw}
        onPointerMove={moveDraw}
        onPointerUp={endDraw}
        ref={canvasRef}
        width={560}
      />
      {message ? <p className="mt-2 text-xs text-[#dc2626]">{message}</p> : null}
      <label className="mt-3 flex items-start gap-2 rounded-lg border border-[#d6e5e2] bg-white p-2 text-[11px] leading-4 text-[#344054]">
        <input className="mt-0.5" ref={acknowledgementRef} type="checkbox" />
        <span>
          I authorise this electronic signature to be applied to rental agreements and related rental documents issued by this business through authorised users of this RouteHQ account.
        </span>
      </label>
      <div className="mt-3 flex gap-2">
        <button
          className="secondary-action flex-1"
          disabled={isPending}
          onClick={() => {
            setShowPad(false);
            setSignature("");
            setMessage(null);
          }}
          type="button"
        >
          Cancel
        </button>
        <button className="primary-action flex-1" disabled={isPending} onClick={handleSave} type="button">
          {isPending ? "Saving..." : "Save signature"}
        </button>
      </div>
    </div>
  );
}
