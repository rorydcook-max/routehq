"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { customerWithPhone } from "@/app/actions/customers";

/** Watches the phone fields of the form it sits in and says so when that number is already saved. */
export function DuplicatePhoneHint({ organizationId, codeName = "phoneCountryCode", inputName = "phone" }: { organizationId: string; codeName?: string; inputName?: string }) {
  const say = useTranslations("customerPage");
  const marker = useRef<HTMLSpanElement>(null);
  const [match, setMatch] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    // The phone field keeps its values in hidden inputs, so listen to the whole form and read them when checking.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let asked = 0;
    const check = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const input = form.querySelector<HTMLInputElement>(`[name="${inputName}"]`);
        const code = form.querySelector<HTMLInputElement>(`[name="${codeName}"]`);
        if (!input?.value) return setMatch(null);
        const ask = ++asked;
        const found = await customerWithPhone(organizationId, code?.value || "+66", input.value).catch(() => null);
        if (ask === asked) setMatch(found);
      }, 450);
    };
    form.addEventListener("input", check);
    form.addEventListener("change", check);
    return () => {
      if (timer) clearTimeout(timer);
      form.removeEventListener("input", check);
      form.removeEventListener("change", check);
    };
  }, [organizationId, codeName, inputName]);

  return (
    <span className="contents" ref={marker}>
      {match ? (
        <span className="tile-sky flex items-center gap-3 rounded-xl p-3 sm:col-span-2" role="status">
          <UserRound className="shrink-0" size={20} />
          <span className="min-w-0 flex-1 font-semibold">{say("dupPhone", { name: match.name })}</span>
          <Link className="shrink-0 whitespace-nowrap font-bold text-[var(--primary)] underline" href={`/customers/${match.id}`}>
            {say("dupOpen")}
          </Link>
        </span>
      ) : null}
    </span>
  );
}
