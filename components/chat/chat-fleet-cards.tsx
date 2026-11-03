"use client";

import { useEffect, useRef, useState } from "react";
import { addAssistantRentals, addAssistantVehicles, type DraftPaperwork } from "@/app/actions/fleet-assistant";
import { chatFleetDone, chatFleetUpdate } from "@/app/actions/chat";
import { renewVehicleCompliance, uploadVehiclePhotos } from "@/app/actions/vehicles";
import { PaperworkDrafts, RentalDrafts, VehicleDrafts } from "@/components/fleet-drafts";
import type { ChatMessage, ChatThreadInfo } from "@/lib/chat";
import { dismissNote, vehicleKey, type ChatFleet } from "@/lib/fleet-chat";

const cardRow = "rounded-xl bg-[var(--panel-secondary)] px-3 py-2";

/**
 * The fleet assistant's lists under its latest reply in the live chat: vehicles to check, correct and add; rentals
 * running now; renewals read from policy and tax photos to save or dismiss. Adding and saving use the same actions as
 * the full-page assistant (they check the person may), then chatFleetDone keeps the lists and says it's done.
 */
export function ChatFleetCards({
  message,
  threadId,
  organizationId,
  photoUrl,
  photoFile,
  onFleet,
  onMerge
}: {
  message: ChatMessage;
  threadId: string;
  organizationId?: string;
  /** A photo the fleet assistant has seen, by its storage path. */
  photoUrl: (path: string) => string | null;
  photoFile: (path: string) => Promise<File | null>;
  /** Shows the lists as changed, straight away. */
  onFleet: (fleet: ChatFleet) => void;
  /** The "done" reply from the server, to add to the chat. */
  onMerge: (result: { thread: ChatThreadInfo; messages: ChatMessage[] }) => void;
}) {
  const fleet = message.meta.fleet!;
  const [busy, setBusy] = useState<null | "vehicles" | "paperwork" | "rentals">(null);
  const latest = useRef(fleet);
  latest.current = fleet;
  const timer = useRef(0);
  const urlOf = (number: number) => {
    const path = fleet.photos[number - 1];
    return path ? photoUrl(path) : null;
  };
  const fileOf = async (number?: number | null) => {
    const path = number ? fleet.photos[number - 1] : "";
    return path ? photoFile(path) : null;
  };

  /** A change kept on screen at once and saved with the chat a moment later (several quick edits, one save). */
  function change(changes: Partial<ChatFleet>) {
    const next = { ...latest.current, ...changes };
    latest.current = next;
    onFleet(next);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      void chatFleetUpdate({ threadId, messageId: message.id, fleet: latest.current }).catch(() => undefined);
    }, 700);
  }
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function done(changes: Partial<ChatFleet>, report: Parameters<typeof chatFleetDone>[0]["done"]) {
    window.clearTimeout(timer.current);
    const next = { ...latest.current, ...changes };
    latest.current = next;
    onFleet(next);
    const result = await chatFleetDone({ threadId, messageId: message.id, fleet: next, done: report }).catch(() => null);
    if (result?.ok) onMerge(result);
  }

  async function addVehicles() {
    const ready = fleet.draft.filter((vehicle) => vehicle.make && vehicle.model);
    if (!ready.length || busy) return;
    setBusy("vehicles");
    const result = await addAssistantVehicles(ready).catch(() => ({ ok: false as const, error: "add_failed", ids: [] as string[] }));
    // Each vehicle's photos, one request each (already shrunk to about 1600 px before they were sent in the chat).
    for (let index = 0; index < result.ids.length; index++) {
      for (const number of ready[index]?.photos || []) {
        const file = await fileOf(number);
        if (!file || !organizationId) continue;
        const form = new FormData();
        form.set("vehicleId", result.ids[index]);
        form.set("organizationId", organizationId);
        form.append("vehiclePhotos", file, file.name || "photo.jpg");
        await uploadVehiclePhotos(form).catch(() => null);
      }
    }
    const added = ready.slice(0, result.ids.length);
    const names = added.map((vehicle) => [vehicle.year, vehicle.make, vehicle.model, vehicle.plate].filter(Boolean).join(" ")).join(", ");
    await done(
      {
        draft: latest.current.draft.filter((vehicle) => !added.includes(vehicle)),
        added: [...(latest.current.added || []), ...added.map(vehicleKey)],
        notes: added.length ? [...(latest.current.notes || []), `Added to the fleet: ${names}. These are done, do not list them again.`] : latest.current.notes
      },
      { kind: "vehicles", count: added.length, failed: result.ok ? [] : ["vehicles"] }
    );
    setBusy(null);
  }

  /** Each renewal saved the same way as from the car page: new date, the cost, and the photo kept with the car's files. */
  async function savePaperwork() {
    if (!fleet.paperwork.length || busy || !organizationId) return;
    setBusy("paperwork");
    const failed: string[] = [];
    const saved: DraftPaperwork[] = [];
    for (const item of fleet.paperwork) {
      const form = new FormData();
      form.set("vehicleId", item.vehicleId);
      form.set("organizationId", organizationId);
      form.set("complianceType", item.kind);
      form.set("newExpiryDate", item.coverTo);
      if (item.coverFrom) form.set("coverStart", item.coverFrom);
      if (item.cost) form.set("cost", String(item.cost));
      form.set("paymentMode", item.monthly ? "monthly" : "once");
      if (item.note) form.set("notes", item.note);
      if (item.inspectionCost) form.set("inspectionCost", String(item.inspectionCost));
      const photo = await fileOf(item.photo);
      if (photo) form.append("documentFile", photo, photo.name || "document.jpg");
      try {
        await renewVehicleCompliance(form);
        saved.push(item);
      } catch {
        failed.push(item.vehicleName || item.kind);
      }
    }
    await done(
      {
        paperwork: latest.current.paperwork.filter((item) => !saved.includes(item)),
        notes: saved.length ? [...(latest.current.notes || []), `Saved ${saved.length} paperwork renewal(s); they are done, do not list them again.`] : latest.current.notes
      },
      { kind: "paperwork", count: saved.length, failed }
    );
    setBusy(null);
  }

  async function addRentals() {
    if (!fleet.rentals.length || busy) return;
    setBusy("rentals");
    const result = await addAssistantRentals(fleet.rentals).catch(() => ({ ok: false, added: 0, failed: ["rentals"] }));
    const reminders = fleet.rentals.some((rental) => rental.remind !== false);
    await done(
      {
        rentals: result.added ? [] : latest.current.rentals,
        notes: result.added ? [...(latest.current.notes || []), `Added ${result.added} rental(s) running now; they are done, do not list them again.`] : latest.current.notes
      },
      { kind: "rentals", count: result.added, failed: result.failed, reminders }
    );
    setBusy(null);
  }

  if (!fleet.draft.length && !fleet.rentals.length && !fleet.paperwork.length) return null;
  return (
    <div className="mt-2.5 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-2.5 text-[15px] text-[var(--foreground)]">
      {fleet.draft.length ? (
        <VehicleDrafts
          adding={busy === "vehicles"}
          currency={fleet.currency}
          draft={fleet.draft}
          onAdd={() => void addVehicles()}
          onEdit={(index, vehicle) => change({ draft: latest.current.draft.map((entry, i) => (i === index ? vehicle : entry)) })}
          onRemove={(index) => change({ draft: latest.current.draft.filter((_, i) => i !== index) })}
          photoUrl={urlOf}
          rowClassName={cardRow}
        />
      ) : null}
      {fleet.rentals.length ? (
        <RentalDrafts
          adding={busy === "rentals"}
          currency={fleet.currency}
          onAdd={() => void addRentals()}
          onRemind={(index, remind) => change({ rentals: latest.current.rentals.map((entry, i) => (i === index ? { ...entry, remind } : entry)) })}
          onRemove={(index) => change({ rentals: latest.current.rentals.filter((_, i) => i !== index) })}
          rentals={fleet.rentals}
          rowClassName={cardRow}
        />
      ) : null}
      {fleet.paperwork.length ? (
        <PaperworkDrafts
          currency={fleet.currency}
          onDate={(index, coverTo) => change({ paperwork: latest.current.paperwork.map((entry, i) => (i === index ? { ...entry, coverTo } : entry)) })}
          onDismiss={(index) => {
            const item = latest.current.paperwork[index];
            change({ paperwork: latest.current.paperwork.filter((_, i) => i !== index), notes: item ? [...(latest.current.notes || []), dismissNote(item)] : latest.current.notes });
          }}
          onSave={() => void savePaperwork()}
          paperNames={fleet.paperNames}
          paperwork={fleet.paperwork}
          photoUrl={urlOf}
          saving={busy === "paperwork"}
          rowClassName={cardRow}
        />
      ) : null}
    </div>
  );
}
