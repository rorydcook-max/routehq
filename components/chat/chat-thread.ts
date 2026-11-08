/** The chat's thread id is kept in this browser, so the conversation is still there on the next page or visit. */
export const THREAD_KEY = "rove-chat-thread";

/**
 * The remembered thread, if any. Kept apart from chat-panel.tsx so the floating button (chat-launcher.tsx) can check
 * for replies without loading the whole panel, which now loads only when the chat is opened (task perf, 8 Nov 2026).
 */
export function storedThread() {
  try {
    return window.localStorage.getItem(THREAD_KEY) || "";
  } catch {
    return "";
  }
}
