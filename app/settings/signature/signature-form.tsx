"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { updateOwnerSignature } from "@/app/actions/settings";
import { SignaturePad } from "@/components/signature-pad";

type Say = (key: string, values?: Record<string, string>) => string;

const labelClass = "font-semibold text-[var(--foreground-secondary)]";

/**
 * Everything the business needs before customers can sign, on one small
 * screen: who signs, their signature drawn with a finger (or a photo of it),
 * and their agreement to it being used. One Save.
 */
export function SignatureForm({ defaultName, defaultTitle, ready, backHref }: { defaultName: string; defaultTitle: string; ready: boolean; backHref: string }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const authorisation = useTranslations("settings.contractsBranding") as unknown as (key: string) => string;
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(defaultName);
  const [title, setTitle] = useState(defaultTitle);
  const [drawn, setDrawn] = useState("");
  const [hasFile, setHasFile] = useState(false);
  const [usePhoto, setUsePhoto] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [changing, setChanging] = useState(!ready);
  const [isPending, startTransition] = useTransition();

  const hasSignature = usePhoto ? hasFile : Boolean(drawn);
  const missing = !name.trim() ? say("sig_needName") : !title.trim() ? say("sig_needTitle") : !hasSignature ? say("sig_needSignature") : !agreed ? say("sig_needAgree") : "";

  function save() {
    if (missing) {
      setError(missing);
      return;
    }
    setError("");
    startTransition(async () => {
      try {
        const formData = new FormData();
        const photo = fileRef.current?.files?.[0];
        if (usePhoto && photo) {
          formData.set("signature", photo);
        } else {
          const blob = await (await fetch(drawn)).blob();
          formData.set("signature", new File([blob], "signature.png", { type: "image/png" }));
        }
        formData.set("signature_authorisation_acknowledged", "true");
        formData.set("authorised_signatory_name", name.trim());
        formData.set("authorised_signatory_title", title.trim());
        await updateOwnerSignature(formData);
        setSaved(true);
        window.setTimeout(() => router.push(backHref as never), 1200);
      } catch {
        setError(say("sig_failed"));
      }
    });
  }

  if (saved || (ready && !changing)) {
    return (
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[var(--success-light)] text-[var(--success)]">
            <Check size={24} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-[var(--foreground)]">{say("sig_readyTitle")}</h2>
            <p className="font-medium text-[var(--foreground-secondary)]">{say("sig_readyBody", { name: name || defaultName })}</p>
          </div>
        </div>
        {!saved ? (
          <div className="mt-4 grid gap-2">
            <a className="primary-action pressable w-full" href={backHref}>
              {say("sig_done")}
            </a>
            <button className="secondary-action pressable w-full" onClick={() => setChanging(true)} type="button">
              {say("sig_change")}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="card space-y-4 p-4">
      <label className="block">
        <span className={labelClass}>{say("sig_name")}</span>
        <input autoComplete="name" className="mt-1 w-full" maxLength={160} onChange={(event) => setName(event.target.value)} value={name} />
        <span className="mt-1 block font-medium text-[var(--foreground-secondary)]">{say("sig_nameHelp")}</span>
      </label>
      <label className="block">
        <span className={labelClass}>{say("sig_title")}</span>
        <input className="mt-1 w-full" maxLength={160} onChange={(event) => setTitle(event.target.value)} value={title} />
      </label>

      <div>
        <p className={labelClass}>{say("sig_signature")}</p>
        {usePhoto ? (
          <input accept="image/png,image/jpeg,image/webp" className="mt-1 max-w-full" data-keep-original onChange={(event) => setHasFile(Boolean(event.target.files?.length))} ref={fileRef} type="file" />
        ) : (
          <div className="mt-1">
            <SignaturePad clearLabel={say("sig_clear")} hint={say("sig_hint")} onChange={setDrawn} />
          </div>
        )}
        <button className="pressable min-h-11 px-1 font-bold text-[var(--primary)]" onClick={() => setUsePhoto((value) => !value)} type="button">
          {usePhoto ? say("sig_useFinger") : say("sig_usePhoto")}
        </button>
      </div>

      <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[var(--panel-secondary)] p-3.5 font-medium text-[var(--foreground)]">
        <input checked={agreed} className="mt-0.5 h-5 w-5 shrink-0" onChange={(event) => setAgreed(event.target.checked)} type="checkbox" />
        <span>{authorisation("signatureAuthorisation")}</span>
      </label>

      {error ? <p className="rounded-xl bg-[var(--warning-light)] p-3 font-semibold text-[var(--foreground)]">{error}</p> : null}
      <button className="primary-action pressable w-full" disabled={isPending} onClick={save} type="button">
        {isPending ? say("saving") : say("sig_save")}
      </button>
    </section>
  );
}
