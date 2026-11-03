"use client";

import { useEffect } from "react";

/** Inside the booking box on a business's own site: tells the page around it how tall to make the box. */
export function EmbedHeight() {
  useEffect(() => {
    if (window.parent === window) return;
    const send = () => window.parent.postMessage({ type: "routehq:height", height: document.documentElement.scrollHeight }, "*");
    const observer = new ResizeObserver(send);
    observer.observe(document.body);
    send();
    return () => observer.disconnect();
  }, []);
  return null;
}
