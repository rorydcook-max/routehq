"use server";

import { getLocale, getTranslations } from "next-intl/server";
import { isEmailConfigured, sendEmail } from "@/lib/email";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { fileSize, LEAD_COUNTRIES, LEAD_FLEETS, type LeadDownload, type LeadState } from "@/lib/leads";
import { getResource, isContentSlug, resourceFiles, resourceLocales } from "@/lib/site/content";
import { createDownloadToken, downloadHref } from "@/lib/site/download-token";
import { EMAIL_PATTERN, formText, requestIpHash } from "@/lib/site/request-hash";
import { siteOrigin } from "@/lib/site/seo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { alertTeam } from "@/lib/support";
import { contractCountryFor, isContractBuilder, hasContractDetails, parseContractForm } from "@/lib/contract-builder/fields";
import { inspectLogo, LOGO_MAX_BYTES } from "@/lib/contract-builder/logo";

/**
 * The free-resource form (/resources/<slug>). Saved with the service role (leads has no insert policy), then the
 * download links are shown straight away, emailed too when email sending is set up, and the team is alerted.
 * A filled-in honeypot pretends to succeed and saves nothing; more than ten requests an hour from one address are
 * turned away. The address is kept only as a salted hash (lib/site/request-hash.ts, shared with the contact form).
 *
 * The rental agreement is the contract builder (Rory, 28 Oct 2026): whatever the operator typed into its optional
 * fields (business, logo, vehicle, prices, rules) is kept with the lead, and the links build their own agreement in
 * English and their country's language: a Word file and a print page that saves as PDF.
 */

const LIMITS = { email: 200, name: 120, business: 120, source: 300 } as const;
const PER_HOUR = 10;
const LANGUAGE_NAME = new Map(supportedLocaleOptions.map((option) => [option.code as string, option.label.replace(/ \(.*\)$/, "")]));

export async function requestLead(previous: LeadState, formData: FormData): Promise<LeadState> {
  const n = (previous?.n || 0) + 1;
  const values = {
    email: formText(formData, "email", LIMITS.email),
    name: formText(formData, "name", LIMITS.name),
    business: formText(formData, "business", LIMITS.business),
    country: String(formData.get("country") || ""),
    fleet: String(formData.get("fleet") || ""),
    consent: formData.get("consent") === "on"
  };
  const slug = String(formData.get("resource") || "");
  // A bot filled the field people never see: say thanks, keep nothing, give nothing.
  if (String(formData.get("website") || "").trim()) return { n, status: "sent", downloads: [], emailed: false };
  if (!values.email) return { n, status: "error", error: "required", values };
  if (!EMAIL_PATTERN.test(values.email)) return { n, status: "error", error: "email", values };
  if (!isContentSlug(slug) || !resourceLocales(slug).length) return { n, status: "error", error: "failed", values };
  const builder = isContractBuilder(slug);
  const country = (LEAD_COUNTRIES as readonly string[]).includes(values.country) || values.country === "other" ? values.country : null;
  const fleet = (LEAD_FLEETS as readonly string[]).includes(values.fleet) ? values.fleet : null;
  const source = formText(formData, "source", LIMITS.source);

  try {
    const [m, locale] = await Promise.all([getTranslations("marketing"), getLocale()]);
    const files = builder ? [] : resourceFiles(slug);
    if (!builder && !files.length) return { n, status: "error", error: "failed", values };

    const db = createSupabaseAdminClient() as any;
    const hash = await requestIpHash();
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await db.from("leads").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since);
    if ((count || 0) >= PER_HOUR) return { n, status: "error", error: "tooMany", values };
    const { data, error } = await db
      .from("leads")
      .insert({
        email: values.email,
        name: values.name || null,
        business: values.business || null,
        country,
        fleet,
        resource: slug,
        locale,
        consent: values.consent,
        ip_hash: hash,
        source_path: source.startsWith("/") ? source : null
      })
      .select("id")
      .single();
    if (error || !data) return { n, status: "error", error: "failed", values };

    const downloads: LeadDownload[] = [];
    if (builder) {
      // Their agreement: the country version from the country they chose, their details, and their logo if they sent one.
      const contract = parseContractForm(formData);
      if (!contract.business_name && values.business) contract.business_name = values.business;
      const contractCountry = contractCountryFor(country);
      let logoPath: string | null = null;
      const upload = formData.get("c_logo");
      if (upload && typeof upload === "object" && "arrayBuffer" in upload && upload.size > 0 && upload.size <= LOGO_MAX_BYTES) {
        const bytes = Buffer.from(await upload.arrayBuffer());
        const info = inspectLogo(bytes);
        if (info) {
          const path = `leads/${data.id}/logo.${info.ext}`;
          const { error: uploadError } = await db.storage.from("branding").upload(path, bytes, { contentType: info.mime, upsert: true });
          if (!uploadError) logoPath = path;
        }
      }
      await db.from("leads").update({ contract: hasContractDetails(contract) ? contract : null, contract_country: contractCountry, logo_path: logoPath }).eq("id", data.id);
      for (const [format, label, detail] of [
        ["contract-docx", m("contractDocx"), m("contractDocxDetail")],
        ["contract-print", m("contractPrint"), m("contractPrintDetail")]
      ] as const) {
        const token = createDownloadToken({ slug, locale, format, lead: data.id });
        if (!token) return { n, status: "error", error: "failed", values };
        downloads.push({ href: downloadHref(slug, token), label, detail, primary: downloads.length === 0, open: format === "contract-print" });
      }
    }

    // One link per file: the visitor's language first, then English, then the rest; Word before PDF.
    const rank = (code: string) => (code === locale ? 0 : code === "en" ? 1 : 2);
    const sorted = [...files].sort((a, b) => rank(a.locale) - rank(b.locale) || (LANGUAGE_NAME.get(a.locale) || a.locale).localeCompare(LANGUAGE_NAME.get(b.locale) || b.locale) || a.format.localeCompare(b.format));
    for (const file of sorted) {
      const token = createDownloadToken({ slug, locale: file.locale, format: file.format });
      if (!token) return { n, status: "error", error: "failed", values };
      downloads.push({
        href: downloadHref(slug, token),
        label: file.format === "docx" ? m("downloadDocx") : file.format === "xlsx" ? m("downloadXlsx") : m("downloadPdf"),
        detail: `${LANGUAGE_NAME.get(file.locale) || file.locale} · ${fileSize(file.bytes)}`,
        primary: downloads.length === 0
      });
    }

    const resource = getResource(locale, slug) || getResource("en", slug);
    let emailed = false;
    if (isEmailConfigured()) {
      const links = downloads.map((item) => `${item.label} (${item.detail}):\n${siteOrigin()}${item.href}`).join("\n\n");
      const result = await sendEmail({
        to: values.email,
        subject: m("leadEmailSubject", { title: resource?.title || slug }),
        text: m("leadEmailBody", { name: values.name ? ` ${values.name}` : "", links, disclaimer: m("disclaimer") }),
        metadata: { kind: "lead", resource: slug }
      });
      emailed = result.status === "sent";
    }

    await alertTeam(
      `New download: ${values.email}${values.business ? ` (${values.business})` : ""} · ${slug}${country ? ` · ${country}` : ""}${fleet ? ` · ${fleet}` : ""}${values.consent ? " · tips OK" : ""}`,
      `lead-${data.id}`,
      "/platform/leads"
    );
    return { n, status: "sent", downloads, emailed };
  } catch {
    return { n, status: "error", error: "failed", values };
  }
}
