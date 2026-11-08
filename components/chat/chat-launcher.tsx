"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { MessageCircle, X } from "lucide-react";
import { chatPoll } from "@/app/actions/chat";
import { ChatPanel, storedThread, type ChatRequest } from "@/components/chat/chat-panel";
import { CHAT_OPEN_EVENT, type ChatOpenDetail } from "@/lib/chat-suggestions";

const SIZE = 52;
const GAP = 12;
/** The launcher's resting place: 16px in from the corner, plus the phone's safe area. */
const BASE = 16;

// Customers of a business (booking, amending, the rental directory) aren't RoveHQ's users: no chat for them. Nor in
// RoveHQ's own admin pages, where the team answers chats rather than starting them.
const NO_CHAT = /^\/(book|amend|rent|platform)(\/|$)|^\/help\/team(\/|$)/;
/**
 * Form pages (build-s, 8 Nov 2026): on a phone the button sat on fields at the right edge (the new booking's end-date
 * icon, the fleet form, the vehicle page) as well as the save bars, so it is not shown there below tablet width.
 * Help's "Open live chat" and Ctrl/⌘+K still open the chat.
 */
const FORM_PAGE = /^\/(bookings\/(new|[^/]+\/edit)|customers\/new|fleet\/(new|import|[^/]+(\/edit)?)|receipts\/new|transactions\/new|inspections(\/.*)?)\/?$/;

/**
 * Bars pinned to the bottom of the screen that the button must sit above: the phone tab bar (.glass-bar), form
 * Back/Next/Save bars (.sticky-actions, or any fixed/sticky element with a bottom-* class), and anything marked
 * data-chat-avoid. Measured from the page itself, so a new bar is avoided without anyone telling the chat about it.
 */
const BAR_SELECTOR = '.glass-bar, .sticky-actions, [data-chat-avoid], [class*="fixed"][class*="bottom-"], [class*="sticky"][class*="bottom-"]';
/** Something modal is open (a dialog, a phone sheet): the button steps aside until it closes. */
const MODAL_SELECTOR = '[role="dialog"], [aria-modal="true"], dialog[open], .sheet-scrim';

function measure(): { lift: number; modal: boolean; keyboard: boolean } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let lift = 0;
  let modal = false;
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(MODAL_SELECTOR))) {
    if (element.closest("[data-chat-root]")) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden") {
      modal = true;
      break;
    }
  }
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(BAR_SELECTOR))) {
    if (element.closest("[data-chat-root]")) continue;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    const style = getComputedStyle(element);
    if ((style.position !== "fixed" && style.position !== "sticky") || style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) continue;
    // Only bars in the bottom stretch of the screen, under the button's column.
    if (rect.top >= vh || rect.bottom < vh - 180) continue;
    if (rect.right < vw - (BASE + SIZE + 8) || rect.left > vw - BASE) continue;
    // A tall fixed layer at the bottom is a sheet or overlay, not a bar: treat it like a dialog.
    if (rect.height > vh * 0.5) {
      modal = true;
      continue;
    }
    lift = Math.max(lift, vh - rect.top + GAP);
  }
  // A phone's on-screen keyboard shrinks the visual viewport; the button would float over the text being typed.
  const viewport = window.visualViewport;
  const active = document.activeElement as HTMLElement | null;
  const typing = Boolean(active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.isContentEditable) && !active.closest("[data-chat-root]"));
  const keyboard = Boolean(viewport && typing && window.matchMedia("(pointer: coarse)").matches && vh - viewport.height > 150);
  return { lift, modal, keyboard };
}

/**
 * The floating chat button, bottom-right on every app and website page. It opens the live chat panel, shows a dot
 * when the RoveHQ team has replied, and opens with Ctrl/⌘+K. It never covers the page's own controls: it lifts above
 * any bar pinned to the bottom (measured, see BAR_SELECTOR), hides while a dialog is open or a phone keyboard is up.
 * Other parts of the app open it with openChat() from lib/chat-suggestions.
 */
