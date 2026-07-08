"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, PenLine, X } from "lucide-react";
import { signOperatorContract } from "@/app/actions/contracts";

type OperatorContractSigningProps = {
  contractId: string;
  customerSignedAt: string | null;
  ownerSignedAt: string | null;
  organizationId: string;
  rentalId: string;
  ownerSignatureConfigured?: boolean;
};

export function OperatorContractSigning({
  contractId,
  customerSignedAt,
  ownerSignedAt,
  organizationId,
  rentalId,
  ownerSignatureConfigured = false
}: OperatorContractSigningProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [signature, setSignature] = useState("");
  const [isPending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
    const context = canvas.getContext("2d");
    const current = point(event);
    context?.beginPath();
    context?.moveTo(current.x, current.y);
  }

  function moveDraw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const current = point(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#10252b";
    context.lineTo(current.x, current.y);
    context.stroke();
  }

  function endDraw() {
    drawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) {
      setSignature(canvas.toDataURL("image/png", 0.72));
    }
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!signature) {
      setError("Please sign before submitting.");
      return;
    }

    const form = event.currentTarget;
    startTransition(async () => {
      try {
        const formData = new FormData(form);
        formData.set("signature", signature);
        await signOperatorContract(formData);
        setOpen(false);
        setSignature("");
        router.refresh();
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Unable to sign contract.");
      }
    });
  }

  if (ownerSignedAt) {
    return (
      <div className="rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
        <div className="flex items-center gap-2 font-black text-[#166534]">
          <CheckCircle2 size={18} />
          {ownerSignatureConfigured ? "Auto-signed ✓" : "Operator signed"}
        </div>
        <p className="mt-1 text-sm text-[#667085]">This contract has both required signatures.</p>
      </div>
    );
  }

  if (!customerSignedAt) {
    return (
      <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
        <p className="font-black text-[#92400e]">Waiting for customer signature</p>
        <p className="mt-1 text-sm text-[#667085]">The operator can sign after the customer completes and signs the booking link.</p>
      </div>
    );
  }

  if (ownerSignatureConfigured) {
    return (
      <div className="rounded-lg border border-[#fde68a] bg-[#fffbeb] p-3">
        <p className="font-black text-[#92400e]">Operator signature not yet applied</p>
        <p className="mt-1 text-sm text-[#667085]">
          This booking was created before auto-signing was enabled. The signature has been auto-applied to new bookings.
        </p>
      </div>
    );
  }

  return (
    <>
      <button
        className="pressable inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-[#0f766e] bg-[#eef8f6] px-4 py-3 text-sm font-black text-[#0f766e]"
        onClick={() => setOpen(true)}
        type="button"
      >
        <PenLine size={18} />
        Sign contract as operator
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end bg-[#10252b]/55 p-3 sm:items-center sm:justify-center">
          <form className="w-full max-w-xl rounded-2xl border border-[#d6e5e2] bg-white p-4 shadow-2xl" onSubmit={submit}>
            <input name="organizationId" type="hidden" value={organizationId} />
            <input name="rentalId" type="hidden" value={rentalId} />
            <input name="contractId" type="hidden" value={contractId} />

            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-[#0f766e]">Operator signature</p>
                <h3 className="text-xl font-black text-[#10252b]">Complete the signed contract</h3>
                <p className="mt-1 text-sm leading-6 text-[#667085]">This adds your signature, regenerates the stored PDF, and queues notifications for both parties.</p>
              </div>
              <button className="pressable rounded-lg border border-[#d6e5e2] bg-white p-2 text-[#344054]" onClick={() => setOpen(false)} type="button">
                <X size={18} />
              </button>
            </div>

            <label className="mt-4 block">
              <span className="text-sm font-bold text-[#344054]">Printed name</span>
              <input className="mt-2 w-full rounded-xl border border-[#d6e5e2] bg-white px-4 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15" name="signedName" required />
            </label>

            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-bold text-[#344054]">Sign below</span>
                <button className="pressable rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-xs font-bold text-[#344054]" onClick={clearSignature} type="button">
                  Clear
                </button>
              </div>
              <canvas
                className="h-44 w-full touch-none rounded-xl border border-[#d6e5e2] bg-[#fbfefd]"
                height={220}
                onPointerCancel={endDraw}
                onPointerDown={startDraw}
                onPointerLeave={endDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                ref={canvasRef}
                width={560}
              />
            </div>

            {error ? <p className="mt-4 rounded-xl bg-[#ffe4e6] p-3 text-sm font-bold text-[#be123c]">{error}</p> : null}

            <button className="pressable mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white disabled:opacity-70" disabled={isPending} type="submit">
              {isPending ? (
                <>
                  <span className="spinner" />
                  Signing...
                </>
              ) : (
                "Sign and regenerate PDF"
              )}
            </button>
          </form>
        </div>
      ) : null}
    </>
  );
}
