"use client";

import { useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { updateBusinessLogo } from "@/app/actions/settings";
import { BusinessLogoImage } from "@/components/business-logo-image";

export function LogoUploadSection({ logoUrl, orgName }: { logoUrl: string | null | undefined; orgName: string }) {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ key: string; type: "error" | "success" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateBusinessLogo(formData);
        setMessage({ key: "lg_done", type: "success" });
        if (fileRef.current) fileRef.current.value = "";
      } catch {
        setMessage({ key: "lg_failed", type: "error" });
      }
    });
  }

  // Choosing an image uploads it straight away: no second button to find.
  function uploadChosen() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ key: "lg_pick", type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("logo", file);
    submit(fd);
  }

  function handleRemove() {
    const fd = new FormData();
    fd.set("remove_logo", "true");
    submit(fd);
  }

  return (
    <div className="rounded-2xl bg-[var(--panel-secondary)] p-3.5">
      <div className="flex items-center gap-3">
        {/* The logo, or a dashed space the size a logo will take, like the signature next to it. */}
        {logoUrl ? (
          <span className="flex h-16 w-40 shrink-0 items-center justify-center rounded-xl bg-white p-2">
            <BusinessLogoImage alt={orgName} className="max-h-full w-auto max-w-full object-contain" src={logoUrl} />
          </span>
        ) : (
          <span aria-hidden="true" className="flex h-16 w-40 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-[var(--border-strong)] bg-white text-sm font-semibold text-[var(--muted)]">
            {say("lg_placeholder")}
          </span>
        )}
        <div className="min-w-0">
          <h3 className="card-subtitle">{logoUrl ? say("lg_title") : say("lg_uploadTitle")}</h3>
          <p className="mt-0.5 text-sm font-medium text-[var(--foreground-secondary)]">{logoUrl ? say("lg_body") : say("lg_uploadBody")}</p>
        </div>
      </div>
      <input accept="image/png,image/jpeg,image/webp" className="hidden" data-keep-original onChange={uploadChosen} ref={fileRef} type="file" />
      <div className="mt-3 flex flex-wrap gap-2">
        {/* Secondary: the brand card's one primary action is Save. */}
        <button className="secondary-action" disabled={isPending} onClick={() => fileRef.current?.click()} type="button">
          {isPending ? say("lg_working") : logoUrl ? say("lg_replace") : say("lg_upload")}
        </button>
        {logoUrl ? (
          <button className="pressable min-h-11 rounded-full px-3 font-bold text-[var(--danger)] hover:bg-[var(--danger-light)]" disabled={isPending} onClick={handleRemove} type="button">
            {say("lg_remove")}
          </button>
        ) : null}
      </div>
      {message ? <p className={`mt-2 font-bold ${message.type === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{say(message.key)}</p> : null}
    </div>
  );
}
