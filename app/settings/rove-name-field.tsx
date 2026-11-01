"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { checkRoveName, saveRoveName } from "@/app/actions/booking-address";
import { typingSubdomain } from "@/lib/booking-address";

/**
 * The business's own name on Rove, rove.rent/<name> (Rory, 1 Nov 2026). Typed freely; as you type it says whether
 * the name is free, and offers the nearest free one ("samuicar-01") when it isn't. Old links keep working.
 */
export function RoveNameField({ current, host }: { current: string; host: string }) {
  const say = useTranslations("settingsPage") as unknown as (key: string, values?: Record<string, string>) => string;
  const router = useRouter();
  const [value, setValue] = useState(current);
  const [status, setStatus] = useState<{ available: boolean; suggestion: string } | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  useEffect(() => {
    setSaved(false);
    setError("");
    if (value === current || value.length < 3) {
      setStatus(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await checkRoveName({ value }).catch(() => null);
      if (result && result.ok) setStatus({ available: result.available, suggestion: result.suggestion });
    }, 350);
    return () => clearTimeout(timer);
  }, [value, current]);

  function save(name: string) {
    setError("");
    start(async () => {
      const result = await saveRoveName({ value: name }).catch(() => ({ ok: false as const, error: say("saveFailed") }));
      if (!result.ok) return setError(result.error);
      setValue(result.value);
      setStatus(null);
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex items-stretch overflow-hidden rounded-xl border-[1.5px] border-[var(--border-strong)] bg-[var(--panel)] focus-within:border-[var(--primary)]">
        <span className="flex shrink-0 items-center bg-[var(--panel-secondary)] px-3 font-semibold text-[var(--foreground-secondary)]">{host}/</span>
        <input
          aria-label={say("rn_title")}
          autoCapitalize="none"
          autoCorrect="off"
          className="min-w-0 flex-1 !rounded-none !border-0 bg-transparent px-2 font-semibold !shadow-none"
          onChange={(event) => setValue(typingSubdomain(event.target.value))}
          value={value}
        />
      </div>
      {status ? (
        status.available ? (
          <p className="font-semibold text-[var(--success)]">{say("rn_free")}</p>
        ) : (
          <p className="font-semibold text-[var(--warning)]">
            {say("rn_taken", { suggestion: status.suggestion })}{" "}
            <button className="font-bold text-[var(--primary)] underline" onClick={() => setValue(status.suggestion)} type="button">
              {say("rn_use")}
            </button>
          </p>
        )
      ) : null}
      {saved ? (
        <p className="inline-flex items-center gap-1.5 font-semibold text-[var(--success)]">
          <Check size={16} />
          {say("rn_saved")}
        </p>
      ) : null}
      {error ? <p className="font-semibold text-[var(--danger)]">{error}</p> : null}
      {value !== current ? (
        <button className="primary-action" disabled={pending || (status !== null && !status.available)} onClick={() => save(value)} type="button">
          {pending ? say("lg_working") : say("rn_save")}
        </button>
      ) : null}
    </div>
  );
}
