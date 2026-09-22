"use client";

import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  Camera,
  Car,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileVideo,
  Fuel,
  Gauge,
  MapPin,
  PenLine,
  ShieldCheck,
  Smartphone,
  Trash2
} from "lucide-react";
import { submitInspection } from "@/app/actions/inspections";
import { recordDeliveryCashPaymentAndReceipt } from "@/app/actions/transactions";
import type { InspectionContext, InspectionMode } from "@/lib/inspection-detail";

type DamageItem = {
  id: string;
  location: string;
  severity: string;
  description: string;
  photo_key?: string;
  photo_url?: string | null;
  is_pre_existing: boolean;
  noted_at: "delivery" | "return";
};

type ReceiptResult = {
  receipt_number: string;
  pdf_url: string;
  warning?: string;
};

const inputClass =
  "mt-2 w-full rounded-lg border border-[#c9dbd7] bg-white px-4 py-3 text-base text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15";

const touchButton =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-black";

const deliverySteps = ["Confirm", "Odometer", "Fuel", "Walkaround", "Damage", "GPS", "Signature"];
const returnSteps = ["Confirm", "Odometer", "Fuel", "Walkaround", "Damage", "Deposit", "Signature"];
const conditionSteps = ["Confirm", "Odometer", "Fuel", "Walkaround", "Damage", "GPS", "Review"];

