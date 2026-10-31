import { said } from "@/lib/i18n/server-text";
import { aiTextConfigured } from "@/lib/ai-chat";
import { NextResponse } from "next/server";
import { getCurrentMembership } from "@/lib/auth/roles";
import { normaliseAnalysis, type Analysis } from "@/lib/import/analysis";
import { categorizeCostsWithAi, mapColumnsWithAi } from "@/lib/import/ai-assist";
import { applyCostLearnings, emptyLearnings, loadLearnings } from "@/lib/import/learnings";
import { googleSheetToSpreadsheetInput, isGoogleSheetsUrl, parseSpreadsheetFile, type ParsedSheet } from "@/lib/import/spreadsheet";
import { attachExisting, buildPreview, previewCounts } from "@/lib/import/preview";
import { existingRentals } from "@/lib/import/existing";
import { getDefaultOrganization } from "@/lib/organization";
import { MAX_IMPORT_PHOTOS, photoSheetKinds, readImportPhotos } from "@/lib/import/photos";
import { visionProvider } from "@/lib/ai-vision";
import { canReadChat, chatSheetKinds, isChatFile, readChatText } from "@/lib/import/chat-text";
import { calendarToSheets, fetchCalendar, isCalendarFile, isCalendarUrl, parseIcs } from "@/lib/import/calendar";

// Reading several photos takes a while.
export const maxDuration = 120;
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Turns the mapping into the cards the owner will see, matched against what the
 * business already has, and keeps everything on a batch so the import can be
 * confirmed later without the file, and undone afterwards.
 */
async function previewAndBatch(sheets: ParsedSheet[], analysis: Analysis, sourceName: string, userId: string) {
  const supabase = (await createSupabaseServerClient()) as any;
  const organization = await getDefaultOrganization();
  const [{ data: vehicles }, { data: customers }] = await Promise.all([
    supabase.from("vehicles").select("id, registration_number, make, model").eq("organization_id", organization.id).is("deleted_at", null),
    supabase.from("customers").select("id, full_name, phone").eq("organization_id", organization.id).is("deleted_at", null)
  ]);
  const preview = attachExisting(buildPreview(sheets, analysis.sheets), vehicles || [], customers || [], await existingRentals(supabase, organization.id));
  // Costs described the way this owner has corrected before take their choice; the rest the rules couldn't place get
  // a second opinion from the AI (any language). The rules' answer stands otherwise.
  applyCostLearnings(preview, await loadLearnings(supabase, organization.id).catch(() => emptyLearnings()));
  await categorizeCostsWithAi(preview).catch(() => 0);
  const { data: batch } = await supabase
    .from("import_batches")
    .insert({ organization_id: organization.id, created_by: userId, source_name: sourceName.slice(0, 120), sheets, mappings: analysis.sheets, preview, counts: previewCounts(preview) })
    .select("id")
    .single();
  const fleet = ((vehicles || []) as any[]).map((vehicle) => ({ id: vehicle.id as string, label: `${vehicle.make || ""} ${vehicle.model || ""} ${vehicle.registration_number || ""}`.replace(/\s+/g, " ").trim() }));
  return { batchId: batch?.id || null, preview, counts: previewCounts(preview), fleet };
}

