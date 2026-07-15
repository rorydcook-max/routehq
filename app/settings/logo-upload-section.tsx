"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateBusinessLogo } from "@/app/actions/settings";
import { BusinessLogoImage } from "@/components/business-logo-image";

export function LogoUploadSection({
  logoUrl,
  orgName
}: {
  logoUrl: string | null | undefined;
  orgName: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ text: string; type: "error" | "success" } | null>(null);
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      try {
        await updateBusinessLogo(formData);
        setMessage({ text: "Logo updated successfully.", type: "success" });
        router.refresh();
      } catch (err) {
        setMessage({ text: err instanceof Error ? err.message : "Failed to update logo.", type: "error" });
      }
    });
  }

  function handleRemove() {
    const fd = new FormData();
    fd.set("remove_logo", "true");
    submit(fd);
  }

  function handleReplace() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ text: "Please select an image file.", type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("logo", file);
    submit(fd);
  }

  function handleUpload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setMessage({ text: "Please select an image file.", type: "error" });
      return;
    }
    const fd = new FormData();
    fd.set("logo", file);
    submit(fd);
  }

  const fileInputClass = "max-w-52 text-xs text-[#667085] file:mr-2 file:rounded-lg file:border-0 file:bg-[#ecfeff] file:px-2.5 file:py-1.5 file:text-xs file:font-bold file:text-[#0e7490]";

  if (logoUrl) {
    return (
      <div className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <BusinessLogoImage alt={`${orgName} logo`} className="h-10 w-14 rounded-lg border border-[var(--border)] bg-white object-contain p-1.5" src={logoUrl} />
          <div>
            <p className="text-[13px] font-bold text-[#172026]">Business logo</p>
            <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">Appears on contracts, booking links and receipts.</p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button className="secondary-action w-full sm:w-auto" disabled={isPending} onClick={handleRemove} type="button">
            {isPending ? "Removing..." : "Remove logo"}
          </button>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input accept="image/png,image/jpeg,image/webp" className={fileInputClass} ref={fileRef} type="file" />
            <button className="primary-action w-full sm:w-auto" disabled={isPending} onClick={handleReplace} type="button">
              {isPending ? "Replacing..." : "Replace logo"}
            </button>
          </div>
        </div>
        {message ? (
          <p className={`mt-1 w-full text-xs ${message.type === "error" ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{message.text}</p>
        ) : null}
      </div>
    );
  }

  return (
    <form className="flex flex-col gap-3 rounded-lg border border-[#dfe4ea] bg-[#fbfefd] p-3 sm:flex-row sm:items-center sm:justify-between" onSubmit={handleUpload}>
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-[#ecfeff] text-[#0e7490]">
          <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="24">
            <path d="M5 7h2l1.5-2h7L17 7h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z" />
            <circle cx="12" cy="14" r="4" />
          </svg>
        </div>
        <div>
          <p className="text-[13px] font-bold text-[#172026]">Upload your business logo</p>
          <p className="mt-0.5 text-[11px] leading-4 text-[#667085]">PNG, JPG or SVG. Recommended 400x200px or wider. Appears on contracts, booking links and receipts.</p>
        </div>
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
        <input accept="image/png,image/jpeg,image/webp" className={fileInputClass} ref={fileRef} type="file" />
        <button className="primary-action w-full sm:w-auto" disabled={isPending} type="submit">
          {isPending ? "Uploading..." : "Upload logo"}
        </button>
      </div>
      {message ? (
        <p className={`mt-1 w-full text-xs ${message.type === "error" ? "text-[#dc2626]" : "text-[#16a34a]"}`}>{message.text}</p>
      ) : null}
    </form>
  );
}
