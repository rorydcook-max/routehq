"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { updateBusinessLogo } from "@/app/actions/settings";
import { BusinessLogoImage } from "@/components/business-logo-image";

export function LogoUploadSection({ logoUrl, orgName }: { logoUrl: string | null | undefined; orgName: string }) {
  const say = useTranslations("settingsPage") as unknown as (key: string) => string;
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ key: string; type: "error" | "success" } | null>(null);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateBusinessLogo(formData);
        setMessage({ key: "lg_done", type: "success" });
        if (fileRef.current) fileRef.current.value = "";
        router.refresh();
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
    <div className="rounded-xl bg-[var(--panel-secondary)] p-3.5">
      <div className="flex items-center gap-3">
        {logoUrl ? <BusinessLogoImage alt={orgName} className="h-12 w-20 shrink-0 rounded-lg bg-white object-contain p-1.5" src={logoUrl} /> : null}
        <div className="min-w-0">
          <p className="text-[16px] font-bold leading-tight text-[var(--foreground)]">{logoUrl ? say("lg_title") : say("lg_uploadTitle")}</p>
          <p className="mt-0.5 font-medium text-[var(--foreground-secondary)]">{logoUrl ? say("lg_body") : say("lg_uploadBody")}</p>
        </div>
      </div>
      <input accept="image/png,image/jpeg,image/webp" className="hidden" data-keep-original onChange={uploadChosen} ref={fileRef} type="file" />
      <div className="mt-3 flex flex-wrap gap-2">
        <button className={logoUrl ? "secondary-action" : "primary-action"} disabled={isPending} onClick={() => fileRef.current?.click()} type="button">
          {isPending ? say("lg_working") : logoUrl ? say("lg_replace") : say("lg_upload")}
        </button>
        {logoUrl ? (
          <button className="secondary-action" disabled={isPending} onClick={handleRemove} style={{ color: "var(--danger)" }} type="button">
            {say("lg_remove")}
          </button>
        ) : null}
      </div>
      {message ? <p className={`mt-2 font-bold ${message.type === "error" ? "text-[var(--danger)]" : "text-[var(--success)]"}`}>{say(message.key)}</p> : null}
    </div>
  );
}
