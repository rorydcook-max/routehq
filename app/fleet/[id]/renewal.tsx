"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Camera, Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { renewVehicleCompliance } from "@/app/actions/vehicles";
import { PendingButton } from "@/components/pending-button";

type Say = (key: string, values?: Record<string, string | number>) => string;
const inputClass = "mt-1 w-full";
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/** Renewed it: a photo of the new certificate, policy or tax receipt fills the date and cost in; the photo is kept. */
export function RenewalForm({ vehicleId, organizationId, complianceType, readable }: { vehicleId: string; organizationId: string; complianceType: string; readable: boolean }) {
  const t = useTranslations("vehiclePage");
  const say = t as unknown as Say;
  const fileInput = useRef<HTMLInputElement>(null);
  const [expiry, setExpiry] = useState("");
  const [cost, setCost] = useState("");
  const [notes, setNotes] = useState("");
  const [reading, setReading] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);

  async function read(file: File) {
    if (!readable || !file.type.startsWith("image/") && file.type !== "application/pdf") return;
    setReading(true);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("file", file);
      body.set("type", complianceType);
      const response = await fetch("/api/ocr/renewal", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.expiryDate) {
        setMessage({ tone: "bad", text: data.error || say("rn_readNoDate") });
        return;
      }
      setExpiry(data.expiryDate);
      if (data.cost) setCost(String(data.cost));
      if (!notes) setNotes([data.provider, data.policyNumber].filter(Boolean).join(" · "));
      setMessage({ tone: "ok", text: say("rn_readDone") });
    } catch {
      setMessage({ tone: "bad", text: say("rn_readNoDate") });
    } finally {
      setReading(false);
    }
  }

  return (
    <form action={renewVehicleCompliance} className="mt-3 grid gap-3 sm:grid-cols-2">
      <input name="vehicleId" type="hidden" value={vehicleId} />
      <input name="organizationId" type="hidden" value={organizationId} />
      <input name="complianceType" type="hidden" value={complianceType} />
      <label className="block sm:col-span-2">
        <span className={labelClass}>{say("f_docPhoto")}</span>
        <input
          accept="image/*,application/pdf"
          className="mt-1 w-full"
          name="documentFile"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void read(file);
          }}
          ref={fileInput}
          type="file"
        />
        {readable ? (
          <span className="mt-1 flex items-start gap-1.5 text-[14px] font-medium text-[var(--muted)]">
            {reading ? <Loader2 aria-hidden="true" className="mt-0.5 shrink-0 animate-spin" size={16} /> : <Camera aria-hidden="true" className="mt-0.5 shrink-0" size={16} />}
            {reading ? say("rn_reading") : say("rn_photoHint")}
          </span>
        ) : null}
        {message ? <span className={`mt-1 block text-[14px] font-semibold ${message.tone === "ok" ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>{message.text}</span> : null}
      </label>
      <label className="block">
        <span className={labelClass}>{say("f_runsOutOn")}</span>
        <input className={inputClass} name="newExpiryDate" onChange={(event) => setExpiry(event.target.value)} required type="date" value={expiry} />
      </label>
      <label className="block">
        <span className={labelClass}>{say("f_cost")}</span>
        <input className={inputClass} inputMode="decimal" min="0" name="cost" onChange={(event) => setCost(event.target.value)} step="0.01" type="number" value={cost} />
      </label>
      <label className="block sm:col-span-2">
        <span className={labelClass}>{say("f_notes")}</span>
        <input className={inputClass} name="notes" onChange={(event) => setNotes(event.target.value)} value={notes} />
      </label>
      <PendingButton className="primary-action sm:col-span-2" pendingLabel={say("saving")} type="submit">
        {say("save")}
      </PendingButton>
    </form>
  );
}

/**
 * How to renew road tax, Por Ror Bor or insurance, for this vehicle. Plain guidance and the official DLT link only:
 * RouteHQ isn't a licensed insurance broker, so it doesn't link to insurers or take a cut (OIC rules, July 2026).
 */
export function RenewalHelp({
  kind,
  vehicleAge,
  twoWheeler,
  porborDaysLeft,
  details
}: {
  kind: "tax" | "porbor" | "insurance";
  /** Whole years since the vehicle was first registered; null when the year isn't saved. */
  vehicleAge: number | null;
  twoWheeler: boolean;
  porborDaysLeft: number | null;
  /** Plate, model, year, chassis number...: what an insurer or the DLT asks for. */
  details: string;
}) {
  const t = useTranslations("vehiclePage");
  const say = t as unknown as Say;
  const [copied, setCopied] = useState(false);
  const inspectionAge = twoWheeler ? 5 : 7;
  const needsInspection = vehicleAge !== null && vehicleAge > inspectionAge;
  const steps: string[] = [];
  if (kind === "tax") {
    if (porborDaysLeft !== null && porborDaysLeft <= 90) steps.push(say("rn_taxPorborFirst"));
    steps.push(needsInspection ? say("rn_taxInspection", { years: inspectionAge }) : vehicleAge === null ? say("rn_taxAgeUnknown", { car: 7, bike: 5 }) : say("rn_taxOnline"));
    steps.push(say("rn_taxGreenPlate"));
    steps.push(say("rn_taxBring"));
  } else if (kind === "porbor") {
    steps.push(say("rn_porborRental"));
    steps.push(say("rn_porborBeforeTax"));
    steps.push(say("rn_porborWhere"));
  } else {
    steps.push(say("rn_insRental"));
    steps.push(say("rn_insCompare"));
    steps.push(say("rn_insClaims"));
  }

  return (
    <details className="mt-2.5 rounded-lg border border-[var(--border)] bg-white px-3 py-2">
      <summary className="cursor-pointer font-bold text-[var(--primary)]">{say("rn_how")}</summary>
      <ul className="mt-2 space-y-1.5">
        {steps.map((step) => (
          <li className="flex gap-2 text-[15px] font-medium text-[var(--foreground-secondary)]" key={step}>
            <Check aria-hidden="true" className="mt-0.5 shrink-0 text-[var(--primary)]" size={16} />
            <span>{step}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          className="secondary-action pressable min-h-9 px-3 text-[14px]"
          onClick={() => {
            navigator.clipboard
              ?.writeText(details)
              .then(() => {
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              })
              .catch(() => null);
          }}
          type="button"
        >
          <Copy aria-hidden="true" size={15} />
          {copied ? say("rn_copied") : kind === "tax" ? say("rn_copyDetails") : say("rn_copyForInsurer")}
        </button>
        {kind === "tax" ? (
          <a className="secondary-action pressable min-h-9 px-3 text-[14px]" href="https://eservice.dlt.go.th" rel="noreferrer" target="_blank">
            <ExternalLink aria-hidden="true" size={15} />
            {say("rn_dltLink")}
          </a>
        ) : null}
      </div>
      <p className="mt-2 text-[13px] text-[var(--muted)]">{say("rn_disclaimer")}</p>
    </details>
  );
}
