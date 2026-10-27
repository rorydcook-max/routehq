"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { CalendarDays, Check, Copy, Mail, Send } from "lucide-react";
import { connectTelegram, disconnectTelegram, makeCalendarFeed, saveAlertEmail } from "@/app/actions/integrations";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** One connection on Settings › Integrations: icon, name, a status pill, what it does, then its controls. */
export function IntegrationCard({ icon, title, status, body, children }: { icon: ReactNode; title: string; status?: { label: string; tone: "on" | "off" | "soon" }; body?: string; children?: ReactNode }) {
  const tone = status?.tone === "on" ? "bg-[var(--success-light)] text-[var(--success)]" : status?.tone === "soon" ? "bg-[var(--panel-tertiary)] text-[var(--muted)]" : "bg-[var(--warning-light)] text-[var(--warning)]";
  return (
    <section className="card flex flex-col p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--primary-light)] text-[var(--primary)]">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="card-title">{title}</h2>
            {status ? <span className={`rounded-full px-2.5 py-0.5 text-[13px] font-bold ${tone}`}>{status.label}</span> : null}
          </div>
          {body ? <p className="mt-1 font-medium text-[var(--foreground-secondary)]">{body}</p> : null}
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function EmailAlertsCard({ configured, emailTo, ownerEmail }: { configured: boolean; emailTo: string | null; ownerEmail: string | null }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const [pending, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <IntegrationCard
      body={say("ig_emailBody")}
      icon={<Mail size={20} />}
      status={configured ? { label: say("ig_ready"), tone: "on" } : { label: say("ig_soon"), tone: "soon" }}
      title={say("ig_emailTitle")}
    >
      {configured ? (
        <form
          action={(formData) =>
            start(async () => {
              const result = await saveAlertEmail(formData);
              setNote(result.ok ? { ok: true, text: say("saved") } : { ok: false, text: result.error });
            })
          }
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
        >
          <label className="!mb-0 min-w-0 flex-1">
            {say("ig_emailTo")}
            <input className="mt-1 w-full" defaultValue={emailTo || ""} name="email" placeholder={ownerEmail || "name@example.com"} type="email" />
          </label>
          <button className="primary-action pressable" disabled={pending} type="submit">
            {pending ? say("saving") : say("save")}
          </button>
        </form>
      ) : (
        <p className="text-[14px] font-medium text-[var(--muted)]">{say("ig_emailSoon")}</p>
      )}
      {note ? <p className={`mt-2 text-[14px] font-semibold ${note.ok ? "text-[var(--success)]" : "text-[var(--danger)]"}`}>{note.text}</p> : null}
    </IntegrationCard>
  );
}

export function TelegramCard({ configured, connected }: { configured: boolean; connected: boolean }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <IntegrationCard
      body={say("ig_telegramBody")}
      icon={<Send size={20} />}
      status={!configured ? { label: say("ig_soon"), tone: "soon" } : connected ? { label: say("ig_connected"), tone: "on" } : { label: say("ig_notConnected"), tone: "off" }}
      title="Telegram"
    >
      {!configured ? (
        <p className="text-[14px] font-medium text-[var(--muted)]">{say("ig_telegramSoon")}</p>
      ) : connected ? (
        <button className="secondary-action pressable" disabled={pending} onClick={() => start(async () => { await disconnectTelegram(); router.refresh(); })} type="button">
          {say("ig_disconnect")}
        </button>
      ) : (
        <div className="space-y-2">
          <button
            className="primary-action pressable"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const result = await connectTelegram();
                if (!result.ok || !result.url) return setError(result.ok ? null : result.error);
                setWaiting(true);
                window.open(result.url, "_blank", "noopener");
              })
            }
            type="button"
          >
            {say("ig_telegramConnect")}
          </button>
          {waiting ? (
            <p className="text-[14px] font-medium text-[var(--foreground-secondary)]">
              {say("ig_telegramWaiting")}{" "}
              <button className="font-bold text-[var(--primary)] hover:underline" onClick={() => router.refresh()} type="button">
                {say("ig_telegramDone")}
              </button>
            </p>
          ) : null}
          {error ? <p className="text-[14px] font-semibold text-[var(--danger)]">{error}</p> : null}
        </div>
      )}
    </IntegrationCard>
  );
}

export function CalendarFeedCard({ feedUrl }: { feedUrl: string | null }) {
  const say = useTranslations("settingsPage") as unknown as Say;
  const router = useRouter();
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);
  const webcal = feedUrl ? feedUrl.replace(/^https?:/, "webcal:") : null;
  const make = () => start(async () => { await makeCalendarFeed(); router.refresh(); });
  return (
    <IntegrationCard body={say("ig_calBody")} icon={<CalendarDays size={20} />} status={feedUrl ? { label: say("ig_ready"), tone: "on" } : undefined} title={say("ig_calTitle")}>
      {feedUrl && webcal ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <input aria-label={say("ig_calTitle")} className="min-w-0 flex-1 font-mono text-[13px]" readOnly value={feedUrl} onFocus={(event) => event.currentTarget.select()} />
            <button
              className="secondary-action pressable shrink-0"
              onClick={async () => {
                await navigator.clipboard.writeText(feedUrl).catch(() => null);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              type="button"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? say("ig_copied") : say("ig_copy")}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <a className="secondary-action pressable" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`} rel="noreferrer" target="_blank">
              {say("ig_calGoogle")}
            </a>
            <a className="secondary-action pressable" href={webcal}>
              {say("ig_calApple")}
            </a>
          </div>
          <p className="text-[13px] font-medium text-[var(--muted)]">
            {say("ig_calPrivate")}{" "}
            <button className="font-bold text-[var(--primary)] hover:underline" disabled={pending} onClick={make} type="button">
              {say("ig_calReset")}
            </button>
          </p>
        </div>
      ) : (
        <button className="primary-action pressable" disabled={pending} onClick={make} type="button">
          {say("ig_calMake")}
        </button>
      )}
    </IntegrationCard>
  );
}