function titleFor(context: InspectionContext) {
  return [context.vehicle.make, context.vehicle.model, context.vehicle.trim, context.vehicle.year].filter(Boolean).join(" ");
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

function money(value: unknown) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

function daysBetween(start: string | null | undefined, end: Date = new Date()) {
  if (!start) {
    return 0;
  }
  const startDate = new Date(start);
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(end);
  endDate.setHours(0, 0, 0, 0);
  return Math.max(0, Math.ceil((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1);
}

function StepShell({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="min-h-[56vh] rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-4 shadow-[0_14px_32px_rgba(25,63,72,0.08)] sm:p-6">
      <p className="text-xs font-black uppercase text-[#0f766e]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-black text-[#10252b]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Progress({ steps, step }: { steps: string[]; step: number }) {
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-[#d6e5e2] bg-[#eef8f6]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
      <div className="flex items-center justify-between text-xs font-bold text-[#667085]">
        <span>
          Step {step + 1} of {steps.length}
        </span>
        <span>{steps[step]}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[#0f766e] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>
    </div>
  );
}

function FileCapture({
  label,
  name,
  accept,
  capture = "environment",
  icon: Icon = Camera,
  onSelected
}: {
  label: string;
  name: string;
  accept: string;
  capture?: "environment" | "user";
  icon?: typeof Camera;
  onSelected?: (file: File) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <label className="block rounded-lg border border-dashed border-[#b8d4ce] bg-white p-4">
      <span className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-[#e6fffb] px-4 py-3 text-base font-black text-[#0f766e]">
        <Icon size={22} />
        {label}
      </span>
      <input
        accept={accept}
        capture={capture}
        className="sr-only"
        name={name}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          if (!file) {
            return;
          }
          setPreview(URL.createObjectURL(file));
          onSelected?.(file);
        }}
        type="file"
      />
      {preview ? (
        accept.startsWith("video") ? (
          <video className="mt-3 max-h-52 w-full rounded-lg border border-[#d6e5e2] object-cover" controls src={preview} />
        ) : (
          <img alt="" className="mt-3 max-h-52 w-full rounded-lg border border-[#d6e5e2] object-cover" src={preview} />
        )
      ) : null}
    </label>
  );
}

function FuelGauge({
  value,
  onChange
}: {
  value: number | null;
  onChange: (value: number, label: string) => void;
}) {
  const t = useTranslations("inspection");
  const displayValue = value ?? 50;
  const setValue = (nextValue: number) => {
    const safeValue = Math.max(0, Math.min(100, Math.round(nextValue)));
    onChange(safeValue, `${safeValue}%`);
  };

  return (
    <div className="rounded-xl border border-[#d6e5e2] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[#10252b]">{t("fuelPercentage")}</p>
          <p className="mt-1 text-xs font-semibold text-[#667085]">{t("fuelHint")}</p>
        </div>
        <span className="rounded-full bg-[#e6fffb] px-4 py-2 text-lg font-black text-[#0f766e]">
          {value === null ? "Not set" : `${value}%`}
        </span>
      </div>
      <div className="mb-4 h-8 overflow-hidden rounded-full border border-[#c9dbd7] bg-[#eef2f6]">
        <div className="h-full rounded-full bg-[#0f766e] transition-all" style={{ width: `${value ?? 0}%` }} />
      </div>
      <input
        aria-label={t("fuelPercentageFull")}
        className="h-12 w-full cursor-pointer accent-[#0f766e]"
        max="100"
        min="0"
        onChange={(event) => setValue(Number(event.target.value))}
        step="1"
        type="range"
        value={displayValue}
      />
      <div className="mt-1 flex justify-between text-xs font-bold text-[#667085]">
        <span>{t("empty")}</span>
        <span>25%</span>
        <span>50%</span>
        <span>75%</span>
        <span>{t("full")}</span>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button className={`${touchButton} border border-[#d6e5e2] bg-white text-[#344054]`} onClick={() => setValue((value ?? displayValue) - 5)} type="button">
          -5%
        </button>
        <input
          aria-label={t("exactFuelPercentage")}
          className="w-full rounded-lg border border-[#c9dbd7] bg-white px-3 py-3 text-center text-base font-black text-[#10252b] outline-none focus:border-[#0f766e] focus:ring-2 focus:ring-[#0f766e]/15"
          inputMode="numeric"
          max="100"
          min="0"
          onChange={(event) => setValue(Number(event.target.value || 0))}
          type="number"
          value={value ?? ""}
          placeholder={t("exactPercent")}
        />
        <button className={`${touchButton} border border-[#d6e5e2] bg-white text-[#344054]`} onClick={() => setValue((value ?? displayValue) + 5)} type="button">
          +5%
        </button>
      </div>
    </div>
  );
}

function VehicleDiagram({ onSelect }: { onSelect: (location: string) => void }) {
  const t = useTranslations("inspection");
  const areas = [
    { key: "front", label: "Front", className: "left-[34%] top-[4%] w-[32%] h-[18%]" },
    { key: "rear", label: "Rear", className: "left-[34%] bottom-[4%] w-[32%] h-[18%]" },
    { key: "front_left", label: "Front left", className: "left-[8%] top-[17%] w-[30%] h-[27%]" },
    { key: "front_right", label: "Front right", className: "right-[8%] top-[17%] w-[30%] h-[27%]" },
    { key: "rear_left", label: "Rear left", className: "left-[8%] bottom-[17%] w-[30%] h-[27%]" },
    { key: "rear_right", label: "Rear right", className: "right-[8%] bottom-[17%] w-[30%] h-[27%]" },
    { key: "interior", label: "Interior", className: "left-[35%] top-[36%] w-[30%] h-[28%]" }
  ];

  return (
    <div className="relative mx-auto aspect-[3/4] max-h-[420px] max-w-sm rounded-xl border border-[#d6e5e2] bg-white p-4">
      <svg className="h-full w-full text-[#0f766e]" viewBox="0 0 180 260" role="img" aria-label={t("vehicleDiagram")}>
        <rect x="50" y="18" width="80" height="224" rx="35" fill="#e6fffb" stroke="currentColor" strokeWidth="3" />
        <rect x="64" y="58" width="52" height="42" rx="10" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
        <rect x="62" y="112" width="56" height="56" rx="14" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
        <rect x="65" y="184" width="50" height="28" rx="8" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
        <circle cx="45" cy="70" r="11" fill="#10252b" />
        <circle cx="135" cy="70" r="11" fill="#10252b" />
        <circle cx="45" cy="194" r="11" fill="#10252b" />
        <circle cx="135" cy="194" r="11" fill="#10252b" />
      </svg>
      {areas.map((area) => (
        <button
          aria-label={`Log damage: ${area.label}`}
          className={`absolute rounded-lg border border-[#0f766e]/25 bg-[#0f766e]/5 text-[11px] font-black text-[#0f766e] ${area.className}`}
          key={area.key}
          onClick={() => onSelect(area.key)}
          type="button"
        >
          {area.label}
        </button>
      ))}
    </div>
  );
}

function SignaturePad({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations("inspection");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) {
      return { x: 0, y: 0 };
    }
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height
    };
  }

  function save() {
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  return (
    <div className="rounded-xl border border-[#d6e5e2] bg-white p-3">
      <canvas
        className="h-48 w-full touch-none rounded-lg bg-[#f8fffd]"
        height={220}
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!context) return;
          drawing.current = true;
          const { x, y } = point(event);
          context.lineWidth = 3;
          context.lineCap = "round";
          context.strokeStyle = "#10252b";
          context.beginPath();
          context.moveTo(x, y);
        }}
        onPointerMove={(event) => {
          if (!drawing.current) return;
          const context = canvasRef.current?.getContext("2d");
          if (!context) return;
          const { x, y } = point(event);
          context.lineTo(x, y);
          context.stroke();
        }}
        onPointerUp={() => {
          drawing.current = false;
          save();
        }}
        ref={canvasRef}
        width={620}
      />
      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[#667085]">{value ? "Signature captured" : "Sign in the box above"}</p>
        <button
          className="rounded-lg border border-[#d6e5e2] bg-white px-3 py-2 text-sm font-bold text-[#344054]"
          onClick={() => {
            const canvas = canvasRef.current;
            const context = canvas?.getContext("2d");
            if (canvas && context) {
              context.clearRect(0, 0, canvas.width, canvas.height);
              onChange("");
            }
          }}
          type="button"
        >
          {t("clear")}
        </button>
      </div>
    </div>
  );
}

export function InspectionForm({ context }: { context: InspectionContext }) {
  const t = useTranslations("inspection");
  const mode = context.mode;
  const depositAlreadyReturned = mode === "return" && context.rental?.deposit_status === "fully_returned";
  const steps = mode === "return" ? (depositAlreadyReturned ? returnSteps.filter((item) => item !== "Deposit") : returnSteps) : mode === "condition_report" ? conditionSteps : deliverySteps;
  const [step, setStep] = useState(0);
  const [odometer, setOdometer] = useState("");
  const [ocrMessage, setOcrMessage] = useState("");
  const [odometerPhotoCaptured, setOdometerPhotoCaptured] = useState(false);
  const [fuelPhotoCaptured, setFuelPhotoCaptured] = useState(false);
  const [fuelLevel, setFuelLevel] = useState<number | null>(null);
  const [fuelLabel, setFuelLabel] = useState("");
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  const [noDamage, setNoDamage] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState("");
  const [damageSeverity, setDamageSeverity] = useState("scratch");
  const [damageDescription, setDamageDescription] = useState("");
  const [signature, setSignature] = useState("");
  const [signedName, setSignedName] = useState(context.customer?.full_name || "");
  const [videoCaptured, setVideoCaptured] = useState(false);
  const [sidePhotos, setSidePhotos] = useState<Record<string, boolean>>({});
  const [fuelDeficitCharge, setFuelDeficitCharge] = useState(0);
  const [damageCharge, setDamageCharge] = useState(0);
  const [cleaningCharge, setCleaningCharge] = useState(0);
  const [refundOverride, setRefundOverride] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isReceiptPending, startReceiptTransition] = useTransition();
  const [deliveryPaymentAmount, setDeliveryPaymentAmount] = useState(() => String(Number(context.rental?.rental_rate || 0) || ""));
  const [deliveryDepositAmount, setDeliveryDepositAmount] = useState(() => {
    const expectedDeposit = Number(context.rental?.deposit_payment_amount || context.rental?.deposit_amount || 0);
    const heldDeposit = Number(context.rental?.deposit_held || 0);
    const remainingDeposit = Math.max(0, expectedDeposit - heldDeposit);
    return remainingDeposit ? String(remainingDeposit) : "";
  });
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [receiptError, setReceiptError] = useState("");

  const draftKey = `routehq-inspection-${mode}-${context.rental?.id || context.vehicle.id}`;
  const deliveryFuel = Number(context.deliveryInspection?.fuel_level || 0);
  const depositHeld = Number(context.rental?.deposit_held || 0);
  const alreadyRefunded = Number(context.rental?.deposit_refunded_amount || 0);
  const alreadyForfeited = Number(context.rental?.deposit_forfeited_amount || 0);
  const availableToReconcile = Math.max(0, depositHeld - alreadyRefunded - alreadyForfeited);
  const outstandingBalance = (context.unpaidPayments || []).reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const requestedDeductions = outstandingBalance + fuelDeficitCharge + damageCharge + cleaningCharge;
  const appliedDeductions = Math.min(availableToReconcile, requestedDeductions);
  const calculatedRefund = Math.max(0, availableToReconcile - appliedDeductions);
  const depositRefundAmount = Math.min(availableToReconcile, Math.max(0, refundOverride ? Number(refundOverride) : calculatedRefund));
  const preExistingDamage = useMemo(() => {
    const items = Array.isArray(context.deliveryInspection?.damage_items) ? context.deliveryInspection.damage_items : [];
    return items.filter((item: any) => item?.is_pre_existing);
  }, [context.deliveryInspection]);

  const rentalPeriod = useMemo(() => {
    if (!context.rental?.start_date) {
      return "Rental period not set";
    }
    if (context.rental.end_date) {
      return `${context.rental.start_date} to ${context.rental.end_date}`;
    }
    return `Open ended from ${context.rental.start_date}`;
  }, [context.rental?.end_date, context.rental?.start_date]);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) {
      return;
    }
    try {
      const draft = JSON.parse(saved);
      setStep(draft.step || 0);
      setOdometer(draft.odometer || "");
      setFuelLevel(draft.fuelLevel ?? null);
      setFuelLabel(draft.fuelLabel || "");
      setDamageItems(draft.damageItems || []);
      setNoDamage(Boolean(draft.noDamage));
      setSignature(draft.signature || "");
      setSignedName(draft.signedName || context.customer?.full_name || "");
      setFuelDeficitCharge(Number(draft.fuelDeficitCharge || 0));
      setDamageCharge(Number(draft.damageCharge || 0));
      setCleaningCharge(Number(draft.cleaningCharge || 0));
      setRefundOverride(draft.refundOverride || "");
    } catch {
      localStorage.removeItem(draftKey);
    }
  }, [draftKey, context.customer?.full_name]);

  useEffect(() => {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        step,
        odometer,
        fuelLevel,
        fuelLabel,
        damageItems,
        noDamage,
        signature,
        signedName,
        fuelDeficitCharge,
        damageCharge,
        cleaningCharge,
        refundOverride
      })
    );
  }, [cleaningCharge, damageCharge, damageItems, draftKey, fuelDeficitCharge, fuelLabel, fuelLevel, noDamage, odometer, refundOverride, signature, signedName, step]);

  async function readOdometer(file: File) {
    setOcrMessage("Reading odometer photo...");
    const data = new FormData();
    data.append("file", file);
    try {
      const response = await fetch("/api/ocr/odometer", { method: "POST", body: data });
      const result = await response.json();
      if (!response.ok) {
        setOcrMessage(result.error || "Odometer OCR was not available.");
        return;
      }
      if (result.odometer_reading && Number(result.confidence || 0) >= 0.65) {
        setOdometer(String(result.odometer_reading));
        setOcrMessage(`Suggested ${Number(result.odometer_reading).toLocaleString()} km from photo.`);
      } else if (result.odometer_reading) {
        setOcrMessage(`Possible reading: ${Number(result.odometer_reading).toLocaleString()} km. Please confirm manually.`);
      } else {
        setOcrMessage("Could not read the odometer clearly. Enter it manually.");
      }
    } catch {
      setOcrMessage("Odometer OCR failed. Enter it manually.");
    }
  }

  function canAdvance() {
    if (step === 1) return Boolean(odometer && odometerPhotoCaptured);
    if (step === 2) return fuelLevel !== null && fuelPhotoCaptured;
    if (step === 3) return videoCaptured || ["front", "rear", "driver", "passenger"].every((key) => sidePhotos[key]);
    if (step === 4) return noDamage || damageItems.length > 0;
    if (step === steps.length - 1 && mode !== "condition_report") return Boolean(signature && signedName);
    return true;
  }

  function addDamage() {
    if (!selectedLocation || !damageDescription.trim()) {
      return;
    }
    const id = crypto.randomUUID();
    setDamageItems((items) => [
      ...items,
      {
        id,
        location: selectedLocation,
        severity: damageSeverity,
        description: damageDescription.trim(),
        photo_key: id,
        is_pre_existing: mode !== "return",
        noted_at: mode === "return" ? "return" : "delivery"
      }
    ]);
    setNoDamage(false);
    setSelectedLocation("");
    setDamageSeverity("scratch");
    setDamageDescription("");
  }

  function generateDeliveryReceipt() {
    const rentalPaymentAmount = Number(deliveryPaymentAmount || 0);
    const depositAmount = Number(deliveryDepositAmount || 0);
    const totalReceived = rentalPaymentAmount + depositAmount;

    if (!context.rental?.id || totalReceived <= 0) {
      setReceiptError("Enter a positive rental payment or deposit amount first.");
      return;
    }

    const formData = new FormData();
    formData.set("organizationId", context.organizationId);
    formData.set("rentalId", context.rental.id);
    formData.set("vehicleId", context.vehicle.id);
    formData.set("customerId", context.customer?.id || "");
    formData.set("amount", String(totalReceived));
    formData.set("rentalPaymentAmount", String(rentalPaymentAmount));
    formData.set("depositAmount", String(depositAmount));
    formData.set("paymentMethod", "cash");
    formData.set("customerName", context.customer?.full_name || "Customer");
    formData.set("vehicleMakeModel", [context.vehicle.make, context.vehicle.model, context.vehicle.trim].filter(Boolean).join(" "));
    formData.set("vehiclePlate", context.vehicle.registration_number || "");
    formData.set("rentalPeriod", rentalPeriod);

    setReceiptError("");
    startReceiptTransition(async () => {
      try {
        const result = await recordDeliveryCashPaymentAndReceipt(formData);
        setReceiptResult(result);
      } catch (error) {
        setReceiptError(error instanceof Error ? error.message : "Unable to generate receipt.");
      }
    });
  }

  async function shareReceipt() {
    if (!receiptResult?.pdf_url) {
      return;
    }

    const shareData = {
      title: `Receipt ${receiptResult.receipt_number}`,
      text: `Receipt ${receiptResult.receipt_number}`,
      url: receiptResult.pdf_url
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(receiptResult.pdf_url);
      }
    } catch {
      await navigator.clipboard.writeText(receiptResult.pdf_url);
    }
  }

  function nav() {
    return (
      <div className="sticky bottom-0 z-20 -mx-4 mt-4 flex gap-2 border-t border-[#d6e5e2] bg-white/95 p-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
        <button
          className={`${touchButton} flex-1 border border-[#d6e5e2] bg-white text-[#344054] disabled:opacity-50`}
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          type="button"
        >
          <ChevronLeft size={18} />
          {t("back")}
        </button>
        {step < steps.length - 1 ? (
          <button
            className={`${touchButton} flex-1 bg-[#0f766e] text-white shadow-lg disabled:bg-[#94a3b8]`}
            disabled={!canAdvance()}
            onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            type="button"
          >
            {t("next")}
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            className={`${touchButton} flex-1 bg-[#0f766e] text-white shadow-lg disabled:bg-[#94a3b8]`}
            disabled={!canAdvance() || isPending}
            form="inspectionForm"
            onClick={(event) => {
              event.preventDefault();
              const form = document.getElementById("inspectionForm") as HTMLFormElement | null;
              if (!form) return;
              startTransition(() => {
                submitInspection(new FormData(form));
                localStorage.removeItem(draftKey);
              });
            }}
            type="submit"
          >
            {isPending ? "Submitting..." : mode === "return" ? "Submit Return Inspection" : mode === "condition_report" ? "Save Condition Report" : "Submit Delivery Inspection"}
          </button>
        )}
      </div>
    );
  }

  return (
    <form action={submitInspection} className="mx-auto max-w-3xl space-y-4" encType="multipart/form-data" id="inspectionForm">
      <input name="organizationId" type="hidden" value={context.organizationId} />
      <input name="mode" type="hidden" value={mode} />
      <input name="rentalId" type="hidden" value={context.rental?.id || ""} />
      <input name="vehicleId" type="hidden" value={context.vehicle.id} />
      <input name="customerId" type="hidden" value={context.customer?.id || ""} />
      <input name="odometerReading" type="hidden" value={odometer} />
      <input name="fuelLevel" type="hidden" value={fuelLevel ?? ""} />
      <input name="fuelLevelLabel" type="hidden" value={fuelLabel} />
      <input name="damageItems" type="hidden" value={JSON.stringify(damageItems)} />
      <input name="customerSignature" type="hidden" value={signature} />
      <input name="customerSignedName" type="hidden" value={signedName} />
      <input name="depositRefundAmount" type="hidden" value={depositRefundAmount} />
      <input name="depositOutstandingBalance" type="hidden" value={outstandingBalance} />
      <input name="depositFuelDeficitCharge" type="hidden" value={fuelDeficitCharge} />
      <input name="depositDamageCharge" type="hidden" value={damageCharge} />
      <input name="depositCleaningCharge" type="hidden" value={cleaningCharge} />

      <Progress step={step} steps={steps} />

      {step === 0 ? (
        <StepShell eyebrow="Vehicle confirmation" title={mode === "return" ? "Confirm vehicle return" : mode === "condition_report" ? "Start condition report" : "Confirm vehicle handover"}>
          <div className="rounded-xl border border-[#d6e5e2] bg-white p-4">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[#e6fffb] text-[#0f766e]">
                <Car size={30} />
              </span>
              <div>
                <p className="text-2xl font-black text-[#10252b]">{titleFor(context)}</p>
                <p className="font-mono-data mt-1 text-lg font-black text-[#10252b]">{context.vehicle.registration_number}</p>
                <p className="mt-2 text-sm text-[#667085]">
                  {context.customer?.full_name ? `${context.customer.full_name} · ` : ""}
                  {context.rental?.start_date ? `Rental starts ${formatDate(context.rental.start_date)}` : "Standalone vehicle report"}
                </p>
                {mode === "return" ? (
                  <p className="mt-2 rounded-lg bg-[#fef3c7] px-3 py-2 text-sm font-bold text-[#92400e]">
                    <span className="font-mono-data">Delivery odometer: {Number(context.rental?.mileage_at_delivery || 0).toLocaleString()} km · Rental length {daysBetween(context.rental?.start_date)} days</span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <button className={`${touchButton} mt-5 w-full bg-[#0f766e] text-white shadow-lg`} onClick={() => setStep(1)} type="button">
            {mode === "return" ? "Start Return Inspection" : mode === "condition_report" ? "Start Condition Report" : "Start Delivery Inspection"}
          </button>
        </StepShell>
      ) : null}

      {step === 1 ? (
        <StepShell eyebrow="Odometer" title={t("odometerPhoto")}>
          <FileCapture
            accept="image/*"
            label={t("odometerCamera")}
            name="photo_odometer"
            onSelected={(file) => {
              setOdometerPhotoCaptured(true);
              readOdometer(file);
            }}
          />
          {ocrMessage ? <p className="mt-3 rounded-lg bg-[#eef8f6] p-3 text-sm font-semibold text-[#0f766e]">{ocrMessage}</p> : null}
          {mode === "return" ? (
            <p className="mt-3 text-sm font-semibold text-[#667085]">
              <span className="font-mono-data">Odometer at delivery: {Number(context.rental?.mileage_at_delivery || 0).toLocaleString()} km</span>
            </p>
          ) : null}
          <label className="mt-4 block">
            <span className="text-sm font-black text-[#10252b]">{t("confirmOdometer")}</span>
            <input className={inputClass} inputMode="numeric" min="0" onChange={(event) => setOdometer(event.target.value)} placeholder={t("odometerExample")} type="number" value={odometer} />
          </label>
          {mode === "return" && odometer ? (
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-black text-[#10252b]">
              <span className="font-mono-data">Driven during rental: {Math.max(0, Number(odometer || 0) - Number(context.rental?.mileage_at_delivery || 0)).toLocaleString()} km</span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-[#667085]">{t("odometerUpdatesMileage")}</p>
          )}
        </StepShell>
      ) : null}

      {step === 2 ? (
        <StepShell eyebrow="Fuel level" title={t("fuelPhoto")}>
          <FileCapture accept="image/*" label={t("fuelCamera")} name="photo_fuel" onSelected={() => setFuelPhotoCaptured(true)} />
          <div className="mt-4">
            <FuelGauge
              onChange={(value, label) => {
                setFuelLevel(value);
                setFuelLabel(label);
              }}
              value={fuelLevel}
            />
          </div>
          {mode === "return" && deliveryFuel > 0 && fuelLevel !== null && fuelLevel < deliveryFuel ? (
            <div className="mt-4 rounded-lg border border-[#fbbf24] bg-[#fffbeb] p-3">
              <p className="font-black text-[#92400e]">Fuel deficit: approximately {deliveryFuel - fuelLevel}%</p>
              <label className="mt-2 block text-sm font-bold text-[#10252b]">
                {t("applyFuelCharge")}
                <input className={inputClass} min="0" onChange={(event) => setFuelDeficitCharge(Number(event.target.value || 0))} placeholder="THB" step="0.01" type="number" value={fuelDeficitCharge || ""} />
              </label>
            </div>
          ) : null}
        </StepShell>
      ) : null}

      {step === 3 ? (
        <StepShell eyebrow="Walkaround" title={t("recordCondition")}>
          <FileCapture accept="video/*" icon={FileVideo} label={t("recordVideo")} name="walkaroundVideo" onSelected={() => setVideoCaptured(true)} />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {[
              ["front", "Front"],
              ["rear", "Rear"],
              ["driver", "Driver Side"],
              ["passenger", "Passenger Side"],
              ["interior", "Interior optional"],
              ["boot", "Boot / trunk optional"]
            ].map(([key, label]) => (
              <FileCapture
                accept="image/*"
                key={key}
                label={label}
                name={`photo_${key}`}
                onSelected={() => setSidePhotos((current) => ({ ...current, [key]: true }))}
              />
            ))}
          </div>
          <p className="mt-3 text-sm text-[#667085]">{t("conditionMinimum")}</p>
        </StepShell>
      ) : null}

      {step === 4 ? (
        <StepShell eyebrow="Damage check" title={mode === "return" ? "Check for new damage" : "Log pre-existing damage"}>
          {preExistingDamage.length > 0 ? (
            <div className="mb-4 rounded-lg border border-[#d6e5e2] bg-white p-3">
              <p className="text-sm font-black text-[#10252b]">{t("preExistingDamage")}</p>
              <div className="mt-2 space-y-2">
                {preExistingDamage.map((item: any) => (
                  <p className="rounded-lg bg-[#eef2f6] px-3 py-2 text-sm text-[#475467]" key={item.id}>
                    {item.location?.replace(/_/g, " ")} · {item.severity} · {item.description}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <VehicleDiagram onSelect={setSelectedLocation} />
          <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-white p-4">
            <p className="font-black text-[#10252b]">{selectedLocation ? `Damage at ${selectedLocation.replace(/_/g, " ")}` : "Tap a vehicle area to log damage"}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-bold text-[#10252b]">{t("severity")}</span>
                <select className={inputClass} onChange={(event) => setDamageSeverity(event.target.value)} value={damageSeverity}>
                  <option value="scratch">{t("damageScratch")}</option>
                  <option value="dent">{t("damageDent")}</option>
                  <option value="crack">{t("damageCrack")}</option>
                  <option value="missing">{t("damageMissingPart")}</option>
                  <option value="other">{t("damageOther")}</option>
                </select>
              </label>
              <label className="block sm:col-span-2">
                <span className="text-sm font-bold text-[#10252b]">{t("description")}</span>
                <input className={inputClass} onChange={(event) => setDamageDescription(event.target.value)} placeholder={t("shortDescription")} value={damageDescription} />
              </label>
            </div>
            <button className={`${touchButton} mt-3 bg-[#0f766e] text-white`} disabled={!selectedLocation || !damageDescription.trim()} onClick={addDamage} type="button">
              {t("saveDamageItem")}
            </button>
          </div>
          <label className="checkbox-label mt-3 min-h-12 rounded-lg border border-[#d6e5e2] bg-white px-4 py-3 font-bold text-[#10252b]">
            <input checked={noDamage} className="flex-shrink-0" onChange={(event) => setNoDamage(event.target.checked)} type="checkbox" />
            <span>{t("noDamageToReport")}</span>
          </label>
          <div className="mt-3 space-y-2">
            {damageItems.map((item) => (
              <div className="rounded-lg border border-[#d6e5e2] bg-white p-3" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#10252b]">{item.location.replace(/_/g, " ")} · {item.severity}</p>
                    <p className="text-sm text-[#667085]">{item.description}</p>
                    <label className="mt-2 inline-flex cursor-pointer rounded-lg bg-[#e6fffb] px-3 py-2 text-sm font-bold text-[#0f766e]">
                      {t("addDamagePhoto")}
                      <input accept="image/*" capture="environment" className="sr-only" name={`damagePhoto_${item.id}`} type="file" />
                    </label>
                  </div>
                  <button className="rounded-lg border border-[#fecdd3] p-2 text-[#be123c]" onClick={() => setDamageItems((items) => items.filter((entry) => entry.id !== item.id))} type="button">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {mode === "return" && damageItems.some((item) => !item.is_pre_existing) ? (
            <label className="mt-4 block rounded-lg border border-[#fecdd3] bg-[#fff1f2] p-3">
              <span className="text-sm font-black text-[#be123c]">{t("applyDamageExcess")}</span>
              <input className={inputClass} min="0" onChange={(event) => setDamageCharge(Number(event.target.value || 0))} placeholder="THB" step="0.01" type="number" value={damageCharge || ""} />
            </label>
          ) : null}
        </StepShell>
      ) : null}

      {step === 5 && mode !== "return" ? (
        <StepShell eyebrow="GPS check" title={t("confirmTracker")}>
          {context.gpsDevice ? (
            <div className="rounded-xl border border-[#d6e5e2] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${context.gpsDevice.last_seen_at ? "bg-[#dcfce7] text-[#166534]" : "bg-[#fef3c7] text-[#92400e]"}`}>
                  {context.gpsDevice.last_seen_at ? <CheckCircle2 /> : <AlertTriangle />}
                </span>
                <div>
                  <p className="font-black text-[#10252b]">{context.gpsDevice.last_seen_at ? "GPS tracker is active" : "GPS tracker appears offline"}</p>
                  <p className="mt-1 text-sm text-[#667085]">
                    {context.gpsDevice.provider} · Last seen {context.gpsDevice.last_seen_at ? formatDate(context.gpsDevice.last_seen_at) : "never"}
                  </p>
                  {context.latestLocation ? (
                    <p className="mt-1 flex items-center gap-1 text-sm text-[#667085]">
                      <MapPin size={14} />
                      {context.latestLocation.latitude}, {context.latestLocation.longitude}
                    </p>
                  ) : null}
                </div>
              </div>
              <label className="checkbox-label mt-4 min-h-12 rounded-lg bg-[#f8fffd] px-4 py-3 font-bold text-[#10252b]">
                <input className="flex-shrink-0" type="checkbox" />
                <span>{t("gpsConfirm")}</span>
              </label>
            </div>
          ) : (
            <div className="rounded-xl border border-[#d6e5e2] bg-white p-4 text-center">
              <Smartphone className="mx-auto text-[#667085]" size={34} />
              <p className="mt-3 font-black text-[#10252b]">{t("noGpsDevice")}</p>
              <p className="mt-1 text-sm text-[#667085]">{t("noGpsContinue")}</p>
            </div>
          )}
        </StepShell>
      ) : null}

      {step === 5 && mode === "return" && !depositAlreadyReturned ? (
        <StepShell eyebrow="Deposit reconciliation" title={t("confirmDepositRefund")}>
          <div className="space-y-3 rounded-xl border border-[#d6e5e2] bg-white p-4">
            <Row label={t("depositHeld")} value={money(depositHeld)} />
            <Row label={t("alreadyRefunded")} value={`-${money(alreadyRefunded)}`} danger={alreadyRefunded > 0} />
            <Row label={t("alreadyForfeited")} value={`-${money(alreadyForfeited)}`} danger={alreadyForfeited > 0} />
            <Row label={t("availableToReconcile")} value={money(availableToReconcile)} />
            <Row label={t("outstandingBalance")} value={`-${money(outstandingBalance)}`} danger />
            <Row label={t("fuelDeficitCharge")} value={`-${money(fuelDeficitCharge)}`} danger />
            <Row label={t("damageExcess")} value={`-${money(damageCharge)}`} danger />
            <label className="block rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3">
              <span className="text-sm font-black text-[#10252b]">{t("cleaningFee")}</span>
              <input className={inputClass} min="0" onChange={(event) => setCleaningCharge(Number(event.target.value || 0))} placeholder="THB" step="0.01" type="number" value={cleaningCharge || ""} />
            </label>
            {requestedDeductions > availableToReconcile ? (
              <p className="rounded-lg border border-[#fbbf24] bg-[#fffbeb] px-3 py-2 text-sm font-bold text-[#92400e]">
                Deductions exceed the deposit available. Only {money(availableToReconcile)} can be reconciled from this deposit.
              </p>
            ) : null}
            <div className="border-t border-[#d6e5e2] pt-3">
              <div className="rounded-lg bg-[#e6fffb] p-3">
                <Row label={t("depositRefund")} value={money(depositRefundAmount)} />
              </div>
            </div>
            <label className="block">
              <span className="text-sm font-bold text-[#10252b]">{t("overrideRefund")}</span>
              <input className={inputClass} min="0" onChange={(event) => setRefundOverride(event.target.value)} placeholder={String(calculatedRefund)} step="0.01" type="number" value={refundOverride} />
            </label>
          </div>
        </StepShell>
      ) : null}

      {step === steps.length - 1 ? (
        <StepShell eyebrow="Review" title={mode === "return" ? "Review return and collect signature" : mode === "condition_report" ? "Review condition report" : "Review handover and collect signature"}>
          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryTile icon={Gauge} label="Odometer" value={odometer ? `${Number(odometer).toLocaleString()} km` : "Missing"} />
            <SummaryTile icon={Fuel} label="Fuel" value={fuelLabel || "Missing"} />
            <SummaryTile icon={Camera} label={t("photosVideo")} value={videoCaptured ? "Video captured" : `${Object.values(sidePhotos).filter(Boolean).length} photos`} />
            <SummaryTile icon={ShieldCheck} label="Damage" value={noDamage ? "No damage noted" : `${damageItems.length} item(s)`} />
          </div>
          {mode === "return" ? (
            <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-white p-3">
              {depositAlreadyReturned ? (
                <div className="rounded-lg bg-[#f0fdf4] p-3">
                  <Row label={t("depositAlreadyReturned")} value="Complete" />
                </div>
              ) : (
                <>
                  <Row label={t("depositDeductions")} value={`-${money(appliedDeductions)}`} danger={appliedDeductions > 0} />
                  <Row label={t("depositRefundConfirmed")} value={money(depositRefundAmount)} />
                </>
              )}
            </div>
          ) : null}
          {mode === "delivery" && context.rental?.id ? (
            <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-[#10252b]">{t("cashPayment")}</p>
                  <p className="mt-1 text-xs font-semibold text-[#667085]">{t("cashPaymentHint")}</p>
                </div>
                {receiptResult ? (
                  <span className="rounded-full bg-[#dcfce7] px-3 py-1 text-xs font-black uppercase text-[#166534]">
                    {t("receiptReady")}
                  </span>
                ) : null}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                <label className="block">
                  <span className="text-sm font-bold text-[#10252b]">{t("rentalPaymentReceived")}</span>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => {
                      setDeliveryPaymentAmount(event.target.value);
                      setReceiptError("");
                    }}
                    placeholder="THB"
                    step="0.01"
                    type="number"
                    value={deliveryPaymentAmount}
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-bold text-[#10252b]">{t("depositAmountReceived")}</span>
                  <input
                    className={inputClass}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => {
                      setDeliveryDepositAmount(event.target.value);
                      setReceiptError("");
                    }}
                    placeholder="THB"
                    step="0.01"
                    type="number"
                    value={deliveryDepositAmount}
                  />
                </label>
                <button
                  className={`${touchButton} self-end bg-[#0f766e] text-white disabled:bg-[#94a3b8]`}
                  disabled={isReceiptPending || Boolean(receiptResult)}
                  onClick={generateDeliveryReceipt}
                  type="button"
                >
                  {isReceiptPending ? "Generating..." : receiptResult ? "Receipt generated" : "Confirm cash and generate receipt"}
                </button>
              </div>
              {receiptError ? (
                <p className="mt-3 rounded-lg border border-[#fecdd3] bg-[#fff1f2] px-3 py-2 text-sm font-bold text-[#be123c]">{receiptError}</p>
              ) : null}
              {receiptResult ? (
                <div className="mt-3 rounded-lg border border-[#bbf7d0] bg-[#f0fdf4] p-3">
                  <p className="flex items-center gap-2 text-sm font-black text-[#166534]">
                    <CheckCircle2 size={18} />
                    Receipt {receiptResult.receipt_number} generated
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[#166534]">
                    Rental payment {money(Number(deliveryPaymentAmount || 0))} · Deposit {money(Number(deliveryDepositAmount || 0))}
                  </p>
                  {receiptResult.warning ? (
                    <p className="mt-2 rounded-lg border border-[#fbbf24] bg-[#fffbeb] px-3 py-2 text-xs font-bold text-[#92400e]">{receiptResult.warning}</p>
                  ) : null}
                  {receiptResult.pdf_url ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className={`${touchButton} border border-[#bbf7d0] bg-white text-[#166534]`} onClick={shareReceipt} type="button">
                        {t("shareReceipt")}
                      </button>
                      <a className={`${touchButton} border border-[#bbf7d0] bg-white text-[#166534]`} href={receiptResult.pdf_url} rel="noreferrer" target="_blank">
                        {t("downloadReceipt")}
                      </a>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {mode !== "condition_report" ? (
            <>
              <p className="mt-5 text-base font-black text-[#10252b]">Handing over to {context.customer?.full_name || "customer"}</p>
              <p className="mt-1 text-sm text-[#667085]">{t("signPrompt")}</p>
              <div className="mt-3">
                <SignaturePad onChange={setSignature} value={signature} />
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-black text-[#10252b]">{t("customerPrintedName")}</span>
                <input className={inputClass} onChange={(event) => setSignedName(event.target.value)} value={signedName} />
              </label>
            </>
          ) : (
            <label className="mt-4 block">
              <span className="text-sm font-black text-[#10252b]">{t("notes")}</span>
              <textarea className={inputClass} name="notes" placeholder={t("notesPlaceholder")} rows={4} />
            </label>
          )}
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              className={`${touchButton} mt-4 border border-[#d6e5e2] bg-white text-[#344054]`}
              onClick={() => navigator.share?.({ title: "RouteHQ inspection summary", text: `${titleFor(context)} inspection summary is ready.` })}
              type="button"
            >
              {t("shareWithCustomer")}
            </button>
          ) : null}
        </StepShell>
      ) : null}

      {nav()}

      <Link className="inline-flex items-center gap-2 text-sm font-bold text-[#0f766e]" href={`/fleet/${context.vehicle.id}` as Route}>
        <ChevronLeft size={16} />
        {t("backToVehicle")}
      </Link>
    </form>
  );
}

function Row({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-bold text-[#667085]">{label}</span>
      <span className={`font-mono-data text-base font-black ${danger ? "text-[#be123c]" : "text-[#10252b]"}`}>{value}</span>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
      <Icon className="text-[#0f766e]" size={20} />
      <p className="mt-2 text-xs font-bold uppercase text-[#667085]">{label}</p>
      <p className="font-mono-data mt-1 font-black text-[#10252b]">{value}</p>
    </div>
  );
}
