"use client";

import { useEffect, useRef, useState, type ComponentType } from "react";
import { storedThread } from "@/components/chat/chat-thread";
import { CHAT_OPEN_EVENT, type ChatOpenDetail } from "@/lib/chat-suggestions";
import type { SiteChatFullProps } from "./site-chat-full";

type Props = SiteChatFullProps & { label: string };

/**
 * The website's chat button (task perf2, 8 Nov 2026). The page is drawn with a plain copy of the launcher's button
 * (components/chat/chat-launcher.tsx, the same look and place), and the launcher itself, with next-intl and the
 * chat's own code, loads only when it can matter: the visitor's first tap, scroll or key press anywhere (it then
 * keeps the button clear of bars and the phone keyboard), a tap on the button (which also opens it), Ctrl/⌘+K, any
 * "open chat" request, a ?chat= link, or a chat already under way on this device (for the replied dot). Hovering or
 * focusing the button fetches it ahead. Until then the page carries none of that script.
 */
export function SiteChat({ label, ...props }: Props) {
  const [Full, setFull] = useState<ComponentType<SiteChatFullProps> | null>(null);
  const pending = useRef<ChatOpenDetail | null>(null);
  const loading = useRef(false);
  const ready = useRef(false);
  const openRef = useRef<((detail?: ChatOpenDetail) => void) | null>(null);

  useEffect(() => {
    const load = () => {
      if (loading.current) return;
      loading.current = true;
      import("./site-chat-full")
        .then((module) => {
          ready.current = true;
          setFull(() => module.SiteChatFull);
        })
        .catch(() => {
          loading.current = false;
        });
    };
    // Once the launcher is here it answers these itself.
    const open = (detail: ChatOpenDetail = {}) => {
      if (ready.current) return;
      pending.current = detail;
      load();
    };
    const onOpen = (event: Event) => open((event as CustomEvent<ChatOpenDetail>).detail || {});
    const onKey = (event: KeyboardEvent) => {
      if (ready.current) return;
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        open();
      } else load();
    };
    const first = { passive: true, once: true, capture: true } as const;
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    for (const type of ["pointerdown", "touchstart", "scroll", "wheel"]) window.addEventListener(type, load, first);
    // A ?chat= link opens the chat; a chat under way checks for replies (the launcher does both once loaded).
    let idle = 0;
    if (new URLSearchParams(window.location.search).has("chat")) load();
    else if (storedThread()) idle = window.setTimeout(load, 2000);
    openRef.current = open;
    return () => {
      window.clearTimeout(idle);
      window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
      for (const type of ["pointerdown", "touchstart", "scroll", "wheel"]) window.removeEventListener(type, load, first);
      openRef.current = null;
    };
  }, []);

  // Once the launcher is on the page (its listeners are attached before this runs), pass on a pending "open".
  useEffect(() => {
    if (!Full || !pending.current) return;
    const detail = pending.current;
    pending.current = null;
    window.dispatchEvent(new CustomEvent<ChatOpenDetail>(CHAT_OPEN_EVENT, { detail }));
  }, [Full]);

  if (Full) return <Full {...props} />;
  return (
    <div data-chat-root="">
      <button
        aria-expanded={false}
        aria-haspopup="dialog"
        aria-label={label}
        className="chat-launcher fixed z-[45] flex items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_12px_28px_-10px_rgba(16,38,43,0.55)] transition-[bottom,transform,opacity] duration-200 hover:bg-[var(--primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]"
        onClick={() => openRef.current?.()}
        onFocus={() => void import("./site-chat-full")}
        onPointerEnter={() => void import("./site-chat-full")}
        style={{ width: 52, height: 52, right: "max(16px, env(safe-area-inset-right))", bottom: "calc(16px + env(safe-area-inset-bottom))" }}
        type="button"
      >
        {/* lucide-react's MessageCircle (24px, stroke 2.2), as the launcher draws it. */}
        <svg aria-hidden="true" className="lucide lucide-message-circle" fill="none" height="24" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" viewBox="0 0 24 24" width="24" xmlns="http://www.w3.org/2000/svg">
          <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
        </svg>
      </button>
    </div>
  );
}
