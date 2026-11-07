"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { publishSite, revertSiteDraft, saveSiteDraft } from "@/app/actions/sites";
import { sameSite, SITE_MESSAGE, siteConfigFrom, type SiteConfig, type TextSlot } from "@/lib/sites/config";

export type SiteDraft = ReturnType<typeof useSiteDraft>;

/**
 * The website editor's state (Booking page tool): the draft, saved a moment after each change; what is published;
 * and the live preview, which gets every change straight away over postMessage instead of reloading. Text edited by
 * clicking it in the preview comes back the same way.
 */
export function useSiteDraft({ draft: initialDraft, published: initialPublished, uploads: initialUploads, frame }: { draft: SiteConfig; published: SiteConfig; uploads: Record<string, string>; frame: RefObject<HTMLIFrameElement | null> }) {
  const [draft, setDraft] = useState<SiteConfig>(initialDraft);
  const [published, setPublished] = useState<SiteConfig>(initialPublished);
  const [uploads, setUploads] = useState<Record<string, string>>(initialUploads);
  const [save, setSave] = useState<"idle" | "saving" | "saved" | "failed">("idle");
  const [publishing, setPublishing] = useState<"idle" | "publishing" | "published" | "failed">("idle");
  const first = useRef(true);
  const latest = useRef(draft);
  latest.current = draft;

  const update = useCallback((change: Partial<SiteConfig> | ((current: SiteConfig) => SiteConfig)) => {
    setPublishing("idle");
    // Kept as typed (spaces, half-typed links); tidied by siteConfigFrom when saved and when the preview draws it.
    setDraft((current) => (typeof change === "function" ? change(current) : { ...current, ...change }));
  }, []);

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: SITE_MESSAGE.config, config: latest.current, uploads }, window.location.origin);
  }, [frame, uploads]);

  // The preview: every change goes straight to it.
  useEffect(() => send(), [draft, send]);

  // From the preview: it's ready for the config, or text was edited in it.
  useEffect(() => {
    const listen = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== frame.current?.contentWindow) return;
      if (event.data?.type === SITE_MESSAGE.ready) send();
      if (event.data?.type === SITE_MESSAGE.text && typeof event.data.slot === "string") {
        const slot = event.data.slot as TextSlot;
        const value = String(event.data.value || "");
        update((current) => {
          const text = { ...current.text };
          if (value) text[slot] = value;
          else delete text[slot];
          return { ...current, text };
        });
      }
    };
    window.addEventListener("message", listen);
    return () => window.removeEventListener("message", listen);
  }, [frame, send, update]);

  // Saved as they go, a moment after the last change.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setSave("saving");
    const timer = setTimeout(async () => {
      const result = await saveSiteDraft(draft).catch(() => ({ ok: false as const, error: "" }));
      setSave(result.ok ? "saved" : "failed");
    }, 700);
    return () => clearTimeout(timer);
  }, [draft]);

  async function publish() {
    setPublishing("publishing");
    const result = await publishSite(latest.current).catch(() => ({ ok: false as const, error: "" }));
    if (!result.ok) return setPublishing("failed");
    setPublished(latest.current);
    setPublishing("published");
  }

  async function revert() {
    const result = await revertSiteDraft().catch(() => ({ ok: false as const, error: "" }));
    if (!result.ok) return setSave("failed");
    setUploads((current) => ({ ...current, ...result.uploads }));
    first.current = true;
    setDraft(result.config);
    setPublished(result.config);
    setSave("saved");
  }

  const addUpload = (path: string, url: string) => setUploads((current) => ({ ...current, [path]: url }));

  return { draft, published, uploads, update, addUpload, save, publishing, publish, revert, unpublished: !sameSite(siteConfigFrom(draft, draft.template), published), resend: send };
}
