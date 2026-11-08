"use client";

import { useRef } from "react";
import { ClipboardPaste } from "lucide-react";

/**
 * How to reach the customer (Rory, 1 Nov 2026): one tap on a chip, no dropdown. WhatsApp and Phone/SMS use the
 * phone number already typed, so nothing more to fill in. Messenger takes their name or a pasted profile link,
 * both optional, with a Paste button so a link copied on the phone goes in with one tap.
 */
const methods = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "messenger", label: "Messenger" },
  { value: "line", label: "LINE" },
  { value: "telegram", label: "Telegram" },
  { value: "instagram", label: "Instagram" },
  { value: "phone", label: "" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" }
];

export function ContactChoice({
  contact,
  setContact,
  say,
  inputClass,
  phoneGiven = true
}: {
  contact: string;
  setContact: (value: string) => void;
  say: (key: string) => string;
  inputClass: string;
  /** No phone typed: the chosen chat is the only way to reach them, so its field isn't marked optional. */
  phoneGiven?: boolean;
}) {
  const extraRef = useRef<HTMLInputElement>(null);

  async function paste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text && extraRef.current) extraRef.current.value = text.trim();
    } catch {
      extraRef.current?.focus();
    }
  }

  const extra =
    contact === "messenger"
      ? { name: "messengerId", placeholder: say(phoneGiven ? "sel_messengerName" : "sel_messengerNameOnly"), type: "text", paste: true }
      : contact === "line"
        ? { name: "lineId", placeholder: say(phoneGiven ? "sel_lineId" : "sel_lineIdOnly"), type: "text", paste: true }
        : contact === "telegram"
          ? { name: "telegramUsername", placeholder: say(phoneGiven ? "sel_telegramId" : "sel_telegramIdOnly"), type: "text", paste: true }
          : contact === "instagram"
            ? { name: "instagramHandle", placeholder: say("sel_instagram"), type: "text", paste: true }
          : contact === "email"
            ? { name: "email", placeholder: say("sel_email"), type: "email", paste: false }
            : null;

  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-[var(--foreground)]">{say("sel_channels")}</p>
      <div className="flex flex-wrap gap-2">
        {methods.map((method) => (
          <label
            className={`inline-flex h-9 cursor-pointer items-center rounded-full border px-3 text-sm font-semibold ${
              contact === method.value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--primary)]/35 bg-white text-[var(--primary)]"
            }`}
            key={method.value}
          >
            <input checked={contact === method.value} className="sr-only" name="preferredContactMethod" onChange={() => setContact(method.value)} type="radio" value={method.value} />
            {method.label || say("sel_phoneCall")}
          </label>
        ))}
      </div>
      {extra ? (
        <div className="mt-2 flex gap-2">
          <input className={inputClass} key={extra.name} name={extra.name} placeholder={extra.placeholder} ref={extraRef} type={extra.type} />
          {extra.paste ? (
            <button
              aria-label={say("sel_paste")}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-semibold text-[var(--primary)]"
              onClick={paste}
              type="button"
            >
              <ClipboardPaste size={16} />
              {say("sel_paste")}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
