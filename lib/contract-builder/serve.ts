import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildContract } from "./document";
import { renderContractDocx } from "./docx";
import { contractCountryFor, type ContractCountry, type ContractValues } from "./fields";
import { renderContractHtml } from "./html";
import { inspectLogo } from "./logo";

/** The two personalised files a contract-builder link can give. */
export const CONTRACT_FORMATS = ["contract-docx", "contract-print"] as const;
export type ContractFormat = (typeof CONTRACT_FORMATS)[number];

type Lead = { id: string; contract: ContractValues | null; contract_country: string | null; country: string | null; logo_path: string | null };

async function loadLead(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const db = createSupabaseAdminClient() as any;
  const { data } = await db.from("leads").select("id, contract, contract_country, country, logo_path").eq("id", id).maybeSingle();
  if (!data) return null;
  const lead = data as Lead;
  let logo: { data: Buffer; type: "png" | "jpg"; width: number; height: number; mime: string } | null = null;
  if (lead.logo_path) {
    const { data: file } = await db.storage.from("branding").download(lead.logo_path);
    if (file) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const info = inspectLogo(bytes);
      if (info) logo = { data: bytes, type: info.type, width: info.width, height: info.height, mime: info.mime };
    }
  }
  const country = (lead.contract_country as ContractCountry) || contractCountryFor(lead.country);
  return { lead, logo, country };
}

/** The personalised agreement for a lead, as a Word file or the print page. Null when the lead or agreement is gone. */
export async function contractFile(leadId: string, format: ContractFormat, words: { printLabel: string; printHint: string; lang: string }) {
  const found = await loadLead(leadId);
  if (!found) return null;
  const doc = buildContract(found.country, found.lead.contract || {});
  if (!doc) return null;
  const name = `rovehq-rental-agreement-${doc.country.toLowerCase()}`;
  if (format === "contract-docx") {
    const body = await renderContractDocx(doc, found.logo ? { data: found.logo.data, type: found.logo.type, width: found.logo.width, height: found.logo.height } : null);
    return { body, type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", fileName: `${name}.docx` };
  }
  const logo = found.logo ? `data:${found.logo.mime};base64,${found.logo.data.toString("base64")}` : null;
  return { body: renderContractHtml(doc, { logo, ...words }), type: "text/html; charset=utf-8", fileName: null };
}
