"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { UserRound } from "lucide-react";
import { customerWithContact } from "@/app/actions/customers";

/** Watches the contact fields of the form it sits in (phone, email, chat handles) and says so when one is already saved. */
export function DuplicatePhoneHint({ organizationId, codeName = "phoneCountryCode", inputName = "phone" }: { organizationId: string; codeName?: string; inputName?: string }) {
  const say = useTranslations("customerPage");
  const marker = useRef<HTMLSpanElement>(null);
  const [match, setMatch] = useState<{ id: string; name: string; byPhone: boolean } | null>(null);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) return;
    // The phone field keeps its values in hidden inputs, so listen to the whole form and read them when checking.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let asked = 0;
    const check = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const value = (name: string) => form.querySelector<HTMLInputElement>(`[name="${name}"]`)?.value.trim() || "";
        const fields = {
          code: value(codeName),
          phone: value(inputName),
          whatsapp: value("whatsappNumber"),
          email: value("email"),
          messenger: value("messengerId"),
          line: value("lineId"),
          telegram: value("telegramUsername"),
          instagram: value("instagramHandle")
        };
        if (!Object.entries(fields).some(([key, entry]) => key !== "code" && entry)) return setMatch(null);
        const ask = ++asked;
        const found = await customerWithContact(organizationId, fields).catch(() => null);
        // Found by the phone number, or by one of the other ways to reach them.
        const byPhone = Boolean(found && fields.phone && !fields.email && !fields.messenger && !fields.line && !fields.telegram && !fields.instagram);
        if (ask === asked) setMatch(found ? { ...found, byPhone } : null);
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
        // Its own space above and below: inside display:contents the form's spacing doesn't reach it, so it sat against the
        // "Add customer" button (final pre-release test, 8 Nov 2026).
        <span className="tile-sky my-2 flex items-center gap-3 rounded-xl p-3 sm:col-span-2" role="status">
          <UserRound className="shrink-0" size={20} />
          <span className="min-w-0 flex-1 font-semibold">{say(match.byPhone ? "dupPhone" : "dupContact", { name: match.name })}</span>
          <Link className="shrink-0 whitespace-nowrap font-bold text-[var(--primary)] underline" href={`/customers/${match.id}`}>
            {say("dupOpen")}
          </Link>
        </span>
      ) : null}
    </span>
  );
}
