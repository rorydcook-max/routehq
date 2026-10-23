"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { saveSupportPreference, setSupportThreadStatus } from "@/app/actions/support";
import { SUPPORT_CHANNELS, type SupportChannel } from "@/lib/support-shared";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** "Sorted" closes a conversation; writing again or "Open again" reopens it. */
export function HelpStatusButton({ threadId, closed }: { threadId: string; closed: boolean }) {
  const say = useTranslations("help") as unknown as Say;
  const [pending, start] = useTransition();
  return (
    <button
      className="secondary-action pressable"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setSupportThreadStatus({ threadId, status: closed ? "open" : "closed" });
        })
      }
      type="button"
    >
      {closed ? <RotateCcw size={17} /> : <CheckCircle2 size={17} />}
      {closed ? say("reopen") : say("markSorted")}
    </button>
  );
}

/** How the business would like RouteHQ to get back to them. The conversation in RouteHQ is kept either way. */
export function HelpPreference({ channel, handle, suggestions, canEdit }: { channel: SupportChannel; handle: string; suggestions: Partial<Record<SupportChannel, string>>; canEdit: boolean }) {
  const say = useTranslations("help") as unknown as Say;
  const [value, setValue] = useState<SupportChannel>(channel);
  const [contact, setContact] = useState(handle);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function pick(next: SupportChannel) {
    setValue(next);
    setSaved(false);
    // Fill in what we already know about the business (its WhatsApp, LINE ID or email).
    if (next !== channel || !contact) setContact(next === channel && handle ? handle : suggestions[next] || "");
  }

  function save() {
    setError(null);
    start(async () => {
      const result = await saveSupportPreference({ channel: value, handle: contact });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="radiogroup">
        {SUPPORT_CHANNELS.map((option) => (
          <button
            aria-checked={value === option}
            className={`rounded-full border px-3.5 py-1.5 text-[15px] font-semibold ${value === option ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)] bg-[var(--panel)] text-[var(--foreground)]"}`}
            disabled={!canEdit || pending}
            key={option}
            onClick={() => pick(option)}
            role="radio"
            type="button"
          >
            {say(`channel_${option}`)}
          </button>
        ))}
      </div>
      {value !== "app" ? (
        <label className="block sm:max-w-md">
          <span className="font-semibold text-[var(--foreground)]">{say(`handle_${value}`)}</span>
          <input
            className="mt-1 block w-full"
            disabled={!canEdit || pending}
            inputMode={value === "whatsapp" ? "tel" : value === "email" ? "email" : "text"}
            onChange={(event) => {
              setContact(event.target.value);
              setSaved(false);
            }}
            value={contact}
          />
        </label>
      ) : null}
      <p className="font-medium text-[var(--foreground-secondary)]">{value === "app" ? say("prefAppNote") : say("prefOtherNote", { channel: say(`channel_${value}`) })}</p>
      {canEdit ? (
        <div className="flex items-center gap-3">
          <button className="secondary-action pressable" disabled={pending || (value === channel && contact === handle)} onClick={save} type="button">
            {pending ? say("saving") : say("savePref")}
          </button>
          {saved ? <span className="font-semibold text-[var(--success)]">{say("saved")}</span> : null}
        </div>
      ) : (
        <p className="font-medium text-[var(--muted)]">{say("prefOwnerOnly")}</p>
      )}
      {error ? <p className="font-bold text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