export async function POST(request: Request) {
  // Importing creates vehicles, customers and money records for the whole business.
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: await said("Please sign in first.") }, { status: 401 });
  if (membership.role !== "owner") return NextResponse.json({ error: await said("Only the business owner can import data.") }, { status: 403 });

  const formData = await request.formData();
  const file = formData.get("file");

  // Photos of registration books, notebook pages and lists: read into RoveHQ's own fields.
  const photos = formData.getAll("photo").filter((item): item is File => item instanceof File && item.size > 0 && item.type.startsWith("image/"));
  if (photos.length) {
    if (!visionProvider()) return NextResponse.json({ error: await said("Reading photos isn't switched on yet. Send them to us in Help and we'll bring them in.") }, { status: 400 });
    if (photos.length > MAX_IMPORT_PHOTOS) return NextResponse.json({ error: await said(`Send up to ${MAX_IMPORT_PHOTOS} photos at a time.`) }, { status: 400 });
    const { sheets, readings } = await readImportPhotos(await Promise.all(photos.map(async (photo) => ({ bytes: Buffer.from(await photo.arrayBuffer()), mediaType: photo.type, name: photo.name }))));
    if (!sheets.length) return NextResponse.json({ error: await said("We couldn't find vehicles, bookings or payments in these photos. Try a sharper photo in good light, or send them to us in Help."), readings }, { status: 400 });
    const kinds = photoSheetKinds();
    const analysis = normaliseAnalysis({ sheets: sheets.map((sheet) => ({ sheet_name: sheet.sheetName, primary_data_type: kinds[sheet.sheetName], confidence: 0.9, column_mappings: sheet.headers.map((header) => ({ source_column: header, routehq_field: header, confidence: 0.9 })) })) }, sheets);
    const skipped = readings.filter((reading) => reading.kind === "other" || reading.kind === "unreadable").map((reading) => reading.name);
    return NextResponse.json({
      analysis,
      readings,
      ...(await previewAndBatch(sheets, analysis, `${photos.length} photo${photos.length === 1 ? "" : "s"}`, membership.userId)),
      warning: skipped.length ? await said(`Nothing to bring in was found on: ${skipped.join(", ")}.`) : await said("Read from photos: check each card, especially names, plates and amounts.")
    });
  }
  // Messages from a LINE or WhatsApp chat, pasted in or as the chat's exported .txt file.
  const chatText = String(formData.get("chatText") || "").trim();
  const chatFile = file instanceof File && file.size > 0 && isChatFile(file.name, file.type);
  if (chatText || chatFile) {
    if (!canReadChat()) return NextResponse.json({ error: await said("Reading messages isn't switched on yet. Send them to us in Help and we'll bring them in.") }, { status: 400 });
    const read = await readChatText(chatText || (await (file as File).text()));
    if (!read.sheets.length) return NextResponse.json({ error: await said("We couldn't find vehicles, bookings, customers or payments in these messages. Paste the messages that list them, or send them to us in Help.") }, { status: 400 });
    const kinds = chatSheetKinds();
    const analysis = normaliseAnalysis({ sheets: read.sheets.map((sheet) => ({ sheet_name: sheet.sheetName, primary_data_type: kinds[sheet.sheetName], confidence: 0.9, column_mappings: sheet.headers.map((header) => ({ source_column: header, routehq_field: header, confidence: 0.9 })) })) }, read.sheets);
    return NextResponse.json({
      analysis,
      ...(await previewAndBatch(read.sheets, analysis, chatFile ? (file as File).name : "Pasted messages", membership.userId)),
      warning: read.trimmed
        ? await said("This chat is long, so only its most recent messages were read. Check each card, especially names, dates and amounts.")
        : await said("Read from messages: check each card, especially names, dates and amounts.")
    });
  }

  const sheetUrl = String(formData.get("sheetUrl") || "").trim();
  const importType = String(formData.get("importType") || "mixed");

  // A calendar where each booking is an event: an .ics file or a calendar's iCal link.
  const calendarFile = file instanceof File && file.size > 0 && isCalendarFile(file.name, file.type, (await file.slice(0, 40).text()).toUpperCase());
  if (calendarFile || (sheetUrl && isCalendarUrl(sheetUrl))) {
    let text: string;
    try {
      text = calendarFile ? await (file as File).text() : await fetchCalendar(sheetUrl);
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : await said("The calendar could not be read.") }, { status: 400 });
    }
    const events = parseIcs(text);
    if (!events.length) return NextResponse.json({ error: await said("No events were found in this calendar.") }, { status: 400 });
    const read = await calendarToSheets(events);
    if (!read.sheets.length) return NextResponse.json({ error: await said("None of the events in this calendar look like rentals from the last year or ahead.") }, { status: 400 });
    const analysis = normaliseAnalysis({ sheets: read.sheets.map((sheet) => ({ sheet_name: sheet.sheetName, primary_data_type: "rentals", confidence: 0.85, column_mappings: sheet.headers.map((header) => ({ source_column: header, routehq_field: header, confidence: 0.85 })) })) }, read.sheets);
    return NextResponse.json({
      analysis,
      ...(await previewAndBatch(read.sheets, analysis, calendarFile ? (file as File).name : "Calendar", membership.userId)),
      warning: await said(`Read ${read.events} calendar events: ${read.rentals} bookings, ${read.skipped} left out (not rentals, or finished over a year ago). Check each card, especially vehicles and rent.`)
    });
  }

  if ((!(file instanceof File) || file.size === 0) && !sheetUrl) {
    return NextResponse.json({ error: await said("Upload a spreadsheet or paste a public Google Sheets link first.") }, { status: 400 });
  }
  if (sheetUrl && !isGoogleSheetsUrl(sheetUrl)) {
    return NextResponse.json({ error: await said("Only public Google Sheets links are supported.") }, { status: 400 });
  }

  let sheets: ParsedSheet[];
  try {
    const spreadsheetInput = sheetUrl ? await googleSheetToSpreadsheetInput(sheetUrl) : (file as File);
    sheets = await parseSpreadsheetFile(spreadsheetInput);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to read the spreadsheet." }, { status: 400 });
  }

  if (sheets.length === 0) {
    return NextResponse.json({ error: await said("No readable rows were found in this spreadsheet.") }, { status: 400 });
  }

  const sourceName = sheetUrl ? "Google Sheet" : (file as File).name;
  // Headings this business has re-mapped before are read the way the owner chose.
  const learned = (await loadLearnings(await createSupabaseServerClient(), membership.organizationId).catch(() => emptyLearnings())).columns;
  // The built-in rules read the file on their own; the AI, when it's there, checks and corrects that reading.
  // Either way the owner sees every card before anything is saved.
  const raw = aiTextConfigured() ? await mapColumnsWithAi(sheets, importType, learned) : null;
  const analysis = normaliseAnalysis(raw, sheets, learned);
  return NextResponse.json({ analysis, ...(await previewAndBatch(sheets, analysis, sourceName, membership.userId)) });
}
