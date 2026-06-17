"use client";

import { useState } from "react";
import { createBranch, deleteBranch, updateBranch } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui";
import type { Branch } from "@/lib/branches";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--border)] bg-white px-3 text-[13px] text-[var(--foreground)] outline-none focus:border-[var(--primary)] focus:ring-2 focus:ring-[rgba(18,184,200,0.16)]";

function EditIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="16">
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

export function BranchList({ branches, organizationId }: { branches: Branch[]; organizationId: string }) {
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  return (
    <div className="card-section space-y-3">
      <div className="flex justify-end">
        <button className="secondary-action" onClick={() => setIsAddingBranch((value) => !value)} type="button">
          {isAddingBranch ? "Cancel new branch" : "Add branch"}
        </button>
      </div>

      {isAddingBranch ? (
        <form action={createBranch} className="grid gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:grid-cols-2">
          <input name="organizationId" type="hidden" value={organizationId} />
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Branch name</span>
            <input className={inputClass} name="name" placeholder="Koh Samui" required />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Address</span>
            <input className={inputClass} name="address" placeholder="Base address" required />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Phone</span>
            <input className={inputClass} name="phone" type="tel" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Email</span>
            <input className={inputClass} name="email" type="email" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Latitude</span>
            <input className={inputClass} name="latitude" step="any" type="number" />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Longitude</span>
            <input className={inputClass} name="longitude" step="any" type="number" />
          </label>
          <div className="sm:col-span-2">
            <PendingButton className="primary-action w-full" pendingLabel="Adding..." type="submit">
              Add branch
            </PendingButton>
          </div>
        </form>
      ) : null}

      <div className="overflow-hidden border-t border-[var(--border)]">
      {branches.map((branch) => {
        const isEditing = editingBranchId === branch.id;

        return (
          <div className="border-b border-[var(--border)] last:border-b-0" key={branch.id}>
            <div className="flex flex-col gap-3 px-[14px] py-[9px] sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[13px] font-medium text-[var(--foreground)]">{branch.name}</p>
                <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                  {[
                    branch.address || "No address added",
                    [branch.phone, branch.email].filter(Boolean).join(" / ") || "No contact details"
                  ].join(" · ")}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={branch.is_active ? "green" : "neutral"}>{branch.is_active ? "Active" : "Inactive"}</Badge>
                <button
                  aria-expanded={isEditing}
                  aria-label={`Edit ${branch.name}`}
                  className="pressable flex h-9 w-9 items-center justify-center rounded-lg border border-[#dfe4ea] bg-white text-[#0e7490] shadow-sm transition hover:border-[#0e7490] hover:bg-[#ecfeff]"
                  onClick={() => setEditingBranchId(isEditing ? null : branch.id)}
                  title="Edit branch"
                  type="button"
                >
                  <EditIcon />
                </button>
                <form action={deleteBranch}>
                  <input name="organizationId" type="hidden" value={organizationId} />
                  <input name="branchId" type="hidden" value={branch.id} />
                  <PendingButton
                    aria-label={`Delete ${branch.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#fecaca] bg-white p-0 text-[#dc2626] shadow-sm transition hover:bg-[#fef2f2]"
                    onClick={(event) => {
                      if (!window.confirm(`Delete ${branch.name}? Vehicles assigned to this branch will keep their records but no longer have this home branch.`)) {
                        event.preventDefault();
                      }
                    }}
                    pendingLabel=""
                    title="Delete branch"
                    type="submit"
                  >
                    <DeleteIcon />
                  </PendingButton>
                </form>
              </div>
            </div>

            {isEditing ? (
              <form action={updateBranch} className="mx-[14px] mb-3 grid gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:grid-cols-2">
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="branchId" type="hidden" value={branch.id} />
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Branch name</span>
                  <input className={inputClass} defaultValue={branch.name} name="name" required />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Address</span>
                  <input className={inputClass} defaultValue={branch.address || ""} name="address" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Phone</span>
                  <input className={inputClass} defaultValue={branch.phone || ""} name="phone" type="tel" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Email</span>
                  <input className={inputClass} defaultValue={branch.email || ""} name="email" type="email" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Latitude</span>
                  <input className={inputClass} defaultValue={branch.latitude ?? ""} name="latitude" step="any" type="number" />
                </label>
                <label className="block">
                  <span className="text-[11px] font-medium text-[var(--foreground-secondary)]">Longitude</span>
                  <input className={inputClass} defaultValue={branch.longitude ?? ""} name="longitude" step="any" type="number" />
                </label>
                <label className="checkbox-label rounded-lg border border-[#dfe4ea] bg-white px-3 py-2 font-semibold text-[#344054]">
                  <input className="flex-shrink-0" defaultChecked={branch.is_active} name="isActive" type="checkbox" />
                  <span>Active branch</span>
                </label>
                <div className="flex gap-2">
                  <button className="secondary-action flex-1" onClick={() => setEditingBranchId(null)} type="button">
                    Cancel
                  </button>
                  <PendingButton className="primary-action flex-1" pendingLabel="Saving..." type="submit">
                    Save
                  </PendingButton>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}
      </div>
    </div>
  );
}
