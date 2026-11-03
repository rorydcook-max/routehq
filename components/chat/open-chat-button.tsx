"use client";

import { MessageCircle } from "lucide-react";
import { openChat, type ChatOpenDetail } from "@/lib/chat-suggestions";

/** A button anywhere on a page that opens the live chat panel (the floating button's panel), optionally with a prompt or action. */
export function OpenChatButton({ label, detail, className }: { label: string; detail?: ChatOpenDetail; className?: string }) {
  return (
    <button className={className || "primary-action pressable"} onClick={() => openChat(detail)} type="button">
      <MessageCircle size={18} />
      {label}
    </button>
  );
}
