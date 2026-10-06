import { Download, FileSignature, ShieldCheck } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { intlLocale } from "@/lib/i18n/dates";

type Say = (key: string, values?: Record<string, string | number>) => string;
import { Badge, Fold } from "@/components/ui";
import type { BookingRentalDocument } from "@/lib/booking-rental-documents";

function formatSignedAt(value: string, locale: string) {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    hour12: false,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Bangkok"
  }).format(new Date(value));
}

function statusBadge(document: BookingRentalDocument, say: Say) {
  if (document.status === "signed") return { tone: "green" as const, label: say("docs_signed") };
  if (document.status === "finalised") return { tone: "green" as const, label: say("docs_final") };
  if (document.status === "partially_signed") return { tone: "blue" as const, label: say("docs_partly") };
  if (document.status === "void") return { tone: "neutral" as const, label: say("docs_void") };
  return { tone: "amber" as const, label: say("docs_awaiting") };
}

export function RentalDocumentsCard({ documents }: { documents: BookingRentalDocument[] }) {
  const hasAgreement = documents.some((document) => document.type === "rental_agreement");
  const say = useTranslations("booking") as unknown as Say;
  const locale = useLocale();

  return (
    <Fold
      summary={documents.length === 0 ? say("nothingYet") : say("docs_count", { count: documents.length })}
      title={say("docs_title")}
    >
      <div className="space-y-3">
        {!hasAgreement ? (
          <p className="empty-state text-sm">{say("docs_prepared")}</p>
        ) : null}
        {documents.map((document) => {
          const badge = statusBadge(document, say);
          return (
            <div className="sub-surface space-y-2 p-3" key={document.id}>
              <div className="flex items-center justify-between gap-3">
                <p className="flex items-center gap-2 font-semibold text-[var(--foreground)]">
                  <FileSignature size={16} />
                  {document.label}
                  {document.versionNumber ? <span className="text-xs font-semibold text-[var(--muted)]">v{document.versionNumber}</span> : null}
                </p>
                <Badge tone={badge.tone}>{badge.label}</Badge>
              </div>
              {document.signatures.length > 0 ? (
                <ul className="space-y-1 text-sm text-[var(--foreground-secondary)]">
                  {document.signatures.map((signature) => (
                    <li key={`${signature.role}-${signature.signedAt}`}>
                      <span className="font-bold">{signature.roleLabel}:</span> {signature.name} · {formatSignedAt(signature.signedAt, locale)}
                    </li>
                  ))}
                </ul>
              ) : document.status === "finalised" ? (
                <p className="text-sm text-[var(--muted)]">{say("docs_finalised", { when: document.finalisedAt ? formatSignedAt(document.finalisedAt, locale) : "" })}</p>
              ) : (
                <p className="text-sm text-[var(--muted)]">{say("docs_notSigned")}</p>
              )}
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
                      {say("docs_certificate")}
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Fold>
  );
}
