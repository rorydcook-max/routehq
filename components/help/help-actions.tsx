"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { setSupportThreadStatus } from "@/app/actions/support";

type Say = (key: string, values?: Record<string, string | number>) => string;

/** "Sorted" closes a conversation; writing again or "Open again" reopens it. */
export function HelpStatusButton({ threadId, closed }: { threadId: string; closed: boolean }) {
  const say = useTranslations("help") as unknown as Say;
  const [pending, start] = useTransition();
  return (
    <button
      className="secondary-action pressable"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setSupportThreadStatus({ threadId, status: closed ? "open" : "closed" });
        })
      }
      type="button"
    >
      {closed ? <RotateCcw size={17} /> : <CheckCircle2 size={17} />}
      {closed ? say("reopen") : say("markSorted")}
    </button>
  );
}
