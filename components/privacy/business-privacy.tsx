"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Download, Trash2 } from "lucide-react";
import { deleteBusiness, updateIdPhotoRetention, type PrivacyActionState } from "@/app/actions/privacy";

type Say = (key: string, values?: Record<string, string | number>) => string;
const start: PrivacyActionState = { ok: false };

/**
 * The owner's privacy tools on My account (GDPR / UK GDPR / PDPA, 3 Nov 2026): download everything, how long to keep
 * renters' ID photos, and delete the business (typed name, can't be undone).
 */
export function BusinessPrivacy({ businessName, months, autoDelete }: { businessName: string; months: number; autoDelete: boolean }) {
  const say = useTranslations("privacy") as unknown as Say;
  const [retention, saveRetention, savingRetention] = useActionState(updateIdPhotoRetention, start);
  const [deletion, runDelete, deleting] = useActionState(deleteBusiness, start);
  const [confirming, setConfirming] = useState(false);
  const [typed, setTyped] = useState("");
  const matches = typed.trim().toLowerCase() === businessName.trim().toLowerCase() && typed.trim() !== "";

  return (
    <div className="mt-4 space-y-3">
      <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5">
        <p className="text-[16px] font-bold text-[var(--foreground)]">{say("exportTitle")}</p>
        <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("exportBody")}</p>
        <a className="secondary-action pressable mt-3 whitespace-nowrap" download href="/account/export">
          <Download size={17} />
          {say("exportButton")}
        </a>
      </div>

      <form action={saveRetention} className="rounded-2xl bg-[var(--panel-secondary)] p-3.5">
        <p className="text-[16px] font-bold text-[var(--foreground)]">{say("retentionTitle")}</p>
        <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("retentionBody")}</p>
        <label className="mt-3 flex items-center gap-2 font-semibold text-[var(--foreground)]">
          <input defaultChecked={autoDelete} name="enabled" type="checkbox" />
          {say("retentionOn")}
        </label>
        <label className="mt-2 block">
          <span className="block font-semibold text-[var(--foreground-secondary)]">{say("retentionMonths")}</span>
          <input className="mt-1 w-28" defaultValue={months} max={120} min={1} name="months" required type="number" />
        </label>
        {retention.error ? <p className="mt-2 font-bold text-[var(--danger)]">{retention.error}</p> : null}
        <button className="primary-action pressable mt-3" disabled={savingRetention} type="submit">
          {retention.saved && !savingRetention ? say("retentionSaved") : say("retentionSave")}
        </button>
      </form>

      <div className="rounded-2xl border border-[var(--danger-line)] p-3.5">
        <p className="text-[16px] font-bold text-[var(--danger)]">{say("deleteTitle")}</p>
        <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{say("deleteBody")}</p>
        <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{say("deleteHint")}</p>
        {confirming ? (
          <form action={runDelete} className="mt-3 space-y-2">
            <label className="block">
              <span className="font-semibold text-[var(--foreground-secondary)]">{say("deleteType", { name: businessName })}</span>
              <input autoComplete="off" className="mt-1 w-full" name="confirmName" onChange={(event) => setTyped(event.target.value)} value={typed} />
            </label>
            {deletion.error ? <p className="font-bold text-[var(--danger)]">{deletion.error}</p> : null}
            <div className="flex flex-wrap gap-2">
              <button className="pressable min-h-11 rounded-full bg-[var(--danger)] px-4 font-bold text-white disabled:opacity-50" disabled={!matches || deleting} type="submit">
                {say("deleteConfirm")}
              </button>
              <button
                className="secondary-action pressable"
                onClick={() => {
                  setConfirming(false);
                  setTyped("");
                }}
                type="button"
              >
                {say("deleteCancel")}
              </button>
            </div>
          </form>
        ) : (
          <button className="pressable mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-bold text-[var(--danger)] hover:bg-[var(--danger-light)]" onClick={() => setConfirming(true)} type="button">
            <Trash2 size={17} />
            {say("deleteButton")}
          </button>
        )}
      </div>
    </div>
  );
}
