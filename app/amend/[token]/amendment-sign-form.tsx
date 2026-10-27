"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { signRentalAmendment } from "@/app/actions/amendments";

export function AmendmentSignForm({ token, contentHash, renterName }: { token: string; contentHash: string; renterName: string }) {
  const t = useTranslations("customer");
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signature, setSignature] = useState("");
  const [name, setName] = useState(renterName);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: ((event.clientX - rect.left) / rect.width) * canvas.width, y: ((event.clientY - rect.top) / rect.height) * canvas.height };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawing.current = true;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    const { x, y } = point(event);
    context?.beginPath();
    context?.moveTo(x, y);
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = point(event);
    context.lineWidth = 3;
    context.lineCap = "round";
    context.strokeStyle = "#1b2430";
    context.lineTo(x, y);
    context.stroke();
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (canvasRef.current) setSignature(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSignature("");
  }

  function submit() {
    setError("");
    startTransition(async () => {
      const result = await signRentalAmendment({ token, contentHash, signerName: name, signatureDataUrl: signature, accepted });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const ready = accepted && Boolean(signature) && name.trim().length > 1;

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-white p-5 shadow-sm">
      <h2 className="card-title">{t("signToAgree")}</h2>
      <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-2xl bg-[var(--panel-secondary)] p-3.5 text-sm">
        <input checked={accepted} className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[var(--primary)]" onChange={(event) => setAccepted(event.target.checked)} type="checkbox" />
        <span>{t("amendConsent")}</span>
      </label>
      <label className="mt-3 block text-sm font-bold">
        {t("yourFullName")}
        <input
          autoComplete="name"
          className="mt-1 w-full text-base font-normal"
          onChange={(event) => setName(event.target.value)}
          value={name}
        />
      </label>
      <div className="mt-3">
        <div className="flex items-center justify-between text-sm font-bold">
          <span>{t("yourSignature")}</span>
          <button className="text-xs font-semibold text-[var(--primary)]" onClick={clear} type="button">
            {t("clear")}
          </button>
        </div>
        <canvas
          className="mt-1 h-40 w-full touch-none rounded-xl border border-dashed border-[var(--muted)] bg-[var(--panel-secondary)]"
          height={200}
          onPointerCancel={end}
          onPointerDown={start}
          onPointerLeave={end}
          onPointerMove={move}
          onPointerUp={end}
          ref={canvasRef}
          width={600}
        />
      </div>
      {error ? <p className="mt-3 rounded-xl bg-[var(--danger-light)] px-3 py-2 text-sm font-bold text-[var(--danger)]">{error}</p> : null}
      <button
        className="pressable mt-4 min-h-12 w-full rounded-full bg-[var(--primary)] px-5 py-3 text-base font-semibold text-white disabled:opacity-50"
        disabled={!ready || isPending}
        onClick={submit}
        type="button"
      >
        {isPending ? t("signing") : t("signTheChange")}
      </button>
    </section>
  );
}