export function ChatLauncher({ site = false, owner }: { site?: boolean; owner?: boolean }) {
  const t = useTranslations("chat");
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [unread, setUnread] = useState(false);
  const [place, setPlace] = useState({ lift: 0, modal: false, keyboard: false });
  const [request, setRequest] = useState<ChatRequest | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  const disabled = NO_CHAT.test(pathname);

  const show = useCallback((detail?: ChatOpenDetail) => {
    setMounted(true);
    setOpen(true);
    setUnread(false);
    if (detail && (detail.prompt || detail.action)) setRequest({ ...detail, nonce: Date.now() });
  }, []);

  // Where the button sits: re-measured on scroll, resize, the keyboard, and twice a second for bars that appear later.
  useEffect(() => {
    if (disabled) return;
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const next = measure();
        setPlace((current) => (current.lift === next.lift && current.modal === next.modal && current.keyboard === next.keyboard ? current : next));
      });
    };
    update();
    const timer = window.setInterval(update, 500);
    window.addEventListener("scroll", update, { passive: true, capture: true });
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    document.addEventListener("focusin", update);
    document.addEventListener("focusout", update);
    return () => {
      cancelAnimationFrame(frame);
      window.clearInterval(timer);
      window.removeEventListener("scroll", update, { capture: true });
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
      document.removeEventListener("focusin", update);
      document.removeEventListener("focusout", update);
    };
  }, [disabled, pathname]);

  // It stays put while scrolling (Rory, 3 Nov 2026: on his iPhone it vanished when scrolling down). Pages end with
  // extra bottom space (app-shell's pb-44 / lg:pb-24, the website footer's padding), so the last rows scroll clear of it.

  // ?chat=1 opens the chat, ?chat=photos opens it ready for vehicle photos: where the old fleet assistant page and its
  // links now land. Checked on each page and every so often (a redirect to the same page doesn't change the path).
  useEffect(() => {
    if (disabled) return;
    const check = () => {
      const url = new URL(window.location.href);
      const asked = url.searchParams.get("chat");
      if (!asked) return;
      url.searchParams.delete("chat");
      window.history.replaceState(window.history.state, "", url.toString());
      show(asked === "photos" ? { action: "vehicle" } : {});
    };
    check();
    const timer = window.setInterval(check, 700);
    return () => window.clearInterval(timer);
  }, [disabled, pathname, show]);

  // Ctrl/⌘+K opens it from anywhere (it used to open the old "Ask anything" box); a second press closes it.
  useEffect(() => {
    if (disabled) return;
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (open) setOpen(false);
        else show();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, open, show]);

  // "Open live chat" and other buttons elsewhere in the app.
  useEffect(() => {
    if (disabled) return;
    const onOpen = (event: Event) => show((event as CustomEvent<ChatOpenDetail>).detail || {});
    window.addEventListener(CHAT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(CHAT_OPEN_EVENT, onOpen);
  }, [disabled, show]);

  // The dot: once a minute while closed, a cheap look at whether the team has replied in their chat.
  useEffect(() => {
    if (disabled || open) return;
    const check = async () => {
      const id = storedThread();
      if (!id || document.hidden) return;
      const result = await chatPoll(id, null, true).catch(() => null);
      if (result && result.ok) setUnread(result.unread);
    };
    const first = window.setTimeout(check, 3000);
    const timer = window.setInterval(check, 60_000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [disabled, open]);

  // Back to the button when the panel closes, so keyboard users don't lose their place.
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (disabled) return null;
  const bottom = place.lift > 0 ? `${place.lift}px` : `calc(${BASE}px + env(safe-area-inset-bottom))`;
  const hidden = !open && (place.modal || place.keyboard);
  // On a computer the panel sits just above the button.
  const panelBottom = Math.max(place.lift, BASE) + SIZE + GAP;

  return (
    <div data-chat-root="">
      <button
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? t("launcherClose") : unread ? `${t("launcher")} (${t("unread")})` : t("launcher")}
        className={`chat-launcher fixed z-[45] flex items-center justify-center rounded-full bg-[var(--primary)] text-white shadow-[0_12px_28px_-10px_rgba(16,38,43,0.55)] transition-[bottom,transform,opacity] duration-200 hover:bg-[var(--primary-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] ${
          hidden ? "pointer-events-none scale-75 opacity-0" : ""
        } ${open ? "max-lg:hidden" : FORM_PAGE.test(pathname) ? "max-md:hidden" : ""}`}
        onClick={() => (open ? setOpen(false) : show())}
        ref={button}
        style={{ width: SIZE, height: SIZE, right: `max(${BASE}px, env(safe-area-inset-right))`, bottom }}
        tabIndex={hidden ? -1 : undefined}
        type="button"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} strokeWidth={2.2} />}
        {unread && !open ? <span aria-hidden="true" className="absolute right-0.5 top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-[var(--danger)]" /> : null}
      </button>
      {mounted ? <ChatPanel desktopBottom={panelBottom} onClose={() => setOpen(false)} open={open} ownerHint={owner} pathname={pathname} request={request} site={site} /> : null}
    </div>
  );
}
