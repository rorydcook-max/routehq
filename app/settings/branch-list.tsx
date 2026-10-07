"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { createBranch, deleteBranch, updateBranch } from "@/app/actions/settings";
import { PendingButton } from "@/components/pending-button";
import { Badge } from "@/components/ui";
import type { Branch } from "@/lib/branches";

type Say = (key: string, values?: Record<string, string | number>) => string;
const labelClass = "font-semibold text-[var(--foreground-secondary)]";

function BranchFields({ branch, say }: { branch?: Branch; say: Say }) {
  return (
    <>
      <label className="block">
        <span className={labelClass}>{say("br_name")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.name || ""} name="name" placeholder={say("br_namePh")} required />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_address")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.address || ""} name="address" required={!branch} />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_phone")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.phone || ""} name="phone" type="tel" />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_email")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.email || ""} name="email" type="email" />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_lat")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.latitude ?? ""} name="latitude" step="any" type="number" />
      </label>
      <label className="block">
        <span className={labelClass}>{say("br_lng")}</span>
        <input className="mt-1 w-full" defaultValue={branch?.longitude ?? ""} name="longitude" step="any" type="number" />
      </label>
    </>
  );
}

export function BranchList({ branches, organizationId }: { branches: Branch[]; organizationId: string }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [isAddingBranch, setIsAddingBranch] = useState(false);

  return (
    <div className="card-section space-y-2.5">
      {branches.map((branch) => {
        const isEditing = editingBranchId === branch.id;
        return (
          <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5" key={branch.id}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{branch.name}</p>
                <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">
                  {[branch.address || say("br_noAddress"), [branch.phone, branch.email].filter(Boolean).join(" / ") || say("br_noContact")].join(" · ")}
                </p>
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
                <form action={deleteBranch}>
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
                </form>
              </div>
            </div>

            {isEditing ? (
              <form action={updateBranch} className="mt-3 grid gap-3 sm:grid-cols-2">
                <input name="organizationId" type="hidden" value={organizationId} />
                <input name="branchId" type="hidden" value={branch.id} />
                <BranchFields branch={branch} say={say} />
                <label className="checkbox-label sm:col-span-2">
                  <input className="flex-shrink-0" defaultChecked={branch.is_active} name="isActive" type="checkbox" />
                  <span className="font-semibold text-[var(--foreground)]">{say("br_active")}</span>
                </label>
                <div className="flex gap-2 sm:col-span-2">
                  <button className="secondary-action" onClick={() => setEditingBranchId(null)} type="button">
                    {say("cancel")}
                  </button>
                  <PendingButton className="primary-action flex-1" pendingLabel={say("saving")} savedLabel={say("saved")} type="submit">
                    {say("save")}
                  </PendingButton>
                </div>
              </form>
            ) : null}
          </div>
        );
      })}

      {isAddingBranch ? (
        <form action={createBranch} className="grid gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5 sm:grid-cols-2">
          <input name="organizationId" type="hidden" value={organizationId} />
          <BranchFields say={say} />
          <div className="flex gap-2 sm:col-span-2">
            <button className="secondary-action" onClick={() => setIsAddingBranch(false)} type="button">
              {say("cancel")}
            </button>
            <PendingButton className="primary-action flex-1" pendingLabel={say("br_adding")} type="submit">
              {say("br_add")}
            </PendingButton>
          </div>
        </form>
      ) : (
        <button className="secondary-action" onClick={() => setIsAddingBranch(true)} type="button">
          <Plus size={17} />
          {say("br_add")}
        </button>
      )}
    </div>
  );
}
