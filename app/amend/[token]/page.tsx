import type { Metadata } from "next";
import { AlertTriangle, CheckCircle2, FileText } from "lucide-react";
import { loadPublicAmendment } from "@/lib/public-amendment";
import { AmendmentSignForm } from "./amendment-sign-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Amendment to your rental", robots: { index: false, follow: false } };

function contactHref(phone: string | null) {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits.startsWith("0") ? `66${digits.slice(1)}` : digits}`;
}

function Message({ tone, title, children }: { tone: "red" | "green"; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#eef7f5] px-4 py-8 text-[#10252b]">
      <section className="mx-auto max-w-xl rounded-2xl border border-[#d6e5e2] bg-white p-6 text-center shadow-sm">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${tone === "red" ? "bg-[#ffe4e6] text-[#be123c]" : "bg-[#f0fdf4] text-[#16a34a]"}`}>
          {tone === "red" ? <AlertTriangle /> : <CheckCircle2 />}
        </div>
        <h1 className="mt-4 text-2xl font-black">{title}</h1>
        <div className="mt-2 text-sm leading-6 text-[#667085]">{children}</div>
      </section>
    </main>
  );
}

export default async function AmendmentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const amendment = await loadPublicAmendment(token);

  if (amendment.state === "not_found") {
    return <Message title="Link not found" tone="red">Please check the link or contact the rental business.</Message>;
  }
  const contact = contactHref(amendment.contactPhone);
  const contactLink = contact ? (
    <a className="pressable mt-5 inline-flex rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white" href={contact}>
      Contact {amendment.businessName}
    </a>
  ) : null;

  if (amendment.state === "cancelled") {
    return (
      <Message title="This amendment was withdrawn" tone="red">
        <p>{amendment.businessName} cancelled this change to your rental. Nothing has changed.</p>
        {contactLink}
      </Message>
    );
  }
  if (amendment.state === "expired") {
    return (
      <Message title="This link has expired" tone="red">
        <p>Please ask {amendment.businessName} for a new link.</p>
        {contactLink}
      </Message>
    );
  }
  if (amendment.state === "signed") {
    return (
      <Message title="Amendment signed" tone="green">
        <p>
          Thank you{amendment.signerName ? `, ${amendment.signerName}` : ""}. The changes to your rental are confirmed and {amendment.businessName} has been told.
        </p>
        {amendment.pdfUrl ? (
          <a className="pressable mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0f766e] px-5 py-3 text-sm font-black text-white" href={amendment.pdfUrl} rel="noreferrer" target="_blank">
            <FileText size={16} /> Download signed amendment
          </a>
        ) : null}
      </Message>
    );
  }

  return (
    <main className="min-h-screen bg-[#eef7f5] px-4 py-5 text-[#10252b]">
      <div className="mx-auto max-w-2xl space-y-4">
        <header className="rounded-2xl border border-[#d6e5e2] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase text-[#0f766e]">{amendment.businessName}</p>
          <h1 className="mt-1 text-2xl font-black">Changes to your rental</h1>
          <p className="mt-1 text-sm font-bold text-[#667085]">{amendment.vehicleLabel}</p>
          <div className="mt-4 space-y-2">
            {amendment.rows.map((row) => (
              <div className="rounded-xl border border-[#d6e5e2] bg-[#fbfefd] p-3" key={row.label}>
                <p className="text-xs font-black uppercase text-[#667085]">{row.label}</p>
                <p className="mt-1 text-sm">
                  {row.before !== "-" ? <span className="text-[#667085] line-through">{row.before}</span> : null}
                  {row.before !== "-" ? <span className="mx-2 text-[#667085]">→</span> : null}
                  <span className="font-black text-[#0f766e]">{row.after}</span>
                </p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-[#667085]">Everything else in your rental agreement stays the same.</p>
        </header>

        <section className="rounded-2xl border border-[#d6e5e2] bg-white p-3 shadow-sm">
          <iframe className="h-[420px] w-full rounded-xl border border-[#e5eeec] bg-white" sandbox="" srcDoc={amendment.html} title="Amendment" />
          <p className="mt-2 px-1 text-[11px] text-[#667085]">Document fingerprint {amendment.contentHashFragment}</p>
        </section>

        <AmendmentSignForm contentHash={amendment.contentHash} renterName={amendment.renterName} token={amendment.token} />
      </div>
    </main>
  );
}
