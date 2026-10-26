"use client";

import { businessToday, toWallTime } from "@/lib/business-time";
import { shownError } from "@/lib/error-text";
import { isTwoWheeler, kindFromCategory } from "@/lib/vehicle-groups";
import { VehicleArt } from "@/components/vehicle-art";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import type { Route } from "next";
import { AlertTriangle, Camera, CheckCircle2, ChevronLeft, ChevronRight, FileVideo, Fuel, Gauge, MapPin, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { submitInspection } from "@/app/actions/inspections";
import { prepareInspectionUploads } from "@/app/actions/uploads";
import { compressImage, startEarlyUpload, uploadFormFiles } from "@/lib/direct-upload-client";
import { recordDeliveryCashPaymentAndReceipt } from "@/app/actions/transactions";
import type { InspectionContext } from "@/lib/inspection-detail";
import { earlyStartFor, type EarlyStartChoice } from "@/lib/early-start";
import { lateStartFor, type LateStartChoice } from "@/lib/late-start";
import { dateFormat } from "@/lib/i18n/dates";

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
  return dateFormat(locale === "en-GB" ? "en" : locale, { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
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
  compact = false,
  onSelected
}: {
  label: string;
  name: string;
  accept: string;
  capture?: "environment" | "user";
  icon?: typeof Camera;
  compact?: boolean;
  onSelected?: (file: File) => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const t = useTranslations("inspection");
  const isVideo = accept.startsWith("video");

  return (
    <label
      aria-label={label}
      className={`block cursor-pointer rounded-xl border-2 border-dashed transition-colors ${compact ? "p-2" : "p-3"} ${
        preview
          ? "border-solid border-[var(--success-line)] bg-white"
          : dragging
            ? "border-[var(--primary)] bg-[var(--primary-light)]"
            : "border-[var(--info-line)] bg-[var(--primary-light)]/60 hover:border-[var(--primary)] hover:bg-[var(--primary-light)]"
      }`}
      // On a computer a photo can be dragged straight onto the box.
      onDragLeave={() => setDragging(false)}
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const input = inputRef.current;
        const file = event.dataTransfer.files?.[0];
        if (!input || !file || !file.type.startsWith(isVideo ? "video" : "image")) return;
        const list = new DataTransfer();
        list.items.add(file);
        input.files = list.files;
        input.dispatchEvent(new Event("change", { bubbles: true }));
      }}
    >
      {preview ? null : compact ? (
        <span className="flex min-h-[96px] flex-col items-center justify-center gap-2 text-center text-sm font-semibold leading-tight text-[var(--primary)]">
          <Icon className="shrink-0" size={24} />
          {label}
        </span>
      ) : (
        // The heading above already says what to photograph, so the box just says what it does:
        // "Take photo" on a phone (it opens the camera), "Upload photo" on a computer.
        <span className="flex min-h-[132px] flex-col items-center justify-center gap-2 px-3 py-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-[var(--primary)] shadow-[var(--shadow-sm)]">
            <Icon className="shrink-0" size={22} />
          </span>
          <span className="text-base font-bold leading-tight text-[var(--primary)]">
            <span className="lg:hidden">{t(isVideo ? "cap_takeVideo" : "cap_take")}</span>
            <span className="hidden lg:inline">{t(isVideo ? "cap_uploadVideo" : "cap_upload")}</span>
          </span>
          <span className="text-sm font-medium text-[var(--foreground-secondary)]">
            <span className="lg:hidden">{t(isVideo ? "cap_hintPhoneVideo" : "cap_hintPhone")}</span>
            <span className="hidden lg:inline">{t(isVideo ? "cap_hintDeskVideo" : "cap_hintDesk")}</span>
          </span>
        </span>
      )}
      <input
        accept={accept}
        capture={capture}
        className="sr-only"
        name={name}
        ref={inputRef}
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
        isVideo ? (
          <video className="max-h-52 w-full rounded-lg border border-[var(--border)] object-cover" controls src={preview} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt="" className={`w-full rounded-lg border border-[var(--border)] object-cover ${compact ? "aspect-[4/3]" : "max-h-60"}`} src={preview} />
        )
      ) : null}
      {preview ? (
        compact ? (
          <span className="mt-2 flex items-center justify-center gap-1.5 text-sm font-semibold text-[var(--success)]">
            <CheckCircle2 className="shrink-0" size={16} />
            <span className="truncate">{label}</span>
          </span>
        ) : (
          <span className="mt-3 flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold text-[var(--success)]">
              <CheckCircle2 size={18} />
              {t("photoTaken")}
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold text-[var(--primary)]">
              <Icon size={16} />
              {t("retakePhoto")}
            </span>
          </span>
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
        <span className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2 font-semibold ${value === null ? "bg-[var(--panel-secondary)] text-base text-[var(--muted)]" : "bg-[var(--primary-light)] text-lg text-[var(--primary)]"}`}>
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
          className="h-12 w-full cursor-pointer accent-[#0e5e6f]"
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
    { key: "front", label: t("areaFront"), className: "left-[33.3%] top-[1.5%] w-[33.3%] h-[19.2%]" },
    { key: "rear", label: t("areaRear"), className: "left-[33.3%] top-[79.2%] w-[33.3%] h-[19.2%]" },
    { key: "left_side", label: t("areaLeftSide"), className: "left-[1.1%] top-[32.3%] w-[30.0%] h-[35.4%]" },
    { key: "right_side", label: t("areaRightSide"), className: "left-[68.9%] top-[32.3%] w-[30.0%] h-[35.4%]" },
    { key: "seat", label: t("areaSeat"), className: "left-[38.9%] top-[43.1%] w-[22.2%] h-[30.8%]" }
  ];
  const carAreas = [
    { key: "front", label: t("areaFront"), className: "left-[35.6%] top-[7.7%] w-[28.9%] h-[13.8%]" },
    { key: "interior", label: t("areaInterior"), className: "left-[36.7%] top-[38.5%] w-[26.7%] h-[31.5%]" },
    { key: "rear", label: t("areaRear"), className: "left-[35.6%] top-[82.3%] w-[28.9%] h-[10.8%]" },
    // The sides sit outside the wheels, wide enough for "Front left" on two lines.
    { key: "front_left", label: t("areaFrontLeft"), className: "left-[1.1%] top-[10.8%] w-[22.2%] h-[33.8%]" },
    { key: "front_right", label: t("areaFrontRight"), className: "left-[76.7%] top-[10.8%] w-[22.2%] h-[33.8%]" },
    { key: "rear_left", label: t("areaRearLeft"), className: "left-[1.1%] top-[56.2%] w-[22.2%] h-[33.8%]" },
    { key: "rear_right", label: t("areaRearRight"), className: "left-[76.7%] top-[56.2%] w-[22.2%] h-[33.8%]" }
  ];
  const areas = bike ? bikeAreas : carAreas;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-white p-3">
      <div className="relative mx-auto aspect-[180/260] w-full max-w-[300px]">
        {bike ? (
          <svg aria-label={t("vehicleDiagram")} className="absolute inset-0 h-full w-full text-[var(--primary)]" role="img" viewBox="0 0 180 260">
            <rect fill="#1b2430" height="48" rx="9" width="18" x="81" y="8" />
            <rect fill="#1b2430" height="48" rx="10" width="22" x="79" y="204" />
            <rect fill="#d8eeea" height="150" rx="22" stroke="currentColor" strokeWidth="3" width="44" x="68" y="56" />
            <rect fill="currentColor" height="9" rx="4.5" width="92" x="44" y="54" />
          </svg>
        ) : (
          <svg aria-label={t("vehicleDiagram")} className="absolute inset-0 h-full w-full text-[var(--primary)]" role="img" viewBox="0 0 180 260">
            <circle cx="54" cy="72" fill="#1b2430" r="10" />
            <circle cx="126" cy="72" fill="#1b2430" r="10" />
            <circle cx="54" cy="190" fill="#1b2430" r="10" />
            <circle cx="126" cy="190" fill="#1b2430" r="10" />
            <rect fill="#d8eeea" height="232" rx="28" stroke="currentColor" strokeWidth="3" width="64" x="58" y="14" />
            <path d="M68 62 Q90 54 112 62 L110 92 Q90 88 70 92 Z" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
            <path d="M70 188 Q90 184 110 188 L112 208 Q90 214 68 208 Z" fill="#ffffff" stroke="currentColor" strokeWidth="2" />
          </svg>
        )}
        {areas.map((area) => (
          <button
            aria-label={t("logDamageAt", { area: area.label })}
            aria-pressed={selected === area.key}
            className={`pressable absolute flex items-center justify-center rounded-lg border-2 px-0.5 text-center text-sm font-semibold leading-tight transition ${
              selected === area.key
                ? "border-[var(--primary)] bg-[var(--primary)] text-white shadow-md"
                : marked?.includes(area.key)
                  ? "border-[var(--danger)] bg-[var(--danger-light)] text-[var(--danger)]"
                  : "border-dashed border-[var(--primary)]/40 bg-white/70 text-[var(--primary)] hover:bg-white"
            } ${area.className}`}
            key={area.key}
            onClick={() => onSelect(area.key)}
            type="button"
          >
            {area.label}
          </button>
        ))}
      </div>
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
          className="rounded-full border border-[var(--border)] bg-white px-3 py-2 text-sm font-bold text-[var(--foreground-secondary)]"
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

export function InspectionForm({ context, unsigned = false, blocker = null, blockerLinks = null, canWaive = true }: { context: InspectionContext; /** The booking in the way, so the owner can go straight to it. */ blockerLinks?: { otherRentalId: string; code: string } | null; /** Owners can give early days for free; teammates charge them or keep the length. */ canWaive?: boolean; /** The customer has not signed the agreement yet. */ unsigned?: boolean; /** Why the handover cannot go ahead right now (another customer still has the vehicle). */ blocker?: string | null }) {
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
  // Handing over before the booked start: the owner says what happens to the extra days (charged by default).
  const early = useMemo(() => (mode === "delivery" && !isSwap ? earlyStartFor(context.rental, context.vehicle, businessToday()) : null), [mode, isSwap, context.rental, context.vehicle]);
  const [earlyChoice, setEarlyChoice] = useState<EarlyStartChoice>(() => (early && early.amount > 0 ? "charge" : "free"));
  const [earlyAdded, setEarlyAdded] = useState(0);
  // Handed over after the booked start: rent starts today (the default) or keeps the booked dates.
  const late = useMemo(() => (mode === "delivery" && !isSwap ? lateStartFor(context.rental, businessToday()) : null), [mode, isSwap, context.rental]);
  const [lateChoice, setLateChoice] = useState<LateStartChoice>("from_handover");
  const [lateTakenOff, setLateTakenOff] = useState(0);
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
  // Charges the deposit cannot cover are billed to the customer unless the owner says not to.
  const [billUncovered, setBillUncovered] = useState(true);
  // Damage whose cost is not known until it has been looked at: the deposit stays held, nothing goes back yet.
  const [holdForDamageChoice, setHoldForDamage] = useState(false);
  // Keeping the deposit "until the damage is priced" only makes sense when new damage was logged on this
  // check. With none, the option is not offered, and a tick left over from removed damage no longer counts.
  const newDamageLogged = damageItems.some((item: any) => !item?.is_pre_existing);
  const holdForDamage = holdForDamageChoice && newDamageLogged;
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
  const [depositToCollect] = useState(() => mode === "delivery" && Boolean(deliveryDepositAmount));
  // Already paid before handover (a transfer, say): there is no cash to count, so the cash boxes stay folded away.
  // At a return the boxes stay folded until "Collect now" is tapped: most returns have nothing to collect.
  const [collectOpen, setCollectOpen] = useState(() => mode === "delivery" && (Boolean(deliveryPaymentAmount || deliveryDepositAmount) || !context.hasPaymentSchedule));
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
  const depositRefundAmount = holdForDamage ? 0 : Math.min(availableToReconcile, Math.max(0, refundOverride ? Number(refundOverride) : calculatedRefund));
  // Rent still owed comes out of the deposit first (as on the server); fuel, damage and cleaning take what is left.
  const uncoveredCharges = Math.max(0, fuelDeficitCharge + damageCharge + cleaningCharge - Math.max(0, availableToReconcile - outstandingBalance));
  // No deposit held and no new charge to bill: a screen of "0 held, 0 returned" is not a step. Rent still owed
  // on its own is said on the signature screen, where it can be collected.
  const nothingToSettle = mode === "return" && !isSwap && availableToReconcile <= 0 && fuelDeficitCharge + damageCharge + cleaningCharge <= 0;
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
    // Sent shrunk: a full 5 MB camera photo was slow on mobile data and could go over the 4.5 MB request limit.
    data.append("file", await compressImage(file, 1280, 0.8));
    // Never leave "Reading…" on screen for good: after 20 seconds give up and ask for the number to be typed.
    const giveUp = new AbortController();
    const timer = setTimeout(() => giveUp.abort(), 20000);
    try {
      const response = await fetch("/api/ocr/odometer", { method: "POST", body: data, signal: giveUp.signal });
      const result = await response.json();
      clearTimeout(timer);
      if (!response.ok) {
        setOcrMessage(t("ocrUnavailable"));
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

  // A reading far beyond what anyone could drive is almost always a typo or an extra digit.
  const lastKm = handoverKm ?? (context.vehicle?.mileage != null ? Number(context.vehicle.mileage) : null);
  const odometerJump = (() => {
    if (!odometer || lastKm == null || !(lastKm > 0)) return 0;
    const jump = Number(odometer) - lastKm;
    const days = mode === "return" ? Math.max(1, daysBetween(context.rental?.start_date)) : 1;
    return jump > Math.max(3000, days * 1500) ? jump : 0;
  })();

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
    formData.set("earlyStart", early ? earlyChoice : "");
    if (late) formData.set("lateStart", lateChoice);
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
            className={`${touchButton} flex-1 bg-[var(--primary)] text-white shadow-lg disabled:opacity-40 disabled:shadow-none`}
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
            className={`${touchButton} flex-1 bg-[var(--primary)] text-white shadow-lg disabled:opacity-40 disabled:shadow-none`}
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
    <form
      method="post"
      className="mx-auto max-w-3xl space-y-4"
      id="inspectionForm"
      // Each photo starts uploading as soon as it is taken, so "Finish" doesn't wait on a slow connection.
      onChange={(event) => {
        const input = event.target as unknown as HTMLInputElement;
        if (input?.type !== "file" || !input.files?.length) return;
        for (const file of Array.from(input.files)) startEarlyUpload(input.name, file, (files) => prepareInspectionUploads(context.organizationId, files));
      }}
      onSubmit={(event) => event.preventDefault()}
    >
      <input name="organizationId" type="hidden" value={context.organizationId} />
      <input name="mode" type="hidden" value={mode} />
      <input name="swap" type="hidden" value={isSwap ? "1" : ""} />
      <input name="earlyStart" type="hidden" value={early ? earlyChoice : ""} />
      {late ? <input name="lateStart" type="hidden" value={lateChoice} /> : null}
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
      <input name="billUncoveredCharges" type="hidden" value={billUncovered && uncoveredCharges > 0 ? "true" : ""} />
      <input name="holdDepositForDamage" type="hidden" value={holdForDamage ? "true" : ""} />

      <Progress step={step} steps={steps} />

      {step === 0 ? (
        <StepShell eyebrow={t("eyebrowVehicleConfirmation")} title={mode === "return" ? t("titleConfirmReturn") : mode === "condition_report" ? t("titleStartCondition") : t("titleConfirmHandover")}>
          <div className="rounded-xl border border-[var(--border)] bg-white p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:gap-4">
              <span className="shrink-0 self-start">
                <VehicleArt colour={(context.vehicle as any).color} kind={kindFromCategory(context.vehicle.vehicle_categories)} model={(context.vehicle as any).model} size="md" />
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
                {blocker ? (
                  <div className="mt-2 rounded-xl bg-[var(--danger-light)] px-3 py-2.5">
                    <p className="font-bold text-[var(--danger)]">{blocker}</p>
                    {blockerLinks ? (
                      <div className="mt-2.5 flex flex-wrap gap-2">
                        <a className="secondary-action pressable min-h-10 whitespace-nowrap px-4 text-[14px]" href={`/bookings/${blockerLinks.otherRentalId}`}>{t("blockerOpenOther", { code: blockerLinks.code })}</a>
                        {context.rental?.id ? <a className="secondary-action pressable min-h-10 whitespace-nowrap px-4 text-[14px]" href={`/bookings/${context.rental.id}`}>{t("blockerChangeVehicle")}</a> : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
                {mode === "delivery" && unsigned ? (
                  <p className="mt-2 rounded-lg bg-[var(--warning-light)] px-3 py-2 text-sm font-semibold text-[var(--warning)]">{t("notSignedNote")}</p>
                ) : null}
                {mode === "return" ? (
                  <p className="mt-2 rounded-lg bg-[var(--panel-secondary)] px-3 py-2 font-semibold text-[var(--foreground-secondary)]">
                    <span>
                      {handoverKm != null ? `${t("odometerAtDelivery", { km: handoverKm.toLocaleString("en-US") })} · ` : ""}
                      {t("rentalLengthDays", { count: daysBetween(context.rental?.start_date) })}
                    </span>
                  </p>
                ) : null}
              </div>
            </div>
          </div>
          {early && !blocker ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-bold text-[var(--foreground)]">{t("earlyTitle", { days: early.days, date: formatDate(early.bookedStart, locale) })}</legend>
              <div className="mt-2 space-y-2">
                {(
                  [
                    early.amount > 0 ? { value: "charge", label: t("earlyCharge", { days: early.days, amount: money(early.amount) }) } : null,
                    early.shortenedEnd ? { value: "shorten", label: t("earlyShorten", { date: formatDate(early.shortenedEnd, locale) }) } : null,
                    { value: "free", label: canWaive || early.amount <= 0 ? (early.bookedEnd ? t("earlyFreeBack", { date: formatDate(early.bookedEnd, locale) }) : t("earlyFree")) : t("earlyAskFree") }
                  ].filter(Boolean) as { value: EarlyStartChoice; label: string }[]
                ).map((option) => (
                  <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold ${earlyChoice === option.value ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground)]"}`} key={option.value}>
                    <input checked={earlyChoice === option.value} className="h-4 w-4 accent-[var(--primary)]" name="earlyStartChoice" onChange={() => setEarlyChoice(option.value)} type="radio" value={option.value} />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {late && !blocker ? (
            <fieldset className="mt-4">
              <legend className="text-sm font-bold text-[var(--foreground)]">{t("lateTitle", { days: late.days, date: formatDate(late.bookedStart, locale) })}</legend>
              <div className="mt-2 space-y-2">
                {(
                  [
                    {
                      value: "from_handover",
                      label: late.openEnded
                        ? t("lateFromTodayMoves", { days: late.days })
                        : late.credit > 0
                          ? t("lateFromToday", { date: formatDate(late.bookedEnd, locale), amount: money(late.credit) })
                          : t("lateFromTodayPlain", { date: formatDate(late.bookedEnd, locale) })
                    },
                    { value: "as_booked", label: t("lateAsBooked", { date: formatDate(late.bookedStart, locale) }) }
                  ] as { value: LateStartChoice; label: string }[]
                ).map((option) => (
                  <label className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm font-semibold ${lateChoice === option.value ? "border-[var(--primary)] bg-[var(--primary-light)] text-[var(--primary)]" : "border-[var(--border)] bg-white text-[var(--foreground)]"}`} key={option.value}>
                    <input checked={lateChoice === option.value} className="h-4 w-4 accent-[var(--primary)]" name="lateStartChoice" onChange={() => setLateChoice(option.value)} type="radio" value={option.value} />
                    {option.label}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          {blocker ? null : (
            <button
              className={`${touchButton} mt-5 w-full bg-[var(--primary)] text-white shadow-lg`}
              onClick={() => {
                // Charged extra days are collected with the rent at handover (and come off again if the answer changes).
                const add = early && earlyChoice === "charge" ? early.amount : 0;
                if (add !== earlyAdded) {
                  setDeliveryPaymentAmount((current) => {
                    const next = Math.max(0, Number(current || 0) - earlyAdded + add);
                    return next ? String(next) : "";
                  });
                  if (add > 0) setCollectOpen(true);
                  setEarlyAdded(add);
                }
                // Rent from today on a booking with a return date: the missed days aren't collected (and come back if the answer changes).
                const off = late && lateChoice === "from_handover" && !late.openEnded ? late.credit : 0;
                if (off !== lateTakenOff) {
                  setDeliveryPaymentAmount((current) => {
                    const next = Math.max(0, Number(current || 0) + lateTakenOff - off);
                    return next ? String(next) : "";
                  });
                  setLateTakenOff(off);
                }
                setStep(1);
              }}
              type="button"
            >
              {mode === "return" ? t("startReturn") : mode === "condition_report" ? t("startCondition") : t("startDelivery")}
            </button>
          )}
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
          {odometerJump > 0 ? (
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] px-3 py-2 text-sm font-bold text-[var(--warning)]" role="alert">
              <AlertTriangle className="mt-0.5 shrink-0" size={16} />
              {t("odometerHuge", { km: odometerJump.toLocaleString("en-US") })}
            </p>
          ) : null}
        </StepShell>
      </div>

      <div hidden={step !== 2}>
        <StepShell eyebrow={t("eyebrowFuelLevel")} title={t("fuelPhoto")}>
          <FileCapture accept="image/*" label={t("fuelCamera")} name="photo_fuel" onSelected={() => setFuelPhotoCaptured(true)} />
          {mode === "return" && context.deliveryInspection?.fuel_level != null ? (
            <p className="mt-3 font-semibold text-[var(--foreground-secondary)]">
              {t("fuelAtDelivery", { level: `${Math.max(0, Math.min(100, deliveryFuel))}%` })}
            </p>
          ) : null}
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
          <p className="mb-2 mt-4 flex items-center gap-3 text-sm font-semibold text-[var(--muted)]">
            <span className="h-px flex-1 bg-[var(--border)]" />
            {t("orFourPhotos")}
            <span className="h-px flex-1 bg-[var(--border)]" />
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["front", t("areaFront")],
              ["rear", t("areaRear")],
              ["driver", isBike ? t("sideLeft") : t("sideDriver")],
              ["passenger", isBike ? t("sideRight") : t("sidePassenger")],
              ...(isBike ? [] : [["interior", t("interiorOptional")], ["boot", t("bootOptional")]])
            ].map(([key, label]) => (
              <FileCapture
                accept="image/*"
                compact
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
            {!selectedLocation ? (
              <p className="mt-3 text-center text-sm font-semibold text-[var(--muted)]">{t("tapArea")}</p>
            ) : (
            <div className="mt-4 rounded-lg border border-[var(--primary)] bg-white p-4">
              <p className="font-semibold text-[var(--foreground)]">{t("damageAt", { area: areaName(selectedLocation) })}</p>
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
            )}
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
                  <button aria-label={t("removeDamage")} className="rounded-lg border border-[var(--danger-line)] p-2 text-[var(--danger)]" onClick={() => setDamageItems((items) => items.filter((entry) => entry.id !== item.id))} type="button">
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
                    {t("gpsLastSeen", { provider: String(context.gpsDevice.provider || ""), when: context.gpsDevice.last_seen_at ? formatDate(context.gpsDevice.last_seen_at) : t("gpsNever") })}
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
            {uncoveredCharges > 0 ? (
              <label className="flex items-start gap-3 rounded-lg border border-[var(--warning-line)] bg-[var(--warning-light)] px-3 py-3 text-sm font-semibold text-[var(--foreground)]">
                <input checked={billUncovered} className="mt-0.5 h-5 w-5 flex-shrink-0" onChange={(event) => setBillUncovered(event.target.checked)} type="checkbox" />
                <span>
                  {t("billRemainder", { amount: money(uncoveredCharges) })}
                  <span className="mt-1 block text-xs font-medium text-[var(--muted)]">{billUncovered ? t("billRemainderYes") : t("billRemainderNo")}</span>
                </span>
              </label>
            ) : requestedDeductions > availableToReconcile ? (
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
            {availableToReconcile > 0 && newDamageLogged ? (
              <label className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--panel-secondary)] px-3 py-3 text-sm font-semibold text-[var(--foreground)]">
                <input checked={holdForDamage} className="mt-0.5 h-5 w-5 flex-shrink-0" onChange={(event) => setHoldForDamage(event.target.checked)} type="checkbox" />
                <span>
                  {t("holdForDamage")}
                  <span className="mt-1 block text-xs font-medium text-[var(--muted)]">{t("holdForDamageHint")}</span>
                </span>
              </label>
            ) : null}
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
          ) : mode === "return" && (depositAlreadyReturned || availableToReconcile > 0 || (billUncovered && uncoveredCharges > 0)) ? (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-3">
              {depositAlreadyReturned ? (
                <div className="rounded-lg bg-[var(--success-light)] p-3">
                  <Row label={t("depositAlreadyReturned")} value="✓" />
                </div>
              ) : (
                <>
                  {availableToReconcile > 0 && holdForDamage ? (
                    <Row label={t("depositKeptForNow")} value={money(availableToReconcile)} />
                  ) : availableToReconcile > 0 ? (
                    <>
                      <Row label={t("depositDeductions")} value={appliedDeductions > 0 ? `-${money(appliedDeductions)}` : money(0)} danger={appliedDeductions > 0} />
                      <Row label={t("depositRefundConfirmed")} value={money(depositRefundAmount)} />
                    </>
                  ) : null}
                  {billUncovered && uncoveredCharges > 0 ? <Row label={t("billedToCustomer")} value={money(uncoveredCharges)} /> : null}
                </>
              )}
            </div>
          ) : null}
          {mode === "return" && !isSwap && outstandingBalance > 0 && !receiptResult ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--danger-line)] bg-[var(--danger-light)] p-4">
              <div className="min-w-0">
                <p className="text-sm font-bold text-[var(--danger)]">{t("stillOwed", { amount: money(outstandingBalance) })}</p>
                <p className="mt-1 text-xs font-semibold text-[var(--danger)]">{t("stillOwedHint")}</p>
              </div>
              {/* The same cash boxes as the handover, so what is owed can be taken here and receipted. */}
              {!collectOpen && context.rental?.id ? (
                <button className="pressable inline-flex min-h-10 items-center whitespace-nowrap rounded-full bg-[var(--danger)] px-4 text-sm font-bold text-white" onClick={() => setCollectOpen(true)} type="button">
                  {t("collectNow")}
                </button>
              ) : null}
            </div>
          ) : null}
          {mode === "return" && !isSwap && context.rental?.end_date && businessToday() < String(context.rental.end_date).slice(0, 10) ? (
            <p className="mt-3 text-sm font-semibold text-[var(--foreground-secondary)]">
              {t("backEarly", { count: Math.round((Date.parse(`${String(context.rental.end_date).slice(0, 10)}T00:00:00Z`) - Date.parse(`${businessToday()}T00:00:00Z`)) / 86_400_000) })}
            </p>
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
          {(mode === "delivery" || mode === "return") && context.rental?.id && !isSwap && collectOpen ? (
            <div className="mt-4 rounded-lg border border-[var(--border)] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--foreground)]">{t("cashPayment")}</p>
                  <p className="mt-1 text-xs font-semibold text-[var(--muted)]">{t(mode === "return" ? "cashPaymentReturnHint" : "cashPaymentHint")}</p>
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
                  <span className="relative block">
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-3 flex h-11 items-center font-semibold text-[var(--foreground-secondary)]">฿</span>
                    <input
                    className={`${inputClass} !pl-9`}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => {
                      setDeliveryPaymentAmount(event.target.value);
                      setReceiptError("");
                    }}
                    placeholder="0"
                    step="0.01"
                    type="number"
                    value={deliveryPaymentAmount}
                  />
                  </span>
                </label>
                <label className={depositToCollect ? "block" : "hidden"}>
                  <span className="text-sm font-bold text-[var(--foreground)]">{t("depositAmountReceived")}</span>
                  <span className="relative block">
                    <span aria-hidden="true" className="pointer-events-none absolute bottom-0 left-3 flex h-11 items-center font-semibold text-[var(--foreground-secondary)]">฿</span>
                    <input
                    className={`${inputClass} !pl-9`}
                    inputMode="decimal"
                    min="0"
                    onChange={(event) => {
                      setDeliveryDepositAmount(event.target.value);
                      setReceiptError("");
                    }}
                    placeholder="0"
                    step="0.01"
                    type="number"
                    value={deliveryDepositAmount}
                  />
                  </span>
                </label>
                {/* Once the receipt exists the button has done its job: it used to sit on "Generating..." while the page refreshed. */}
                {receiptResult ? null : (
                  <button
                    className={`${touchButton} self-end whitespace-nowrap border-2 border-[var(--primary)] bg-white text-[var(--primary)] disabled:opacity-40`}
                    disabled={isReceiptPending}
                    onClick={generateDeliveryReceipt}
                    type="button"
                  >
                    {isReceiptPending ? t("generating") : t("confirmCashReceipt")}
                  </button>
                )}
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
