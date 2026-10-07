"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { FilePen } from "lucide-react";
import { cancelRentalAmendment } from "@/app/actions/amendments";
import { AmendmentLinkPanel } from "@/components/rental-adjustment-modal";
import { Card, SectionHeader } from "@/components/ui";

export function PendingAmendmentCard({ id, token, rows, changedAlready = false }: { id: string; token: string; rows: Array<{ label: string; before: string; after: string }>; changedAlready?: boolean }) {
  const router = useRouter();
  const [cancelling, startCancel] = useTransition();
  const say = useTranslations("booking") as unknown as (key: string) => string;
  // The rows come in the agreement's own English; the row names are shown in the reader's language.
  const customer = useTranslations("customer") as unknown as (key: string) => string;
  const rowNames: Record<string, string> = { Vehicle: "rowVehicle", "Return date": "rowReturnDate", "Charge for the extension": "rowExtensionCharge", "Rental rate": "rowRentalRate", "Security deposit": "rowDeposit" };

  return (
    <Card>
      <SectionHeader eyebrow={say("amend_eyebrow")} title={say("amend_title")} />
      <ul className="mt-3 space-y-1 text-sm text-[var(--foreground-secondary)]">
        {rows.map((row) => (
          <li className="flex items-start gap-2" key={row.label}>
            <FilePen className="mt-0.5 shrink-0 text-[var(--primary)]" size={14} />
            <span>
              <span className="font-bold">{rowNames[row.label] ? customer(rowNames[row.label]) : row.label}:</span> {row.before !== "-" ? `${row.before} → ` : ""}
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
