"use client";

import { useActionState } from "react";
import { CheckCircle2, Download, FileText, RefreshCcw, Save } from "lucide-react";
import { generateRentalDocumentDraftPreview, type RentalDocumentPreviewState } from "@/app/actions/rental-document-preview";
import type { RentalDocumentTimelineEntry } from "@/lib/rental-documents";

const initialState: RentalDocumentPreviewState = { ok: false };

export function RentalDocumentPreviewPanel({ rentalId, timeline = [] }: { rentalId: string; timeline?: RentalDocumentTimelineEntry[] }) {
  const [state, formAction, isPending] = useActionState(generateRentalDocumentDraftPreview, initialState);

  return (
    <div className="rounded-lg border border-dashed border-[#f59e0b] bg-[#fffbeb] p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-wide text-[#b45309]">Experimental Rental Document Preview</p>
          <h2 className="mt-1 text-lg font-black text-[#10252b]">Rental agreement draft engine</h2>
          <p className="mt-1 max-w-2xl text-sm text-[#667085]">
            Legacy contracts, customer signing and public booking links remain authoritative. This preview is internal only and does not replace any existing contract.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={formAction}>
            <input type="hidden" name="rental_id" value={rentalId} />
            <input type="hidden" name="mode" value="preview" />
            <button className="secondary-action inline-flex items-center gap-2" disabled={isPending} type="submit">
              <RefreshCcw size={16} />
              {isPending ? "Refreshing..." : "Refresh preview"}
            </button>
          </form>
          <form action={formAction}>
            <input type="hidden" name="rental_id" value={rentalId} />
            <input type="hidden" name="mode" value="save_draft" />
            <button className="primary-action inline-flex items-center gap-2" disabled={isPending} type="submit">
              <Save size={16} />
              {isPending ? "Saving..." : "Save draft version"}
            </button>
          </form>
          {state.versionId ? (
            <>
              <form action={formAction}>
                <input type="hidden" name="version_id" value={state.versionId} />
                <input type="hidden" name="mode" value="generate_pdf" />
                <button className="secondary-action inline-flex items-center gap-2" disabled={isPending} type="submit">
                  <FileText size={16} />
                  {state.pdfGeneratedAt ? "Regenerate draft PDF" : "Generate draft PDF"}
                </button>
              </form>
              <form action={formAction}>
                <input type="hidden" name="version_id" value={state.versionId} />
                <input type="hidden" name="mode" value="download_pdf" />
                <button className="secondary-action inline-flex items-center gap-2" disabled={isPending || !state.pdfGeneratedAt} type="submit">
                  <Download size={16} />
                  Download draft PDF
                </button>
              </form>
            </>
          ) : (
            <button className="secondary-action inline-flex items-center gap-2 opacity-60" disabled type="button">
              <FileText size={16} />
              Generate draft PDF
            </button>
          )}
        </div>
      </div>

      {state.error ? (
        <div className="mt-3 rounded-md border border-[#fecaca] bg-white px-3 py-2 text-sm font-bold text-[#b91c1c]">{state.error}</div>
      ) : null}

      <div className="mt-4 rounded-md border border-[#fde68a] bg-white p-3">
        <p className="text-xs font-black uppercase text-[#b45309]">Rental Documents</p>
        <p className="mt-1 text-sm text-[#667085]">Experimental document engine. The existing contract remains authoritative.</p>
        {timeline.length ? (
          <div className="mt-3 space-y-2">
            {timeline.map((entry) => (
              <div className="rounded-md border border-[#e4e7ec] p-3 text-sm" key={entry.documentId}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-black text-[#10252b]">{entry.documentType.replace(/_/g, " ")}</p>
                  <span className="rounded-full bg-[#eef2f6] px-2 py-1 text-xs font-black uppercase text-[#475467]">{entry.documentStatus}</span>
                </div>
                <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                  <div>
                    <dt className="font-bold text-[#667085]">Created</dt>
                    <dd className="text-[#10252b]">{entry.createdAt}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#667085]">Current version</dt>
                    <dd className="text-[#10252b]">
                      {entry.currentVersion ? `#${entry.currentVersion.versionNumber} ${entry.currentVersion.status}` : "None"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#667085]">Template</dt>
                    <dd className="break-all text-[#10252b]">
                      {entry.currentVersion?.templateId || "Default"}{entry.currentVersion?.templateVersion ? ` v${entry.currentVersion.templateVersion}` : ""}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#667085]">Draft PDF</dt>
                    <dd className="text-[#10252b]">{entry.currentVersion?.draftPdfAvailable ? "Available" : "Not generated"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#667085]">Final PDF</dt>
                    <dd className="text-[#10252b]">{entry.currentVersion?.finalPdfAvailable ? "Available" : "Not generated"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#667085]">Legacy contract</dt>
                    <dd className="break-all text-[#10252b]">{entry.legacyContractId || "None linked"}</dd>
                  </div>
                  <div>
                    <dt className="font-bold text-[#667085]">Source event</dt>
                    <dd className="break-all text-[#10252b]">{entry.sourceEventType || "Not recorded"}</dd>
                  </div>
                </dl>
                {entry.currentVersion?.id ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={formAction}>
                      <input type="hidden" name="version_id" value={entry.currentVersion.id} />
                      <input type="hidden" name="mode" value="generate_pdf" />
                      <button className="secondary-action inline-flex items-center gap-2" disabled={isPending} type="submit">
                        <FileText size={16} />
                        {entry.currentVersion.pdfAvailable ? "Regenerate draft PDF" : "Generate draft PDF"}
                      </button>
                    </form>
                    <form action={formAction}>
                      <input type="hidden" name="version_id" value={entry.currentVersion.id} />
                      <input type="hidden" name="mode" value="download_pdf" />
                      <button className="secondary-action inline-flex items-center gap-2" disabled={isPending || !entry.currentVersion.pdfAvailable} type="submit">
                        <Download size={16} />
                        Download draft PDF
                      </button>
                    </form>
                    <form action={formAction}>
                      <input type="hidden" name="version_id" value={entry.currentVersion.id} />
                      <input type="hidden" name="mode" value="refresh_eligibility" />
                      <button className="secondary-action inline-flex items-center gap-2" disabled={isPending} type="submit">
                        <CheckCircle2 size={16} />
                        Refresh eligibility
                      </button>
                    </form>
                    {entry.currentVersion.status === "draft" ? (
                      <form action={formAction} className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-2">
                        <input type="hidden" name="version_id" value={entry.currentVersion.id} />
                        <input type="hidden" name="mode" value="finalise_version" />
                        <label className="flex max-w-xl items-start gap-2 text-xs font-bold text-[#92400e]">
                          <input className="mt-0.5" name="finalisation_confirmed" type="checkbox" value="true" />
                          <span>Finalising permanently freezes this document version. It cannot be edited or regenerated. This experimental document does not replace the existing authoritative contract.</span>
                        </label>
                        <button className="primary-action mt-2 inline-flex items-center gap-2" disabled={isPending} type="submit">
                          <CheckCircle2 size={16} />
                          Finalise and apply business signature
                        </button>
                      </form>
                    ) : null}
                    <form action={formAction}>
                      <input type="hidden" name="version_id" value={entry.currentVersion.id} />
                      <input type="hidden" name="mode" value="download_final_pdf" />
                      <button className="secondary-action inline-flex items-center gap-2" disabled={isPending || !entry.currentVersion.finalPdfAvailable} type="submit">
                        <Download size={16} />
                        Download final internal PDF
                      </button>
                    </form>
                  </div>
                ) : null}
                {entry.signatures.length ? (
                  <div className="mt-3 rounded-md bg-[#f8fafc] p-2 text-xs text-[#475467]">
                    {entry.signatures.map((signature) => (
                      <p key={`${signature.signerRole}-${signature.signedAt}`}>
                        {signature.signerRole.replace(/_/g, " ")}: {signature.signerName} at {signature.signedAt}
                      </p>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-[#667085]">No rental-document engine records yet.</p>
        )}
      </div>

      {state.ok ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="max-h-[720px] overflow-auto rounded-md border border-[#e4e7ec] bg-white p-4">
            <div className="routehq-contract-preview" dangerouslySetInnerHTML={{ __html: state.renderedHtml || "" }} />
          </div>
          <aside className="space-y-3">
            <div className="rounded-md border border-[#e4e7ec] bg-white p-3 text-sm">
              <p className="text-xs font-black uppercase text-[#667085]">Draft metadata</p>
              <dl className="mt-2 space-y-2">
                <div>
                  <dt className="font-bold text-[#667085]">Content hash</dt>
                  <dd className="break-all font-mono text-xs text-[#10252b]">{state.contentHash || "Not calculated"}</dd>
                </div>
                <div>
                  <dt className="font-bold text-[#667085]">Template</dt>
                  <dd className="break-all text-[#10252b]">{state.templateId || "Default"}{state.templateVersion ? ` v${state.templateVersion}` : ""}</dd>
                </div>
                {state.documentId && state.versionId ? (
                  <>
                    <div>
                      <dt className="font-bold text-[#667085]">Document</dt>
                      <dd className="break-all font-mono text-xs text-[#10252b]">{state.documentId}</dd>
                    </div>
                    <div>
                      <dt className="font-bold text-[#667085]">Version</dt>
                      <dd className="break-all font-mono text-xs text-[#10252b]">{state.versionId} #{state.versionNumber}</dd>
                    </div>
                  </>
                ) : null}
                <div>
                  <dt className="font-bold text-[#667085]">Draft PDF</dt>
                  <dd className="text-[#667085]">{state.pdfGeneratedAt ? `Generated ${state.pdfGeneratedAt}` : "Not generated"}</dd>
                </div>
              </dl>
              {state.signedPdfUrl ? (
                <a className="secondary-action mt-3 inline-flex items-center gap-2" href={state.signedPdfUrl} rel="noreferrer" target="_blank">
                  <Download size={16} />
                  Open signed URL
                </a>
              ) : null}
              {state.finalSignedPdfUrl ? (
                <a className="secondary-action mt-3 inline-flex items-center gap-2" href={state.finalSignedPdfUrl} rel="noreferrer" target="_blank">
                  <Download size={16} />
                  Open final signed URL
                </a>
              ) : null}
              <p className="mt-3 text-xs font-bold text-[#92400e]">Internal draft only - not signed and not customer-facing.</p>
            </div>
            {state.finalisationEligibility ? (
              <div className="rounded-md border border-[#e4e7ec] bg-white p-3 text-sm">
                <p className="text-xs font-black uppercase text-[#667085]">Finalisation eligibility</p>
                <p className={`mt-2 font-black ${state.finalisationEligibility.eligible ? "text-[#166534]" : "text-[#b91c1c]"}`}>
                  {state.finalisationEligibility.eligible ? "Eligible" : "Blocked"}
                </p>
                <dl className="mt-2 space-y-1 text-xs text-[#475467]">
                  <div>Version: {state.finalisationEligibility.existingVersionStatus}</div>
                  <div>Hash: {state.finalisationEligibility.contentHashMatches ? "matches" : "mismatch"}</div>
                  <div>Signatory: {state.finalisationEligibility.businessSignatoryName || "Missing"} {state.finalisationEligibility.businessSignatoryTitle ? `(${state.finalisationEligibility.businessSignatoryTitle})` : ""}</div>
                  <div>Signature authorisation: {state.finalisationEligibility.operatorSignatureAuthorisationStatus}</div>
                </dl>
                {state.finalisationEligibility.blockingIssues.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[#b91c1c]">
                    {state.finalisationEligibility.blockingIssues.map((issue) => (
                      <li key={issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
                {state.finalisationEligibility.warnings.length ? (
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-[#92400e]">
                    {state.finalisationEligibility.warnings.map((issue) => (
                      <li key={issue.code}>{issue.message}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
            <div className="rounded-md border border-[#fde68a] bg-[#fffbeb] p-3 text-sm">
              <p className="text-xs font-black uppercase text-[#b45309]">Warnings</p>
              {state.warnings?.length ? (
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[#92400e]">
                  {state.warnings.map((warning) => (
                    <li key={`${warning.variable}-${warning.message}`}>
                      <span className="font-black uppercase">{warning.severity}</span>: {warning.message}
                      {warning.blocksSigning ? " Blocks future signing." : ""}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[#667085]">No adapter warnings.</p>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
