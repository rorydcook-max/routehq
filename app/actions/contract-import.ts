"use server";

import { friendlyReason, guard } from "@/lib/action-error";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/roles";
import { NotAnAgreementError, checkThaiEssentials, readDocxText, readImportedAgreement } from "@/lib/contract-import";
import {
  DOCX_TYPE,
  IMPORT_MAX_PAGES,
  UPLOADED_TEMPLATE_KEY,
  buildUploadedTemplateHtml,
  isImportVariable,
  styleOf,
  tidyImportedAgreement,
  type ImportedAgreement,
  type UploadedTemplateMeta
} from "@/lib/contract-import-template";
import { defaultRentalContractTemplate } from "@/lib/default-contract-template";
import type { PreparedUploads, UploadRequest } from "@/lib/direct-uploads";
import { said } from "@/lib/i18n/server-text";
import { SUPPORT_BUCKET } from "@/lib/support-shared";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * "Use your own agreement" (Settings › Rental agreement). Owner only.
 *
 * The original files are kept in the private support-files bucket, under the business's folder: that bucket takes
 * Word files (the documents bucket only allows PDFs, photos and videos), and a contract someone sends in the chat
 * widget is already there, so both ways in work the same.
 */

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const MAX_FILE_MB = 20;
// The vision models read these; HEIC is turned into JPEG in the browser before upload (lib/direct-upload-client.ts).
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function importPrefix(organizationId: string) {
  return `${organizationId}/contract-imports`;
}

function cleanName(name: string) {
  return String(name || "agreement").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "agreement";
}

function errorText(error: unknown) {
  return friendlyReason(error instanceof Error ? error.message : String(error || "")) || "That didn't work. Try again.";
}

/** Signed upload links for the agreement's files: straight from the phone to storage (Vercel caps a request at 4.5 MB). */
/** Hands a failure back as `{ actionError }` (lib/action-error.ts), so the screen can say why instead of "Try again". */
export async function prepareContractImportUploads(...args: Parameters<typeof prepareContractImportUploadsOrThrow>) {
  return guard(() => prepareContractImportUploadsOrThrow(...args));
}

async function prepareContractImportUploadsOrThrow(files: UploadRequest[]): Promise<PreparedUploads> {
  const membership = await requireOwner();
  if (!Array.isArray(files) || !files.length) return { uploads: [], error: await said("Choose a file first.") };
  if (files.length > IMPORT_MAX_PAGES) return { uploads: [], error: await said(`Send up to ${IMPORT_MAX_PAGES} photos at a time.`) };
  const admin = createSupabaseAdminClient() as any;
  const batch = crypto.randomUUID();
  const uploads = [];
  for (const [index, file] of files.entries()) {
    const type = String(file.type || "");
    if (type !== "application/pdf" && type !== DOCX_TYPE && !type.startsWith("image/")) {
      return { uploads: [], error: await said(`${file.name || "A file"} is not a PDF, Word file or photo.`) };
    }
    if (!(file.size > 0)) return { uploads: [], error: await said(`${file.name || "A file"} is empty.`) };
    if (file.size > MAX_FILE_MB * 1024 * 1024) return { uploads: [], error: await said(`${file.name || "A file"} is larger than ${MAX_FILE_MB} MB.`) };
    const path = `${importPrefix(membership.organizationId)}/${batch}/${index}-${cleanName(file.name)}`;
    const { data, error } = await admin.storage.from(SUPPORT_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return { uploads: [], error: error?.message || (await said("Could not prepare the upload.")) };
    uploads.push({ field: file.field || "file", path, token: data.token as string });
  }
  return { uploads };
}

type StoredFile = { path: string; name: string; type: string; bytes: Buffer };

/** Fetches a file from the support bucket, only from this business's own folder. */
async function fetchOwnFile(organizationId: string, path: string, name?: string, type?: string): Promise<StoredFile | null> {
  if (!path.startsWith(`${organizationId}/`) || path.includes("..")) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data, error } = await admin.storage.from(SUPPORT_BUCKET).download(path);
  if (error || !data) return null;
  const fileName = name || path.slice(path.lastIndexOf("/") + 1);
  // Storage may not know a Word file's type; the name says it.
  const guessed = /\.docx$/i.test(fileName) ? DOCX_TYPE : /\.pdf$/i.test(fileName) ? "application/pdf" : /\.png$/i.test(fileName) ? "image/png" : /\.webp$/i.test(fileName) ? "image/webp" : /\.jpe?g$/i.test(fileName) ? "image/jpeg" : "";
  const storedType = String(data.type || "");
  const fileType = storedType && storedType !== "application/octet-stream" ? storedType : type || guessed;
  return { path, name: fileName, type: fileType || guessed, bytes: Buffer.from(await data.arrayBuffer()) };
}

