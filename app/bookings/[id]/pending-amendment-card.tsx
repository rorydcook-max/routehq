"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { FilePen } from "lucide-react";
import { cancelRentalAmendment } from "@/app/actions/amendments";
import { AmendmentLinkPanel } from "@/components/rental-adjustment-modal";
import { Card, SectionHeader } from "@/components/ui";

export function PendingAmendmentCard({ id, token, rows }: { id: string; token: string; rows: Array<{ label: string; before: string; after: string }> }) {
  const router = useRouter();
  const [cancelling, startCancel] = useTransition();

  return (
    <Card>
      <SectionHeader eyebrow="Amendment" title="Waiting for the customer to sign" />
      <ul className="mt-3 space-y-1 text-sm text-[#344054]">
        {rows.map((row) => (
          <li className="flex items-start gap-2" key={row.label}>
            <FilePen className="mt-0.5 shrink-0 text-[#0f766e]" size={14} />
            <span>
              <span className="font-bold">{row.label}:</span> {row.before !== "-" ? `${row.before} → ` : ""}
              <span className="font-bold">{row.after}</span>
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <AmendmentLinkPanel
          cancelling={cancelling}
          onCancel={() =>
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
