"use client";

import { businessToday, toWallTime } from "@/lib/business-time";
import { VehicleKindIcon } from "@/components/vehicle-kind-icon";
import { shownError } from "@/lib/error-text";
import { isTwoWheeler, kindFromCategory } from "@/lib/vehicle-groups";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import {
  AlertTriangle,
  Camera,
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
import { prepareInspectionUploads } from "@/app/actions/uploads";
import { uploadFormFiles } from "@/lib/direct-upload-client";
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
  "mt-2 w-full rounded-lg border border-[var(--border)] bg-white px-4 py-3 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

const touchButton =
  "pressable inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold";

const deliverySteps = ["Confirm", "Odometer", "Fuel", "Walkaround", "Damage", "GPS", "Signature"];
const returnSteps = ["Confirm", "Odometer", "Fuel", "Walkaround", "Damage", "Deposit", "Signature"];
const conditionSteps = ["Confirm", "Odometer", "Fuel", "Walkaround", "Damage", "GPS", "Review"];

function titleFor(context: InspectionContext) {
  return [context.vehicle.make, context.vehicle.model, context.vehicle.trim, context.vehicle.year].filter(Boolean).join(" ");
}

function formatDate(value: string | null | undefined, locale = "en-GB") {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat(locale === "en" || locale === "en-GB" ? "en-GB" : `${locale}-u-ca-gregory-nu-latn`, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function money(value: unknown) {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency: "THB", maximumFractionDigits: 0 }).format(Number(value || 0));
}

/** Days a rental has run, counting the first day, on the business's calendar (the same on the server and on the phone). */
function daysBetween(start: string | null | undefined) {
  if (!start) {
    return 0;
  }
  const startDay = Date.parse(`${toWallTime(start).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(startDay)) return 0;
  return Math.max(0, Math.round((Date.parse(`${businessToday()}T00:00:00Z`) - startDay) / 86_400_000) + 1);
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
    <section className="min-h-[56vh] rounded-xl border border-[var(--border)] bg-[var(--panel-secondary)] p-4 shadow-[0_14px_32px_rgba(25,63,72,0.08)] sm:p-6">
      <p className="text-xs font-semibold uppercase text-[var(--primary)]">{eyebrow}</p>
      <h2 className="mt-1 text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Progress({ steps, step }: { steps: string[]; step: number }) {
  const t = useTranslations("inspection");
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-[var(--border)] bg-[var(--panel-secondary)]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-lg sm:border">
      <div className="flex items-center justify-between text-xs font-bold text-[var(--muted)]">
        <span>{t("stepOf", { current: step + 1, total: steps.length })}</span>
        <span>{t(`steps.${steps[step]}`)}</span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
        <div className="h-full rounded-full bg-[var(--primary)] transition-all" style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
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
    <label className="block rounded-lg border border-dashed border-[var(--info-line)] bg-white p-4">
      <span className="flex min-h-14 items-center justify-center gap-3 rounded-lg bg-[var(--primary-light)] px-4 py-3 text-base font-semibold text-[var(--primary)]">
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
          <video className="mt-3 max-h-52 w-full rounded-lg border border-[var(--border)] object-cover" controls src={preview} />
        ) : (
          <img alt="" className="mt-3 max-h-52 w-full rounded-lg border border-[var(--border)] object-cover" src={preview} />
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
    <div className="rounded-xl border border-[var(--border)] bg-white p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{t("fuelPercentage")}</p>
          <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{t("fuelHint")}</p>
        </div>
        <span className="rounded-full bg-[var(--primary-light)] px-4 py-2 text-lg font-semibold text-[var(--primary)]">
          {value === null ? t("notSet") : `${value}%`}
        </span>
      </div>
      {/* Five big taps cover nearly every handover; the slider and exact figure are one tap away. */}
      <div className="grid grid-cols-5 gap-1.5">
        {[
          { level: 0, label: t("empty") },
          { level: 25, label: "¼" },
          { level: 50, label: "½" },
          { level: 75, label: "¾" },
          { level: 100, label: t("full") }
        ].map(({ level, label }) => (
          <button
            aria-pressed={value === level}
            className={`pressable min-h-12 rounded-lg border px-0.5 text-sm font-semibold ${value === level ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
            key={level}
            onClick={() => setValue(level)}
            type="button"
          >
            {label}
          </button>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer py-2 text-sm font-semibold text-[var(--primary)]">{t("exactFuelPercentage")}</summary>
        <input
          aria-label={t("fuelPercentageFull")}
          className="h-12 w-full cursor-pointer accent-[#24456b]"
          max="100"
          min="0"
          onChange={(event) => setValue(Number(event.target.value))}
          step="1"
          type="range"
          value={displayValue}
        />
      <div className="mt-2 grid grid-cols-[auto_1fr_auto] items-center gap-3">
        <button className={`${touchButton} border border-[var(--border)] bg-white text-[var(--foreground-secondary)]`} onClick={() => setValue((value ?? displayValue) - 5)} type="button">
          -5%
        </button>
        <input
          aria-label={t("exactFuelPercentage")}
          className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-3 text-center text-base font-semibold text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15"
          inputMode="numeric"
          max="100"
          min="0"
          onChange={(event) => setValue(Number(event.target.value || 0))}
          type="number"
          value={value ?? ""}
          placeholder={t("exactPercent")}
        />
        <button className={`${touchButton} border border-[var(--border)] bg-white text-[var(--foreground-secondary)]`} onClick={() => setValue((value ?? displayValue) + 5)} type="button">
          +5%
        </button>
      </div>
      </details>
    </div>
  );
}

function VehicleDiagram({ onSelect, selected, marked, bike }: { onSelect: (location: string) => void; /** The area being described now. */ selected?: string; /** Areas that already have damage logged. */ marked?: string[]; /** A motorbike or scooter: it has two sides and a seat, not four corners and an interior. */ bike?: boolean }) {
  const t = useTranslations("inspection");
  const bikeAreas = [
    { key: "front", label: t("areaFront"), className: "left-[34%] top-[1%] w-[32%] h-[15%]" },
    { key: "rear", label: t("areaRear"), className: "left-[34%] bottom-[1%] w-[32%] h-[15%]" },
    { key: "left_side", label: t("areaLeftSide"), className: "left-[1%] top-[36%] w-[26%] h-[28%]" },
    { key: "right_side", label: t("areaRightSide"), className: "right-[1%] top-[36%] w-[26%] h-[28%]" },
    { key: "seat", label: t("areaSeat"), className: "left-[29%] top-[44%] w-[42%] h-[20%]" }
  ];
  const carAreas = [
    { key: "front", label: t("areaFront"), className: "left-[34%] top-[4%] w-[32%] h-[18%]" },
    { key: "rear", label: t("areaRear"), className: "left-[34%] bottom-[4%] w-[32%] h-[18%]" },
    // Side areas sit outside the wheels (drawn at 25% and 75% of the width) so
    // their labels stay readable.
    { key: "front_left", label: t("areaFrontLeft"), className: "left-[1%] top-[17%] w-[20%] h-[27%]" },
    { key: "front_right", label: t("areaFrontRight"), className: "right-[1%] top-[17%] w-[20%] h-[27%]" },
    { key: "rear_left", label: t("areaRearLeft"), className: "left-[1%] bottom-[17%] w-[20%] h-[27%]" },
    { key: "rear_right", label: t("areaRearRight"), className: "right-[1%] bottom-[17%] w-[20%] h-[27%]" },
    { key: "interior", label: t("areaInterior"), className: "left-[35%] top-[36%] w-[30%] h-[28%]" }
  ];
  const areas = bike ? bikeAreas : carAreas;

  return (
    <div className="relative mx-auto aspect-[3/4] max-h-[420px] max-w-sm rounded-xl border border-[var(--border)] bg-white p-4">
      {bike ? (
        <svg className="h-full w-full text-[var(--primary)]" viewBox="0 0 180 260" role="img" aria-label={t("vehicleDiagram")}>
          <rect x="81" y="12" width="18" height="50" rx="9" fill="#1b2430" />
          <rect x="79" y="198" width="22" height="50" rx="10" fill="#1b2430" />
          <rect x="66" y="56" width="48" height="156" rx="22" fill="#e6edf5" stroke="currentColor" strokeWidth="3" />
          <rect x="42" y="50" width="96" height="10" rx="5" fill="currentColor" />
          <rect x="74" y="116" width="32" height="74" rx="13" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
        </svg>
      ) : (
        <svg className="h-full w-full text-[var(--primary)]" viewBox="0 0 180 260" role="img" aria-label={t("vehicleDiagram")}>
          <rect x="50" y="18" width="80" height="224" rx="35" fill="#e6edf5" stroke="currentColor" strokeWidth="3" />
          <rect x="64" y="58" width="52" height="42" rx="10" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          <rect x="62" y="112" width="56" height="56" rx="14" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          <rect x="65" y="184" width="50" height="28" rx="8" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          <circle cx="45" cy="70" r="11" fill="#1b2430" />
          <circle cx="135" cy="70" r="11" fill="#1b2430" />
          <circle cx="45" cy="194" r="11" fill="#1b2430" />
          <circle cx="135" cy="194" r="11" fill="#1b2430" />
        </svg>
      )}
      {areas.map((area) => (
        <button
          aria-label={t("logDamageAt", { area: area.label })}
          className={`absolute flex items-center justify-center rounded-lg border px-1 text-center text-[11px] font-semibold leading-tight ${selected === area.key ? "border-[var(--primary)] bg-[var(--primary)] text-white" : marked?.includes(area.key) ? "border-[var(--danger)] bg-[var(--danger-light)] text-[var(--danger)]" : "border-[var(--primary)]/25 bg-[var(--primary)]/5 text-[var(--primary)]"} ${area.className}`}
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
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <canvas
        className="h-48 w-full touch-none rounded-lg bg-[var(--panel-secondary)]"
        height={220}
        onPointerDown={(event) => {
          const canvas = canvasRef.current;
          const context = canvas?.getContext("2d");
          if (!context) return;
          drawing.current = true;
          const { x, y } = point(event);
          context.lineWidth = 3;
          context.lineCap = "round";
          context.strokeStyle = "#1b2430";
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
        <p className="text-xs font-semibold text-[var(--muted)]">{value ? t("signatureCaptured") : t("signInBox")}</p>
        <button
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]"
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

export function InspectionForm({ context, unsigned = false }: { context: InspectionContext; /** The customer has not signed the agreement yet. */ unsigned?: boolean }) {
  const t = useTranslations("inspection");
  const locale = useLocale();
  const areaName = (location: string) => {
    const key = `area${location.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join("")}`;
    return t.has(key) ? t(key) : location.replace(/_/g, " ");
  };
  const severityKeys: Record<string, string> = {
    scratch: "damageScratch",
    dent: "damageDent",
    crack: "damageCrack",
    missing: "damageMissingPart",
    other: "damageOther"
  };
  const severityName = (severity: string | null | undefined) =>
    severity && severityKeys[severity] ? t(severityKeys[severity]) : String(severity || "");
  const mode = context.mode;
  const isSwap = Boolean(context.swap);
  // A vehicle collected in a swap doesn't settle the deposit: the rental carries on.
  const depositAlreadyReturned = mode === "return" && !isSwap && context.rental?.deposit_status === "fully_returned";
  // No tracker fitted: skip the GPS step rather than show an empty screen.
  const hasGps = Boolean(context.gpsDevice);
  const withoutGps = (list: string[]) => (hasGps ? list : list.filter((item) => item !== "GPS"));
  // Bikes have a left and right side, and no cabin or boot to photograph.
  const isBike = isTwoWheeler(kindFromCategory(context.vehicle.vehicle_categories));
  const [step, setStep] = useState(0);
  const [odometer, setOdometer] = useState("");
  const odometerRef = useRef(odometer);
  odometerRef.current = odometer;
  const [ocrMessage, setOcrMessage] = useState("");
  const [odometerPhotoCaptured, setOdometerPhotoCaptured] = useState(false);
  const [fuelPhotoCaptured, setFuelPhotoCaptured] = useState(false);
  const [fuelLevel, setFuelLevel] = useState<number | null>(null);
  const [fuelLabel, setFuelLabel] = useState("");
  const [damageItems, setDamageItems] = useState<DamageItem[]>([]);
  // Thumbnails of the photo chosen for each damage item, so staff can see it was added.
  const [damagePhotoPreviews, setDamagePhotoPreviews] = useState<Record<string, string>>({});
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
  const [refundMethod, setRefundMethod] = useState("cash");
  const [isPending, startTransition] = useTransition();
  const [uploadProgress, setUploadProgress] = useState("");
  const [uploadError, setUploadError] = useState("");
  const [isReceiptPending, startReceiptTransition] = useTransition();
  // Pre-fill with rent that is due now and still unpaid; the full monthly rate
  // is only a fallback when the booking has no payment schedule at all.
  const [deliveryPaymentAmount, setDeliveryPaymentAmount] = useState(() => {
    const unpaid = (context.unpaidPayments || []).filter((payment: any) => payment.metadata?.type !== "deposit" && payment.metadata?.is_deposit !== true);
    if (context.hasPaymentSchedule) {
      const due = unpaid.reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
      return due > 0 ? String(due) : "";
    }
    return String(Number(context.rental?.rental_rate || 0) || "");
  });
  const [deliveryDepositAmount, setDeliveryDepositAmount] = useState(() => {
    const expectedDeposit = Number(context.rental?.deposit_payment_amount || context.rental?.deposit_amount || 0);
    const heldDeposit = Number(context.rental?.deposit_held || 0);
    const remainingDeposit = Math.max(0, expectedDeposit - heldDeposit);
    return remainingDeposit ? String(remainingDeposit) : "";
  });
  // A booking with no deposit (or one already held in full) has no deposit box to fill in.
  const [depositToCollect] = useState(() => Boolean(deliveryDepositAmount));
  // Already paid before handover (a transfer, say): there is no cash to count, so the cash boxes stay folded away.
  const [collectOpen, setCollectOpen] = useState(() => Boolean(deliveryPaymentAmount || deliveryDepositAmount) || !context.hasPaymentSchedule);
  const [receiptResult, setReceiptResult] = useState<ReceiptResult | null>(null);
  const [receiptError, setReceiptError] = useState("");

  const draftKey = `routehq-inspection-${mode}-${context.rental?.id || context.vehicle.id}${isSwap ? `-swap-${context.vehicle.id}` : ""}`;
  const deliveryFuel = Number(context.deliveryInspection?.fuel_level || 0);
  const depositHeld = Number(context.rental?.deposit_held || 0);
  const alreadyRefunded = Number(context.rental?.deposit_refunded_amount || 0);
  const alreadyForfeited = Number(context.rental?.deposit_forfeited_amount || 0);
  const availableToReconcile = Math.max(0, depositHeld - alreadyRefunded - alreadyForfeited);
  // A deposit that was never collected is not money owed for the rental.
  const outstandingBalance = (context.unpaidPayments || [])
    .filter((payment: any) => payment.metadata?.type !== "deposit" && payment.metadata?.is_deposit !== true)
    .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
  const requestedDeductions = outstandingBalance + fuelDeficitCharge + damageCharge + cleaningCharge;
  const appliedDeductions = Math.min(availableToReconcile, requestedDeductions);
  const calculatedRefund = Math.max(0, availableToReconcile - appliedDeductions);
  const depositRefundAmount = Math.min(availableToReconcile, Math.max(0, refundOverride ? Number(refundOverride) : calculatedRefund));
  // No deposit held and nothing to take from one: a screen of "0 held, 0 returned" is not a step.
  const nothingToSettle = mode === "return" && !isSwap && availableToReconcile <= 0 && requestedDeductions <= 0;
  const skipDepositStep = depositAlreadyReturned || (mode === "return" && isSwap) || nothingToSettle;
  const steps = mode === "return" ? (skipDepositStep ? returnSteps.filter((item) => item !== "Deposit") : returnSteps) : withoutGps(mode === "condition_report" ? conditionSteps : deliverySteps);
  const preExistingDamage = useMemo(() => {
    const items = Array.isArray(context.deliveryInspection?.damage_items) ? context.deliveryInspection.damage_items : [];
    return items.filter((item: any) => item?.is_pre_existing);
  }, [context.deliveryInspection]);

  const rentalPeriod = useMemo(() => {
    if (!context.rental?.start_date) {
      return t("rentalPeriodNotSet");
    }
    if (context.rental.end_date) {
      return `${context.rental.start_date} to ${context.rental.end_date}`;
    }
    return t("openEndedFrom", { date: context.rental.start_date });
  }, [context.rental?.end_date, context.rental?.start_date]);

  useEffect(() => {
    const saved = localStorage.getItem(draftKey);
    if (!saved) {
      return;
    }
    try {
      const draft = JSON.parse(saved);
      // Photos and video can't be kept in a draft, so a resumed inspection goes
      // back to the first photo step; typed values stay filled in.
      setStep(Math.min(Number(draft.step) || 0, 1));
      setOdometer(draft.odometer || "");
      setFuelLevel(draft.fuelLevel ?? null);
      setFuelLabel(draft.fuelLabel || "");
      setDamageItems(draft.damageItems || []);
      setNoDamage(Boolean(draft.noDamage));
      // A signature is never restored: the customer signs the report as it stands now.
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
        signedName,
        fuelDeficitCharge,
        damageCharge,
        cleaningCharge,
        refundOverride
      })
    );
  }, [cleaningCharge, damageCharge, damageItems, draftKey, fuelDeficitCharge, fuelLabel, fuelLevel, noDamage, odometer, refundOverride, signedName, step]);

  async function readOdometer(file: File) {
    setOcrMessage(t("ocrReading"));
    const data = new FormData();
    data.append("file", file);
    // Never leave "Reading…" on screen for good: after 20 seconds give up and ask for the number to be typed.
    const giveUp = new AbortController();
    const timer = setTimeout(() => giveUp.abort(), 20000);
    try {
      const response = await fetch("/api/ocr/odometer", { method: "POST", body: data, signal: giveUp.signal });
      const result = await response.json();
      clearTimeout(timer);
      if (!response.ok) {
        setOcrMessage(result.error || t("ocrUnavailable"));
        return;
      }
      // Fill the reading only when staff haven't typed one: never silently replace a number someone entered.
      if (result.odometer_reading && Number(result.confidence || 0) >= 0.65 && !odometerRef.current.trim()) {
        setOdometer(String(result.odometer_reading));
        setOcrMessage(t("ocrSuggested", { km: Number(result.odometer_reading).toLocaleString() }));
      } else if (result.odometer_reading) {
        setOcrMessage(t("ocrPossible", { km: Number(result.odometer_reading).toLocaleString() }));
      } else {
        setOcrMessage(t("ocrUnclear"));
      }
    } catch {
      clearTimeout(timer);
      setOcrMessage(t("ocrFailed"));
    }
  }

  // The reading taken when this vehicle was handed over. Unknown (not zero) when there is none on file.
  const handoverKm = context.rental?.mileage_at_delivery != null ? Number(context.rental.mileage_at_delivery) : null;

  function canAdvance() {
    if (step === 1) return Boolean(odometer && odometerPhotoCaptured);
    if (step === 2) return fuelLevel !== null && fuelPhotoCaptured;
    if (step === 3) return videoCaptured || ["front", "rear", "driver", "passenger"].every((key) => sidePhotos[key]);
    if (step === 4) return noDamage || damageItems.length > 0;
    if (step === steps.length - 1 && mode !== "condition_report") return Boolean(signature && signedName);
    return true;
  }

  // A greyed-out Next with no reason given leaves someone standing next to a customer, guessing.
  function whatIsMissing() {
    if (canAdvance()) return "";
    if (step === 1) return t("need_odometer");
    if (step === 2) return t("need_fuel");
    if (step === 3) return t("need_walkaround");
    if (step === 4) return t("need_damage");
    if (step === steps.length - 1) return t("need_signature");
    return "";
  }

  function addDamage() {
    if (!selectedLocation || !damageDescription.trim()) {
      return;
    }
    const id = crypto.randomUUID();
    const description = damageDescription.trim();
    // A double tap must not record the same mark twice.
    setDamageItems((items) =>
      items.some((item) => item.location === selectedLocation && item.severity === damageSeverity && item.description === description)
        ? items
        : [
            ...items,
            {
              id,
              location: selectedLocation,
              severity: damageSeverity,
              description,
              photo_key: id,
              is_pre_existing: mode !== "return",
              noted_at: mode === "return" ? "return" : "delivery"
            }
          ]
    );
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
      setReceiptError(t("receiptNeedsAmount"));
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
        setReceiptError(shownError(error, t("receiptFailed")));
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
      <>
      {uploadError ? (
        <p className="mt-4 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3 text-sm font-bold text-[var(--danger)]" role="alert">
          {uploadError}
        </p>
      ) : null}
      {step > 0 && whatIsMissing() ? <p className="mt-4 text-center text-sm font-semibold text-[var(--muted)]">{whatIsMissing()}</p> : null}
      {/* The first screen has its own "Start" button; Back and Next begin on step 2. */}
      <div className={`sticky-actions sticky z-20 -mx-4 mt-4 gap-2 border-t ${step === 0 ? "hidden" : "flex"} border-[var(--border)] bg-white/95 p-4 backdrop-blur sm:mx-0 sm:rounded-lg sm:border`}>
        <button
          className={`${touchButton} flex-1 border border-[var(--border)] bg-white text-[var(--foreground-secondary)] disabled:opacity-50`}
          disabled={step === 0}
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          type="button"
        >
          <ChevronLeft size={18} />
          {t("back")}
        </button>
        {step < steps.length - 1 ? (
          <button
            className={`${touchButton} flex-1 bg-[var(--primary)] text-white shadow-lg disabled:bg-[var(--muted)]`}
            disabled={!canAdvance()}
            // Distinct keys stop React reusing this button as the submit button, which let the
            // click that opened the last step also submit (condition reports need no signature).
            key="next"
            onClick={() => setStep((current) => Math.min(steps.length - 1, current + 1))}
            type="button"
          >
            {t("next")}
            <ChevronRight size={18} />
          </button>
        ) : (
          <button
            className={`${touchButton} flex-1 bg-[var(--primary)] text-white shadow-lg disabled:bg-[var(--muted)]`}
            disabled={!canAdvance() || isPending}
            form="inspectionForm"
            key="submit"
            onClick={(event) => {
              event.preventDefault();
              const form = document.getElementById("inspectionForm") as HTMLFormElement | null;
              if (!form) return;
              setUploadError("");
              startTransition(async () => {
                try {
                  // Photos and video go straight to storage first; the form then
                  // carries only their paths (Vercel refuses bodies over 4.5 MB).
                  const formData = await uploadFormFiles(
                    new FormData(form),
                    (files) => prepareInspectionUploads(context.organizationId, files),
                    (done, total) => setUploadProgress(total ? t("uploadingPhotos", { done, total }) : "")
                  );
                  setUploadProgress("");
                  localStorage.removeItem(draftKey);
                  await submitInspection(formData);
                } catch (error) {
                  if (String((error as any)?.digest || "").startsWith("NEXT_REDIRECT")) throw error;
                  setUploadProgress("");
                  setUploadError(shownError(error, t("uploadFailed")));
                }
              });
            }}
            type="submit"
          >
            {isPending ? uploadProgress || t("submitting") : mode === "return" ? t("submitReturn") : mode === "condition_report" ? t("saveConditionReport") : t("submitDelivery")}
          </button>
        )}
      </div>
      </>
    );
  }

  return (
    // Submitting only happens through the Submit button, which uploads the
    // photos first. Pressing Enter in a field must not post the files directly.
    <form method="post" className="mx-auto max-w-3xl space-y-4" id="inspectionForm" onSubmit={(event) => event.preventDefault()}>
      <input name="organizationId" type="hidden" value={context.organizationId} />
      <input name="mode" type="hidden" value={mode} />
      <input name="swap" type="hidden" value={isSwap ? "1" : ""} />
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
      <input name="depositRefundMethod" type="hidden" value={depositRefundAmount > 0 ? refundMethod : ""} />
      <input name="depositOutstandingBalance" type="hidden" value={outstandingBalance} />
      <input name="depositFuelDeficitCharge" type="hidden" value={fuelDeficitCharge} />
      <input name="depositDamageCharge" type="hidden" value={damageCharge} />
      <input name="depositCleaningCharge" type="hidden" value={cleaningCharge} />

      <Progress step={step} steps={steps} />

      {step === 0 ? (
        <StepShell eyebrow={t("eyebrowVehicleConfirmation")} title={mode === "return" ? t("titleConfirmReturn") : mode === "condition_report" ? t("titleStartCondition") : t("titleConfirmHandover")}>
          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="flex items-start gap-4">
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-light)] text-[var(--primary)]">
                <VehicleKindIcon boxed={false} kind={kindFromCategory(context.vehicle.vehicle_categories)} size={30} />
              </span>
              <div>
                <p className="text-2xl font-semibold text-[var(--foreground)]">{titleFor(context)}</p>
                <p className="font-mono-data mt-1 text-lg font-semibold text-[var(--foreground)]">{context.vehicle.registration_number}</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  {mode === "return" && context.customer?.full_name ? context.customer.full_name : null}
                  {mode !== "return" && context.customer?.full_name ? `${context.customer.full_name} · ` : ""}
                  {mode === "return" ? null : context.rental?.start_date ? t("rentalStarts", { date: formatDate(context.rental.start_date, locale) }) : t("standaloneReport")}
                </p>
                {mode === "delivery" && context.rental?.start_date && String(context.rental.start_date).slice(0, 10) > businessToday(1) ? (
                  <p className="mt-2 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">{t("startsLaterNote", { date: formatDate(context.rental.start_date, locale) })}</p>
                ) : null}
                {mode === "delivery" && unsigned ? (
                  <p className="mt-2 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">{t("notSignedNote")}</p>
                ) : null}
                {mode === "return" ? (
                  <p className="mt-2 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-bold text-[var(--warning)]">
                    <span className="font-mono-data">
                      {handoverKm != null ? `${t("odometerAtDelivery", { km: handoverKm.toLocaleString("en-US") })} · ` : ""}
                      {t("rentalLengthDays", { count: daysBetween(context.rental?.start_date) })}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          <button className={`${touchButton} mt-5 w-full bg-[var(--primary)] text-white shadow-lg`} onClick={() => setStep(1)} type="button">
            {mode === "return" ? t("startReturn") : mode === "condition_report" ? t("startCondition") : t("startDelivery")}
          </button>
        </StepShell>
      ) : null}

      {/* Steps 1-4 hold photo inputs. They stay on the page (hidden) after the
          user moves on: the photos are sent with the form at the end, so a
          step that was removed from the page would lose its photos. */}
      <div hidden={step !== 1}>
        <StepShell eyebrow={t("odometer")} title={t("odometerPhoto")}>
          <FileCapture
            accept="image/*"
            label={t("odometerCamera")}
            name="photo_odometer"
            onSelected={(file) => {
              setOdometerPhotoCaptured(true);
              readOdometer(file);
            }}
          />
          {ocrMessage ? <p className="mt-3 rounded-lg bg-[var(--panel-secondary)] p-3 text-sm font-semibold text-[var(--primary)]">{ocrMessage}</p> : null}
          {mode === "return" && handoverKm != null ? (
            <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
              <span className="font-mono-data">{t("odometerAtDelivery", { km: handoverKm.toLocaleString("en-US") })}</span>
            </p>
          ) : null}
          <label className="mt-4 block">
            <span className="text-sm font-semibold text-[var(--foreground)]">{t("confirmOdometer")}</span>
            <input className={inputClass} inputMode="numeric" min="0" onChange={(event) => setOdometer(event.target.value)} placeholder={t("odometerExample")} type="number" value={odometer} />
          </label>
          {mode === "return" && odometer && handoverKm != null ? (
            <p className="mt-3 rounded-lg bg-white p-3 text-sm font-semibold text-[var(--foreground)]">
              <span className="font-mono-data">
                {t("drivenDuringRental", { km: Math.max(0, Number(odometer || 0) - handoverKm).toLocaleString("en-US") })}
              </span>
            </p>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">{t("odometerUpdatesMileage")}</p>
          )}
          {odometer && Number(context.vehicle?.mileage || 0) > Number(odometer) ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] px-3 py-2 text-sm font-bold text-[var(--warning)]" role="alert">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              {t("odometerBelowLast", { km: Number(context.vehicle.mileage).toLocaleString("en-US") })}
            </p>
          ) : null}
        </StepShell>
      </div>

      <div hidden={step !== 2}>
        <StepShell eyebrow={t("eyebrowFuelLevel")} title={t("fuelPhoto")}>
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
            <div className="mt-4 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] p-3">
              <p className="font-semibold text-[var(--warning)]">{t("fuelDeficitApprox", { percent: deliveryFuel - fuelLevel })}</p>
              <label className="mt-2 block text-sm font-bold text-[var(--foreground)]">
                {t("applyFuelCharge")}
                <input className={inputClass} min="0" onChange={(event) => setFuelDeficitCharge(Number(event.target.value || 0))} placeholder="THB" step="0.01" type="number" value={fuelDeficitCharge || ""} />
              </label>
            </div>
          ) : null}
        </StepShell>
      </div>

      <div hidden={step !== 3}>
        <StepShell eyebrow={t("eyebrowWalkaround")} title={t("recordCondition")}>
          <p className="mb-3 text-sm text-[var(--muted)]">{t("conditionMinimum")}</p>
          <FileCapture accept="video/*" icon={FileVideo} label={t("recordVideo")} name="walkaroundVideo" onSelected={() => setVideoCaptured(true)} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[
              ["front", t("areaFront")],
              ["rear", t("areaRear")],
              ["driver", isBike ? t("sideLeft") : t("sideDriver")],
              ["passenger", isBike ? t("sideRight") : t("sidePassenger")],
              ...(isBike ? [] : [["interior", t("interiorOptional")], ["boot", t("bootOptional")]])
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
        </StepShell>
      </div>

      <div hidden={step !== 4}>
        <StepShell eyebrow={t("eyebrowDamageCheck")} title={mode === "return" ? t("checkNewDamage") : t("logPreExistingDamage")}>
          {preExistingDamage.length > 0 ? (
            <div className="mb-4 rounded-lg border border-[var(--border)] bg-white p-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{t("preExistingDamage")}</p>
              <div className="mt-2 space-y-2">
                {preExistingDamage.map((item: any) => (
                  <p className="rounded-lg bg-[var(--panel-secondary)] px-3 py-2 text-sm text-[var(--foreground-secondary)]" key={item.id}>
                    {areaName(String(item.location || ""))} · {severityName(item.severity)} · {item.description_translated || item.description}
                    {item.description_translated ? <span className="mt-1 block text-xs text-[var(--muted)]">{item.description}</span> : null}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          <label className="checkbox-label mb-3 min-h-12 rounded-lg border border-[var(--border)] bg-white px-4 py-3 font-bold text-[var(--foreground)]">
            <input checked={noDamage} className="flex-shrink-0" onChange={(event) => setNoDamage(event.target.checked)} type="checkbox" />
            <span>{t("noDamageToReport")}</span>
          </label>
          {noDamage && damageItems.length === 0 ? null : (
            <>
            <VehicleDiagram bike={isBike} marked={damageItems.map((item) => item.location)} onSelect={setSelectedLocation} selected={selectedLocation} />
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-4">
              <p className="font-semibold text-[var(--foreground)]">{selectedLocation ? t("damageAt", { area: areaName(selectedLocation) }) : t("tapArea")}</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-bold text-[var(--foreground)]">{t("severity")}</span>
                  <select className={inputClass} onChange={(event) => setDamageSeverity(event.target.value)} value={damageSeverity}>
                    <option value="scratch">{t("damageScratch")}</option>
                    <option value="dent">{t("damageDent")}</option>
                    <option value="crack">{t("damageCrack")}</option>
                    <option value="missing">{t("damageMissingPart")}</option>
                    <option value="other">{t("damageOther")}</option>
                  </select>
                </label>
                <label className="block sm:col-span-2">
                  <span className="text-sm font-bold text-[var(--foreground)]">{t("description")}</span>
                  <input className={inputClass} onChange={(event) => setDamageDescription(event.target.value)} placeholder={t("shortDescription")} value={damageDescription} />
                </label>
              </div>
              <button className={`${touchButton} mt-3 bg-[var(--primary)] text-white`} disabled={!selectedLocation || !damageDescription.trim()} onClick={addDamage} type="button">
                {t("saveDamageItem")}
              </button>
            </div>
            </>
          )}
          <div className="mt-3 space-y-2">
            {damageItems.map((item) => (
              <div className="rounded-lg border border-[var(--border)] bg-white p-3" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{areaName(item.location)} · {severityName(item.severity)}</p>
                    <p className="text-sm text-[var(--muted)]">{item.description}</p>
                    <div className="mt-2 flex items-center gap-2">
                      {damagePhotoPreviews[item.id] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img alt="" className="h-14 w-14 rounded-lg border border-[var(--border)] object-cover" src={damagePhotoPreviews[item.id]} />
                      ) : null}
                      <label className="inline-flex cursor-pointer rounded-lg bg-[var(--primary-light)] px-3 py-2 text-sm font-bold text-[var(--primary)]">
                        {damagePhotoPreviews[item.id] ? t("changeDamagePhoto") : t("addDamagePhoto")}
                        <input
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
                          name={`damagePhoto_${item.id}`}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0];
                            const previous = damagePhotoPreviews[item.id];
                            if (previous) URL.revokeObjectURL(previous);
                            const url = file ? URL.createObjectURL(file) : null;
                            setDamagePhotoPreviews((previews) => {
                              const next = { ...previews };
                              if (url) next[item.id] = url;
                              else delete next[item.id];
                              return next;
                            });
                          }}
                          type="file"
                        />
                      </label>
                    </div>
                  </div>
                  <button className="rounded-lg border border-[var(--danger-line)] p-2 text-[var(--danger)]" onClick={() => setDamageItems((items) => items.filter((entry) => entry.id !== item.id))} type="button">
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {mode === "return" && damageItems.some((item) => !item.is_pre_existing) ? (
            <label className="mt-4 block rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-3">
              <span className="text-sm font-semibold text-[var(--danger)]">{t("applyDamageExcess")}</span>
              <input className={inputClass} min="0" onChange={(event) => setDamageCharge(Number(event.target.value || 0))} placeholder="THB" step="0.01" type="number" value={damageCharge || ""} />
            </label>
          ) : null}
        </StepShell>
      </div>

      {step === 5 && mode !== "return" && hasGps ? (
        <StepShell eyebrow={t("eyebrowGpsCheck")} title={t("confirmTracker")}>
          {context.gpsDevice ? (
            <div className="rounded-xl border border-[var(--border)] bg-white p-4">
              <div className="flex items-start gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-lg ${context.gpsDevice.last_seen_at ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>
                  {context.gpsDevice.last_seen_at ? <CheckCircle2 /> : <AlertTriangle />}
                </span>
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{context.gpsDevice.last_seen_at ? t("gpsActive") : t("gpsOffline")}</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {context.gpsDevice.provider} · Last seen {context.gpsDevice.last_seen_at ? formatDate(context.gpsDevice.last_seen_at) : "never"}
                  </p>
                  {context.latestLocation ? (
                    <p className="mt-1 flex items-center gap-1 text-sm text-[var(--muted)]">
                      <MapPin size={14} />
                      {context.latestLocation.latitude}, {context.latestLocation.longitude}
                    </p>
                  ) : null}
                </div>
              </div>
              <label className="checkbox-label mt-4 min-h-12 rounded-lg bg-[var(--panel-secondary)] px-4 py-3 font-bold text-[var(--foreground)]">
                <input className="flex-shrink-0" type="checkbox" />
                <span>{t("gpsConfirm")}</span>
              </label>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-white p-4 text-center">
              <Smartphone className="mx-auto text-[var(--muted)]" size={34} />
              <p className="mt-3 font-semibold text-[var(--foreground)]">{t("noGpsDevice")}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("noGpsContinue")}</p>
            </div>
          )}
        </StepShell>
      ) : null}

      {step === 5 && mode === "return" && !skipDepositStep ? (
        <StepShell eyebrow={t("eyebrowDepositReconciliation")} title={t("confirmDepositRefund")}>
          <div className="space-y-3 rounded-xl border border-[var(--border)] bg-white p-4">
            <Row label={t("depositHeld")} value={money(depositHeld)} />
            {alreadyRefunded > 0 ? <Row label={t("alreadyRefunded")} value={`-${money(alreadyRefunded)}`} danger /> : null}
            {alreadyForfeited > 0 ? <Row label={t("alreadyForfeited")} value={`-${money(alreadyForfeited)}`} danger /> : null}
            {availableToReconcile !== depositHeld ? <Row label={t("availableToReconcile")} value={money(availableToReconcile)} /> : null}
            {outstandingBalance > 0 ? <Row label={t("outstandingBalance")} value={`-${money(outstandingBalance)}`} danger /> : null}
            {fuelDeficitCharge > 0 ? <Row label={t("fuelDeficitCharge")} value={`-${money(fuelDeficitCharge)}`} danger /> : null}
            {damageCharge > 0 ? <Row label={t("damageExcess")} value={`-${money(damageCharge)}`} danger /> : null}
            {cleaningCharge > 0 ? <Row label={t("cleaningFee")} value={`-${money(cleaningCharge)}`} danger /> : null}
            {requestedDeductions > availableToReconcile ? (
              <p className="rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] px-3 py-2 text-sm font-bold text-[var(--warning)]">
                {t("deductionsExceedDeposit", { amount: money(availableToReconcile) })}
              </p>
            ) : null}
            <div className="border-t border-[var(--border)] pt-3">
              <div className="rounded-lg bg-[var(--primary-light)] p-3">
                <Row label={t("depositRefund")} value={money(depositRefundAmount)} />
              </div>
              {depositRefundAmount > 0 ? (
                <div className="mt-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{t("refundHow")}</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {(["cash", "bank_transfer", "promptpay"] as const).map((method) => (
                      <button
                        aria-pressed={refundMethod === method}
                        className={`min-h-11 rounded-xl border px-2 text-sm font-semibold ${refundMethod === method ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground-secondary)]"}`}
                        key={method}
                        onClick={() => setRefundMethod(method)}
                        type="button"
                      >
                        {t(`refund_${method}`)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {/* Usually the whole deposit goes back, so the two adjustments stay one tap away. */}
            <details open={cleaningCharge > 0 || Boolean(refundOverride)}>
              <summary className="cursor-pointer py-1 text-sm font-semibold text-[var(--primary)]">{t("changeRefund")}</summary>
              <div className="mt-3 space-y-3">
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{t("cleaningFee")}</span>
                  <input className={inputClass} min="0" onChange={(event) => setCleaningCharge(Number(event.target.value || 0))} placeholder="THB" step="0.01" type="number" value={cleaningCharge || ""} />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-[var(--foreground)]">{t("overrideRefund")}</span>
                  <input className={inputClass} min="0" onChange={(event) => setRefundOverride(event.target.value)} placeholder={String(calculatedRefund)} step="0.01" type="number" value={refundOverride} />
                </label>
              </div>
            </details>
          </div>
        </StepShell>
      ) : null}

      {step === steps.length - 1 ? (
        <StepShell eyebrow={t("eyebrowReview")} title={mode === "return" ? t("reviewReturn") : mode === "condition_report" ? t("reviewCondition") : t("reviewHandover")}>
          <div className="grid grid-cols-2 gap-3">
            <SummaryTile icon={Gauge} label={t("odometer")} value={odometer ? t("kmValue", { km: Number(odometer).toLocaleString() }) : t("missing")} />
            <SummaryTile icon={Fuel} label={t("fuel")} value={fuelLabel || t("missing")} />
            <SummaryTile icon={Camera} label={t("photosVideo")} value={videoCaptured ? t("videoCaptured") : t("photoCount", { count: Object.values(sidePhotos).filter(Boolean).length })} />
            <SummaryTile icon={ShieldCheck} label={t("damage")} value={noDamage ? t("noDamageNoted") : t("damageCount", { count: damageItems.length })} />
          </div>
          {mode === "return" && isSwap ? (
            fuelDeficitCharge + damageCharge > 0 ? (
              <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-3">
                <Row label={t("depositDeductions")} value={`-${money(fuelDeficitCharge + damageCharge)}`} danger />
              </div>
            ) : null
          ) : mode === "return" && (depositAlreadyReturned || !nothingToSettle) ? (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-3">
              {depositAlreadyReturned ? (
                <div className="rounded-lg bg-[var(--success-light)] p-3">
                  <Row label={t("depositAlreadyReturned")} value="✓" />
                </div>
              ) : (
                <>
                  <Row label={t("depositDeductions")} value={`-${money(appliedDeductions)}`} danger={appliedDeductions > 0} />
                  <Row label={t("depositRefundConfirmed")} value={money(depositRefundAmount)} />
                </>
              )}
            </div>
          ) : null}
          {mode === "delivery" && context.rental?.id && !isSwap && !collectOpen ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                <CheckCircle2 size={18} />
                {t("nothingToCollect")}
              </p>
              <button className="text-sm font-bold text-[var(--primary)] underline" onClick={() => setCollectOpen(true)} type="button">
                {t("recordCashAnyway")}
              </button>
            </div>
          ) : null}
          {mode === "delivery" && context.rental?.id && !isSwap && collectOpen ? (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{t("cashPayment")}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{t("cashPaymentHint")}</p>
                </div>
                {receiptResult ? (
                  <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-xs font-semibold uppercase text-[var(--success)]">
                    {t("receiptReady")}
                  </span>
                ) : null}
              </div>
              <div className={`mt-3 grid gap-3 ${depositToCollect ? "sm:grid-cols-[1fr_1fr_auto]" : "sm:grid-cols-[1fr_auto]"}`}>
                <label className="block">
                  <span className="text-sm font-bold text-[var(--foreground)]">{t("rentalPaymentReceived")}</span>
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
                <label className={depositToCollect ? "block" : "hidden"}>
                  <span className="text-sm font-bold text-[var(--foreground)]">{t("depositAmountReceived")}</span>
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
                  className={`${touchButton} self-end bg-[var(--primary)] text-white disabled:bg-[var(--muted)]`}
                  disabled={isReceiptPending || Boolean(receiptResult)}
                  onClick={generateDeliveryReceipt}
                  type="button"
                >
                  {isReceiptPending ? t("generating") : receiptResult ? t("receiptGenerated") : t("confirmCashReceipt")}
                </button>
              </div>
              {receiptError ? (
                <p className="mt-3 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] px-3 py-2 text-sm font-bold text-[var(--danger)]">{receiptError}</p>
              ) : null}
              {receiptResult ? (
                <div className="mt-3 rounded-lg border border-[var(--success-line)] bg-[var(--success-light)] p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
                    <CheckCircle2 size={18} />
                    {t("receiptNumberGenerated", { number: receiptResult.receipt_number })}
                  </p>
                  <p className="mt-1 text-xs font-semibold text-[var(--success)]">
                    {Number(deliveryDepositAmount || 0) > 0
                      ? t("receiptBreakdown", { rent: money(Number(deliveryPaymentAmount || 0)), deposit: money(Number(deliveryDepositAmount || 0)) })
                      : t("receiptRentOnly", { rent: money(Number(deliveryPaymentAmount || 0)) })}
                  </p>
                  {receiptResult.warning ? (
                    <p className="mt-2 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] px-3 py-2 text-xs font-bold text-[var(--warning)]">{receiptResult.warning}</p>
                  ) : null}
                  {receiptResult.pdf_url ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button className={`${touchButton} border border-[var(--success-line)] bg-white text-[var(--success)]`} onClick={shareReceipt} type="button">
                        {t("shareReceipt")}
                      </button>
                      <a className={`${touchButton} border border-[var(--success-line)] bg-white text-[var(--success)]`} href={receiptResult.pdf_url} rel="noreferrer" target="_blank">
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
              <p className="mt-5 text-base font-semibold text-[var(--foreground)]">
                {t(mode === "return" ? "receivingFrom" : "handingOverTo", { name: context.customer?.full_name || t("theCustomer") })}
              </p>
              <p className="mt-1 text-sm text-[var(--muted)]">{t("signPrompt")}</p>
              <div className="mt-3">
                <SignaturePad onChange={setSignature} value={signature} />
              </div>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-[var(--foreground)]">{t("customerPrintedName")}</span>
                <input className={inputClass} onChange={(event) => setSignedName(event.target.value)} value={signedName} />
              </label>
            </>
          ) : (
            <label className="mt-4 block">
              <span className="text-sm font-semibold text-[var(--foreground)]">{t("notes")}</span>
              <textarea className={inputClass} name="notes" placeholder={t("notesPlaceholder")} rows={4} />
            </label>
          )}
          {typeof navigator !== "undefined" && "share" in navigator ? (
            <button
              className={`${touchButton} mt-4 border border-[var(--border)] bg-white text-[var(--foreground-secondary)]`}
              onClick={() => navigator.share?.({ title: "RouteHQ inspection summary", text: `${titleFor(context)} inspection summary is ready.` })}
              type="button"
            >
              {t("shareWithCustomer")}
            </button>
          ) : null}
        </StepShell>
      ) : null}

      {nav()}

      <Link className="inline-flex items-center gap-2 text-sm font-bold text-[var(--primary)]" href={(context.rental?.id ? `/bookings/${context.rental.id}` : `/fleet/${context.vehicle.id}`) as Route}>
        <ChevronLeft size={16} />
        {context.rental?.id ? t("backToBooking") : t("backToVehicle")}
      </Link>
    </form>
  );
}

function Row({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm font-bold text-[var(--muted)]">{label}</span>
      <span className={`font-mono-data text-base font-semibold ${danger ? "text-[var(--danger)]" : "text-[var(--foreground)]"}`}>{value}</span>
    </div>
  );
}

function SummaryTile({ icon: Icon, label, value }: { icon: typeof Gauge; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-3">
      <Icon className="text-[var(--primary)]" size={20} />
      <p className="mt-2 text-xs font-bold uppercase text-[var(--muted)]">{label}</p>
      <p className="font-mono-data mt-1 font-semibold text-[var(--foreground)]">{value}</p>
    </div>
  );
}