/** The current next version number for this business's uploaded agreements (the table keeps each version unique). */
async function nextVersion(supabase: any, organizationId: string) {
  const { data } = await supabase
    .from("contract_templates")
    .select("version")
    .eq("organization_id", organizationId)
    .eq("template_key", UPLOADED_TEMPLATE_KEY)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  return Number(data?.version || 0) + 1;
}

function localeOf(doc: ImportedAgreement) {
  return (doc.languages[0] || "en").slice(0, 5);
}

/** Read the files, build the template and save it as a draft (not used for bookings until the owner says so). */
async function importFiles(organizationId: string, files: StoredFile[], fromChat: boolean): Promise<Result<{ id: string }>> {
  if (!files.length) return { ok: false, error: await said("The file could not be found. Please upload it again.") };
  const docx = files.filter((file) => file.type === DOCX_TYPE || /\.docx$/i.test(file.name));
  const pdfs = files.filter((file) => file.type === "application/pdf");
  const images = files.filter((file) => file.type.startsWith("image/"));
  if (images.some((file) => !IMAGE_TYPES.includes(file.type))) return { ok: false, error: await said("Please send the photos as JPG or PNG.") };
  if ((docx.length && files.length > 1) || (pdfs.length && files.length > 1)) {
    return { ok: false, error: await said("Send one PDF or one Word file, or up to 10 photos of the pages.") };
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const { data: organization } = await supabase.from("organizations").select("id, country_code").eq("id", organizationId).maybeSingle();

  let doc: ImportedAgreement;
  let extractedText = "";
  try {
    if (docx.length) {
      extractedText = readDocxText(docx[0].bytes);
      if (!extractedText) return { ok: false, error: await said("That Word file has no text we can read. Try a PDF or photos instead.") };
      doc = await readImportedAgreement({ text: extractedText });
    } else if (pdfs.length) {
      doc = await readImportedAgreement({ pdf: pdfs[0].bytes });
    } else {
      doc = await readImportedAgreement({ images: images.slice(0, IMPORT_MAX_PAGES).map((file) => ({ bytes: file.bytes, type: file.type })) });
    }
  } catch (error) {
    console.error("[contract-import] read:", errorText(error));
    if (error instanceof NotAnAgreementError) return { ok: false, error: await said("That doesn't look like a rental agreement. Upload the contract itself.") };
    return { ok: false, error: await said("We couldn't read that agreement. Try a clearer copy, or a PDF or Word file.") };
  }

  // The booking details grid is added when the owner's own blanks don't already name the renter and the vehicle.
  const mapped = new Set(doc.fields.map((field) => field.variable));
  const includeDetails = !(mapped.has("renter_full_name") && (mapped.has("vehicle_registration") || mapped.has("vehicle_model")));
  const thCheck = String(organization?.country_code || "").toUpperCase() === "TH" ? await checkThaiEssentials(doc).catch(() => null) : null;

  const meta: UploadedTemplateMeta = {
    kind: "uploaded_agreement",
    source: {
      bucket: SUPPORT_BUCKET,
      paths: files.map((file) => file.path),
      names: files.map((file) => file.name),
      type: docx.length ? "docx" : pdfs.length ? "pdf" : "images",
      ...(fromChat ? { from_chat: true } : {})
    },
    doc,
    include_details: includeDetails,
    ...(extractedText ? { extracted_text: extractedText.slice(0, 100_000) } : {}),
    th_check: thCheck
  };
  const html = buildUploadedTemplateHtml(doc, { styleCss: styleOf(defaultRentalContractTemplate), includeDetails });

  const { data, error } = await supabase
    .from("contract_templates")
    .insert({
      organization_id: organizationId,
      template_type: "contract",
      template_key: UPLOADED_TEMPLATE_KEY,
      locale: localeOf(doc),
      language: localeOf(doc),
      version: await nextVersion(supabase, organizationId),
      title: doc.title,
      name: doc.title,
      body: html,
      content_html: html,
      variables: meta,
      jurisdiction: organization?.country_code || null,
      // A draft until the owner taps "Use this agreement for new bookings".
      is_default: false,
      is_active: false
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, error: error?.message || (await said("The agreement could not be saved.")) };
  revalidatePath("/settings/contracts");
  return { ok: true, id: data.id as string };
}

/** After the browser uploaded the files (prepareContractImportUploads): read them and make the draft. */
export async function startContractImport(formData: FormData): Promise<Result<{ id: string }>> {
  try {
    const membership = await requireOwner();
    let parsed: unknown;
    try {
      parsed = JSON.parse(String(formData.get("uploadedFiles") || "[]"));
    } catch {
      parsed = [];
    }
    const entries = (Array.isArray(parsed) ? parsed : []).slice(0, IMPORT_MAX_PAGES);
    const prefix = `${importPrefix(membership.organizationId)}/`;
    const files = (
      await Promise.all(
        entries.map((entry: any) => {
          const path = String(entry?.path || "");
          // Only files this business just uploaded through prepareContractImportUploads.
          return path.startsWith(prefix) ? fetchOwnFile(membership.organizationId, path, String(entry?.name || ""), String(entry?.type || "")) : null;
        })
      )
    ).filter(Boolean) as StoredFile[];
    return await importFiles(membership.organizationId, files, false);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** A contract the owner sent in the chat widget (?file=<path in the support bucket>): read it the same way. */
export async function importContractFromChat(path: string): Promise<Result<{ id: string }>> {
  try {
    const membership = await requireOwner();
    const file = await fetchOwnFile(membership.organizationId, String(path || ""));
    if (!file) return { ok: false, error: await said("The file from the chat could not be found. Please upload it here instead.") };
    return await importFiles(membership.organizationId, [file], true);
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

async function loadOwnUploaded(supabase: any, organizationId: string, id: string) {
  const { data } = await supabase
    .from("contract_templates")
    .select("*")
    .eq("id", id)
    .eq("organization_id", organizationId)
    .eq("template_key", UPLOADED_TEMPLATE_KEY)
    .maybeSingle();
  return data && data.variables?.kind === "uploaded_agreement" ? data : null;
}

/**
 * Save the owner's edits (clause text, which booking detail each blank gets). The HTML is rebuilt here from the
 * structure, never taken from the browser. Signed agreements keep their own rendered copy (rental document versions
 * store the HTML and a hash), so editing this never changes anything already signed; the version number is moved on
 * so new agreements record which wording they used.
 */
export async function saveImportedAgreement(id: string, rawDoc: unknown, includeDetails: boolean): Promise<Result> {
  try {
    const membership = await requireOwner();
    const supabase = (await createSupabaseServerClient()) as any;
    const row = await loadOwnUploaded(supabase, membership.organizationId, id);
    if (!row) return { ok: false, error: await said("That agreement was not found.") };
    const doc = tidyImportedAgreement(rawDoc);
    doc.fields = doc.fields.map((field) => ({ ...field, variable: isImportVariable(field.variable) || field.variable.startsWith("custom:") ? field.variable : "" }));
    if (!doc.sections.length) return { ok: false, error: await said("The agreement needs at least one clause.") };
    const meta: UploadedTemplateMeta = { ...(row.variables as UploadedTemplateMeta), doc, include_details: Boolean(includeDetails) };
    const html = buildUploadedTemplateHtml(doc, { styleCss: styleOf(defaultRentalContractTemplate), includeDetails: Boolean(includeDetails) });
    const { error } = await supabase
      .from("contract_templates")
      .update({ title: doc.title, name: doc.title, body: html, content_html: html, variables: meta, version: await nextVersion(supabase, membership.organizationId) })
      .eq("id", id)
      .eq("organization_id", membership.organizationId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/contracts");
    revalidatePath(`/settings/contracts/import/${id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** Run the Thailand check again (after the owner added clauses). */
export async function recheckImportedAgreement(id: string): Promise<Result<{ check: UploadedTemplateMeta["th_check"] }>> {
  try {
    const membership = await requireOwner();
    const supabase = (await createSupabaseServerClient()) as any;
    const row = await loadOwnUploaded(supabase, membership.organizationId, id);
    if (!row) return { ok: false, error: await said("That agreement was not found.") };
    const meta = row.variables as UploadedTemplateMeta;
    const check = await checkThaiEssentials(meta.doc);
    const { error } = await supabase
      .from("contract_templates")
      .update({ variables: { ...meta, th_check: check } })
      .eq("id", id)
      .eq("organization_id", membership.organizationId);
    if (error) return { ok: false, error: error.message };
    return { ok: true, check };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/**
 * "Use this agreement for new bookings". The choice is organizations.default_contract_template_id, which
 * ensureDefaultContractTemplate (lib/contracts.ts) checks first; the RoveHQ row is left as it is, so going back is
 * just clearing the choice. Bookings already signed keep the agreement they signed; unsigned drafts are drawn up
 * again with the new wording the next time they are opened (the business changed after they were drafted).
 */
export async function chooseImportedAgreement(id: string): Promise<Result> {
  try {
    const membership = await requireOwner();
    const supabase = (await createSupabaseServerClient()) as any;
    const row = await loadOwnUploaded(supabase, membership.organizationId, id);
    if (!row) return { ok: false, error: await said("That agreement was not found.") };
    // Only one uploaded agreement is live at a time.
    await supabase
      .from("contract_templates")
      .update({ is_active: false })
      .eq("organization_id", membership.organizationId)
      .eq("template_key", UPLOADED_TEMPLATE_KEY)
      .neq("id", id);
    const { error: activeError } = await supabase.from("contract_templates").update({ is_active: true }).eq("id", id).eq("organization_id", membership.organizationId);
    if (activeError) return { ok: false, error: activeError.message };
    const { error } = await supabase.from("organizations").update({ default_contract_template_id: id }).eq("id", membership.organizationId);
    if (error) return { ok: false, error: error.message };
    revalidatePath("/settings/contracts");
    revalidatePath(`/settings/contracts/import/${id}`);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}

/** "Go back to the RoveHQ agreement": new bookings use the platform agreement again. The upload is kept as a draft. */
export async function chooseRoveAgreement(): Promise<Result> {
  try {
    const membership = await requireOwner();
    const supabase = (await createSupabaseServerClient()) as any;
    const { error } = await supabase.from("organizations").update({ default_contract_template_id: null }).eq("id", membership.organizationId);
    if (error) return { ok: false, error: error.message };
    await supabase.from("contract_templates").update({ is_active: false }).eq("organization_id", membership.organizationId).eq("template_key", UPLOADED_TEMPLATE_KEY);
    revalidatePath("/settings/contracts");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
}
