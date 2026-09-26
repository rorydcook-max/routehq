import { Download, FileSignature, ShieldCheck } from "lucide-react";
import { Badge, Card, SectionHeader } from "@/components/ui";
import type { BookingRentalDocument } from "@/lib/booking-rental-documents";

function formatSignedAt(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function statusBadge(document: BookingRentalDocument) {
  if (document.status === "signed") return { tone: "green" as const, label: "Signed" };
  if (document.status === "finalised") return { tone: "green" as const, label: "Final" };
  if (document.status === "partially_signed") return { tone: "blue" as const, label: "Partly signed" };
  if (document.status === "void") return { tone: "neutral" as const, label: "Void" };
  return { tone: "amber" as const, label: "Awaiting customer" };
}

export function RentalDocumentsCard({ documents }: { documents: BookingRentalDocument[] }) {
  const hasAgreement = documents.some((document) => document.type === "rental_agreement");

  return (
    <Card>
      <SectionHeader eyebrow="Documents" title="Agreement and reports" />
      <div className="mt-3 space-y-3">
        {!hasAgreement ? (
          <p className="empty-state text-sm">The rental agreement is prepared when the customer opens their booking link, and signed when they complete it.</p>
        ) : null}
        {documents.map((document) => {
          const badge = statusBadge(document);
          return (
            <div className="sub-surface space-y-2 p-3" key={document.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-black text-[#10252b]">
                  <FileSignature size={16} />
                  {document.label}
                  {document.versionNumber ? <span className="text-xs font-semibold text-[#667085]">v{document.versionNumber}</span> : null}
                </p>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              {document.signatures.length > 0 ? (
                <ul className="space-y-1 text-sm text-[#344054]">
                  {document.signatures.map((signature) => (
                    <li key={`${signature.role}-${signature.signedAt}`}>
                      <span className="font-bold">{signature.roleLabel}:</span> {signature.name} · {formatSignedAt(signature.signedAt)}
                    </li>
                  ))}
                </ul>
              ) : document.status === "finalised" ? (
                <p className="text-sm text-[#667085]">Finalised {document.finalisedAt ? formatSignedAt(document.finalisedAt) : ""}</p>
              ) : (
                <p className="text-sm text-[#667085]">Not signed yet.</p>
              )}
              {document.contentHash ? (
                <p className="break-all font-mono text-[11px] text-[#667085]" title="SHA-256 of the signed content">
                  SHA-256 {document.contentHash}
                </p>
              ) : null}
              {document.pdfUrl || document.certificateUrl ? (
                <div className="flex flex-wrap gap-2">
                  {document.pdfUrl ? (
                    <a className="secondary-action pressable inline-flex items-center gap-2" href={document.pdfUrl} rel="noreferrer" target="_blank">
                      <Download size={16} />
                      PDF
                    </a>
                  ) : null}
                  {document.certificateUrl ? (
                    <a className="secondary-action pressable inline-flex items-center gap-2" href={document.certificateUrl} rel="noreferrer" target="_blank">
                      <ShieldCheck size={16} />
                      Signing certificate
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
