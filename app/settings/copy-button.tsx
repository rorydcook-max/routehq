"use client";

import { useState } from "react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const el = document.createElement("textarea");
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <button
      className="pressable inline-flex items-center gap-2 rounded-lg border border-[#0f766e] bg-white px-3 py-2 text-sm font-semibold text-[#0f766e] hover:bg-[#f0fdf4]"
      onClick={handleCopy}
      type="button"
    >
      {copied ? "✓ Copied!" : "Copy webhook URL"}
    </button>
  );
}
