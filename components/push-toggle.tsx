"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useState } from "react";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/push";

type State = "checking" | "unsupported" | "needs-install" | "blocked" | "off" | "on";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || "";
const DISMISS_KEY = "routehq_push_prompt_dismissed";

function keyBytes(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

async function currentState(): Promise<State> {
  if (!PUBLIC_KEY) return "unsupported";
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone === true;
  const apple = /iPhone|iPad|iPod/.test(navigator.userAgent);
  // iPhones only allow alerts once the app is on the home screen.
  if (apple && !standalone) return "needs-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = registration ? await registration.pushManager.getSubscription() : null;
  return subscription && Notification.permission === "granted" ? "on" : "off";
}

/**
 * Alerts on this phone or computer. "card" is the full control on the account
 * page; "prompt" is a single quiet line on the dashboard that only shows while
 * alerts are off and hasn't been dismissed.
 */
export function PushToggle({ variant = "card" }: { variant?: "card" | "prompt" }) {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(DISMISS_KEY) === "1");
    currentState().then(setState).catch(() => setState("unsupported"));
  }, []);

  async function turnOn() {
    setBusy(true);
    setNote("");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "blocked" : "off");
        return;
      }
      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const subscription = (await registration.pushManager.getSubscription()) || (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(PUBLIC_KEY) }));
      const saved = await savePushSubscription(subscription.toJSON() as any, navigator.userAgent);
      if (!saved.ok) {
        setNote("Couldn't turn alerts on. Please try again.");
        return;
      }
      setState("on");
      setNote("Alerts are on for this device.");
    } catch {
      setNote("Couldn't turn alerts on. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function turnOff() {
    setBusy(true);
    setNote("");
    try {
      const registration = await navigator.serviceWorker.getRegistration("/sw.js");
      const subscription = registration ? await registration.pushManager.getSubscription() : null;
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      setState("off");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const result = await sendTestPush().catch(() => ({ ok: false }));
    setNote(result.ok ? "Sent. It should arrive in a moment." : "The test couldn't be sent.");
    setBusy(false);
  }

  if (variant === "prompt") {
    if (dismissed || (state !== "off" && state !== "needs-install")) return null;
    return (
      <div className="mb-3 flex items-center gap-3 rounded-[10px] border-[0.5px] border-[var(--border)] bg-[var(--panel)] px-3.5 py-2.5">
        <Bell className="shrink-0 text-[var(--primary)]" size={18} />
        <p className="min-w-0 flex-1 text-sm text-[var(--foreground-secondary)]">
          {state === "needs-install" ? "To get alerts on this iPhone, tap Share, then Add to Home Screen, and open RouteHQ from there." : "Get an alert on this device when a customer books, pays or asks for something."}
        </p>
        {state === "off" ? (
          <button className="pressable shrink-0 rounded-lg bg-[var(--primary)] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60" disabled={busy} onClick={turnOn} type="button">
            Turn on
          </button>
        ) : null}
        <button
          aria-label="Not now"
          className="pressable shrink-0 rounded-lg px-2 py-1.5 text-xs font-semibold text-[var(--muted)]"
          onClick={() => {
            window.localStorage.setItem(DISMISS_KEY, "1");
            setDismissed(true);
          }}
          type="button"
        >
          Not now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-sm">
      <p className="text-xs text-[var(--muted)]">An alert on this device when a customer books, pays, asks for something or sends a message. Each phone or computer is switched on separately.</p>
      {state === "checking" ? <p className="text-[var(--muted)]">Checking…</p> : null}
      {state === "unsupported" ? <p className="text-[var(--foreground-secondary)]">This browser can't show alerts. Try Chrome on Android or a computer, or add RouteHQ to your iPhone's home screen.</p> : null}
      {state === "needs-install" ? (
        <p className="text-[var(--foreground-secondary)]">On an iPhone, alerts work once RouteHQ is on your home screen: tap Share, then Add to Home Screen, open RouteHQ from there and come back to this page.</p>
      ) : null}
      {state === "blocked" ? <p className="text-[var(--foreground-secondary)]">Alerts are blocked for RouteHQ in this browser's settings. Allow notifications there, then come back.</p> : null}
      {state === "off" ? (
        <button className="primary-action pressable w-full disabled:opacity-60" disabled={busy} onClick={turnOn} type="button">
          <Bell size={16} />
          Turn on alerts on this device
        </button>
      ) : null}
      {state === "on" ? (
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-2 rounded-lg bg-[var(--primary-light)] px-3 py-2 text-sm font-semibold text-[var(--primary)]">
            <Bell size={16} /> Alerts are on
          </span>
          <button className="secondary-action pressable disabled:opacity-60" disabled={busy} onClick={test} type="button">
            Send a test
          </button>
          <button className="secondary-action pressable disabled:opacity-60" disabled={busy} onClick={turnOff} type="button">
            <BellOff size={16} /> Turn off
          </button>
        </div>
      ) : null}
      {note ? <p className="text-xs font-semibold text-[var(--primary)]">{note}</p> : null}
    </div>
  );
}
