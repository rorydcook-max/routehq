"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createBranch, deleteBranch, updateBranch } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui";
import type { Branch } from "@/lib/branches";
import { validPoint } from "@/lib/place-coords";
import { fromKm, placeLabel, type DistanceUnit } from "@/lib/regional";
import type { ServiceArea } from "@/lib/service-area";
import { BranchServiceArea } from "./branch-service-area";

type Say = (key: string, values?: Record<string, string | number>) => string;
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

function BranchFields({ branch, say, place }: { branch?: Branch; say: Say; place: { country: string; unit: DistanceUnit; fallback?: ServiceArea | null } }) {
  return (
    <>
      <label className="block">
        <span className={labelClass}>{say("br_name")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.name || ""} name="name" placeholder={say("br_namePh")} required />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_address")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.address || ""} name="address" />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_phone")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.phone || ""} name="phone" type="tel" />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_email")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.email || ""} name="email" type="email" />
      </label>
      {/* Map pin and delivery radius (replaces the old latitude/longitude boxes). */}
      <BranchServiceArea country={place.country} fallback={place.fallback} initial={branch} say={say} unit={place.unit} />
    </>
  );
}

type PlaceContext = { country: string; unit: DistanceUnit; fallback?: ServiceArea | null };

export function BranchList({
  branches,
  organizationId,
  country = "",
  unit = "km",
  fallbackAreas = []
}: {
  branches: Branch[];
  organizationId: string;
  country?: string;
  unit?: DistanceUnit;
  /** Where search places each location today (lib/service-area.ts), main location first. */
  fallbackAreas?: ServiceArea[];
}) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const areaFor = (branchId: string | null) => fallbackAreas.find((area) => area.branchId === branchId) || fallbackAreas[0] || null;
  const placeFor = (branchId: string | null): PlaceContext => ({ country, unit, fallback: areaFor(branchId) });
  const distance = (km: number) => `${Math.round(fromKm(km, unit) * 10) / 10} ${unit}`;
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  return (
    <div className="space-y-2.5">
      {branches.map((branch) => {
        const isEditing = editingBranchId === branch.id;
        const contact = [branch.phone, branch.email].filter(Boolean).join(" / ");
        return (
          <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5" key={branch.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="card-subtitle leading-tight">{branch.name}</p>
                <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{branch.address ? placeLabel(branch.address.split(",")) : say("br_noAddress")}</p>
                {/* Contact details on their own line, muted when there are none. */}
                <p className={`mt-0.5 text-sm font-medium ${contact ? "text-[var(--foreground-secondary)]" : "text-[var(--muted)]"}`}>{contact || say("br_noContact")}</p>
                {/* Service area at a glance, with a nudge while it isn't set (partners search by it). */}
                {(() => {
                  const radiusKm = branch.service_radius_km === null || branch.service_radius_km === undefined ? null : Number(branch.service_radius_km);
                  if (!validPoint(branch.latitude, branch.longitude) || radiusKm === null) {
                    return <p className="mt-0.5 text-sm font-semibold text-[var(--warning)]">{say("br_setArea")}</p>;
                  }
                  return (
                    <p className="mt-0.5 text-sm font-medium text-[var(--foreground-secondary)]">
                      {radiusKm > 0 ? say("br_deliversWithin", { distance: distance(radiusKm) }) : say("br_pickupOnly")}
                    </p>
                  );
                })()}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {branch.is_active ? null : <Badge tone="amber">{say("br_inactive")}</Badge>}
                <button
                  aria-expanded={isEditing}
                  aria-label={say("br_edit", { name: branch.name })}
                  className="pressable flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--primary)]"
                  onClick={() => setEditingBranchId(isEditing ? null : branch.id)}
                  type="button"
                >
                  <Pencil size={18} />
                </button>
                <ActionForm action={deleteBranch}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="branchId" type="hidden" value={branch.id} />
                  <PendingButton
                    aria-label={say("br_delete", { name: branch.name })}
                    className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-0 text-[var(--danger)]"
                    onClick={(event) => {
                      if (!window.confirm(say("br_deleteConfirm", { name: branch.name }))) {
                        event.preventDefault();
                      }
                    }}
                    pendingLabel=""
                    type="submit"
                  >
                    <Trash2 size={18} />
                  </PendingButton>
                </ActionForm>
              </div>
            </div>

            {isEditing ? (
              <ActionForm action={updateBranch} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="branchId" type="hidden" value={branch.id} />
                <BranchFields branch={branch} place={placeFor(branch.id)} say={say} />
                <label className="checkbox-label sm:col-span-2">
                  <input className="flex-shrink-0" defaultChecked={branch.is_active} name="isActive" type="checkbox" />
                  <span className="font-semibold text-[var(--foreground)]">{say("br_active")}</span>
                </label>
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <PendingButton className="primary-action" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
                    {say("save")}
                  </PendingButton>
                  <button className="secondary-action" onClick={() => setEditingBranchId(null)} type="button">
                    {say("cancel")}
                  </button>
                </div>
              </ActionForm>
            ) : null}
          </div>
        );
      })}

      {isAddingBranch ? (
        <ActionForm action={createBranch} className="grid gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5 sm:grid-cols-2">
          <input name="organizationId" type="hidden" value={organizationId} />
          <BranchFields place={placeFor(null)} say={say} />
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <PendingButton className="primary-action" pendingLabel={say("br_adding")} type="submit">
              {say("br_add")}
            </PendingButton>
            <button className="secondary-action" onClick={() => setIsAddingBranch(false)} type="button">
              {say("cancel")}
            </button>
          </div>
        </ActionForm>
      ) : (
        <button className="secondary-action" onClick={() => setIsAddingBranch(true)} type="button">
          <Plus size={17} />
          {say("br_add")}
        </button>
      )}
    </div>
  );
}
