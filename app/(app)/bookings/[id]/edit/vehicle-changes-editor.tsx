"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { updateVehicleChange as updateVehicleChangeAction } from "@/app/actions/vehicle-changes";
import { unwrap } from "@/lib/action-result";
import { shownError } from "@/lib/error-text";

export type VehicleChangeEntry = { id: string; date: string; fromVehicleId: string | null; fromLabel: string; toLabel: string };
type FleetOption = { id: string; label: string };
type Say = (key: string, values?: Record<string, string | number>) => string;

const field = "min-h-11 w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-base text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/15";

/** The booking's changes of vehicle, each with its date (and, for the first, the starting vehicle) open to correction. */
export function VehicleChangesEditor({ rentalId, changes, fleet, minDate, maxDate }: { rentalId: string; changes: VehicleChangeEntry[]; fleet: FleetOption[]; minDate: string; maxDate: string }) {
  if (changes.length === 0) return null;
  return (
    <div className="mt-4 space-y-3 border-t border-[var(--border)] pt-4">
      {changes.map((change, index) => (
        <ChangeRow change={change} first={index === 0} fleet={fleet} key={change.id} maxDate={maxDate} minDate={minDate} rentalId={rentalId} />
      ))}
    </div>
  );
}

function ChangeRow({ rentalId, change, first, fleet, minDate, maxDate }: { rentalId: string; change: VehicleChangeEntry; first: boolean; fleet: FleetOption[]; minDate: string; maxDate: string }) {
  const say = useTranslations("bookingEdit") as unknown as Say;
  const router = useRouter();
  const [date, setDate] = useState(change.date);
  const [fromId, setFromId] = useState(change.fromVehicleId || "");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const dirty = date !== change.date || fromId !== (change.fromVehicleId || "");

  const save = () => {
    setError("");
    startTransition(async () => {
      try {
        await unwrap(updateVehicleChangeAction({ rentalId, changeId: change.id, date, fromVehicleId: first ? fromId || null : null }));
        setSaved(true);
        router.refresh();
      } catch (caught) {
        setError(shownError(caught, say("vc_failed")));
      }
    });
  };

  return (
    <div>
      <p className="flex flex-wrap items-center gap-1.5 font-semibold text-[var(--foreground)]">
        <span>{change.fromLabel}</span>
        <ArrowRight aria-hidden className="h-4 w-4 text-[var(--muted)]" />
        <span>{change.toLabel}</span>
      </p>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        {first ? (
          <label className="block">
            <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{say("vc_startedOn")}</span>
            <select className={`${field} mt-1`} onChange={(event) => { setFromId(event.target.value); setSaved(false); }} value={fromId}>
              {fleet.map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="block">
          <span className="text-sm font-semibold text-[var(--foreground-secondary)]">{say("vc_changedOn")}</span>
          <input className={`${field} mt-1`} max={maxDate} min={minDate} onChange={(event) => { setDate(event.target.value); setSaved(false); }} type="date" value={date} />
        </label>
      </div>
      {error ? <p className="mt-2 text-sm font-bold text-[var(--danger)]" role="alert">{error}</p> : null}
      {dirty ? (
        <button className="primary-action pressable mt-3" disabled={pending || !date} onClick={save} type="button">
          {pending ? say("vc_saving") : say("vc_save")}
        </button>
      ) : saved ? (
        <p className="mt-2 text-sm font-semibold text-[var(--success)]">{say("vc_saved")}</p>
      ) : null}
    </div>
  );
}
