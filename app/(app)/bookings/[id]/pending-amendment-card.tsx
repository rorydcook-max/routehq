"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { amendmentDisplayRows } from "@/lib/amendment-display";
import { FilePen } from "lucide-react";
import { cancelRentalAmendment } from "@/app/actions/amendments";
import { AmendmentLinkPanel } from "@/components/rental-adjustment-modal";
import { Card, SectionHeader } from "@/components/ui";

export function PendingAmendmentCard({ id, token, changes, changedAlready = false }: { id: string; token: string; changes: Record<string, any>; changedAlready?: boolean }) {
  const router = useRouter();
  const [cancelling, startCancel] = useTransition();
  const say = useTranslations("booking") as unknown as (key: string) => string;
  // What is changing, in the reader's language. The signed document keeps its own wording.
  const locale = useLocale();
  const customer = useTranslations("customer") as unknown as (key: string, values?: Record<string, string | number>) => string;
  const rows = amendmentDisplayRows(changes, locale, customer);

  return (
    <Card>
      <SectionHeader eyebrow={say("amend_eyebrow")} title={say("amend_title")} />
      <ul className="mt-3 space-y-1 text-sm text-[var(--foreground-secondary)]">
        {rows.map((row) => (
          <li className="flex items-start gap-2" key={row.key}>
            <FilePen className="mt-0.5 shrink-0 text-[var(--primary)]" size={14} />
            <span>
              <span className="font-bold">{row.label}:</span> {row.before ? `${row.before} → ` : ""}
              <span className="font-bold">{row.after}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <AmendmentLinkPanel
          cancelling={cancelling}
          changedAlready={changedAlready}
          // Once the vehicle has changed, the form can't be withdrawn: it records what happened.
          onCancel={
            changedAlready
              ? undefined
              : () =>
                  startCancel(async () => {
                    const result = await cancelRentalAmendment(id);
                    if (result.ok) router.refresh();
                  })
          }
          token={token}
        />
      </div>
    </Card>
  );
}
