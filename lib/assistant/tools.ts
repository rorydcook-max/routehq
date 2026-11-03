import { checkAction, COST_TYPES, PAYMENT_METHODS, type ProposedAction } from "@/lib/assistant-actions";
import { mayUseTool, type AssistantRole, type ToolName } from "@/lib/assistant/permissions";
import { loadAssistantRecords, matchCustomer, matchVehicle, paymentsFor } from "@/lib/assistant/records";
import { businessSnapshot } from "@/lib/ask";
import type { ChatAction, ChatMeta } from "@/lib/chat";
import { fileKindFromName } from "@/lib/chat-suggestions";
import { said } from "@/lib/i18n/server-text";
import { googleSheetToSpreadsheetInput, isGoogleSheetsUrl, parseSpreadsheetFile } from "@/lib/import/spreadsheet";
import { describeMatches, detectPreset } from "@/lib/import/presets";
import { readReceipt } from "@/lib/receipt-reading";
import { loadPublishedArticles } from "@/lib/site/docs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PRICE_WORDS, PRICING_SLUG, pickArticles, pricingArticle } from "@/lib/support-assistant";
import { SUPPORT_BUCKET, type SupportAttachment } from "@/lib/support";

/**
 * The one assistant's tools (lib/assistant/agent.ts runs the loop). Each is an OpenAI-style function the model can
 * call, filtered by role before the model sees the list (lib/assistant/permissions.ts) and checked again here.
 *
 * Two kinds:
 * - look-ups (search_help, business_records): the result goes back to the model, which then answers with reply;
 * - finishers: the turn ends with what they make. A task tool makes a card to check and save (nothing is saved until
 *   Save, which runs confirmAssistantAction in app/actions/ask.ts, checking everything again); the vehicle and
 *   paperwork tools hand the turn to the fleet assistant (its cards); others give a button to the right screen.
 */

export type Outcome =
  | { type: "reply"; body: string; meta: ChatMeta; helpUsed?: { articles: string[]; handoff: boolean; request: boolean } }
  | { type: "fleet" }
  | { type: "handoff" };

export type ToolResult = { done: false; content: string } | { done: true; outcome: Outcome };

export type ToolContext = {
  role: AssistantRole;
  organizationId: string | null;
  pathname: string | null;
  text: string;
  /** This message's files (support bucket). */
  files: SupportAttachment[];
  admin: any;
  /** What the look-ups found, for checking the reply's links and articles. */
  state: {
    articles: Array<{ slug: string; title: string; href: string; video?: string | null; poster?: string | null }>;
    knownIds: Set<string>;
    helpSearched: boolean;
  };
};

type Spec = { type: "function"; function: { name: ToolName; description: string; parameters: Record<string, unknown> } };
const fn = (name: ToolName, description: string, properties: Record<string, unknown> = {}, required: string[] = []): Spec => ({
  type: "function",
  function: { name, description, parameters: { type: "object", properties, ...(required.length ? { required } : {}) } }
});

const SPECS: Record<ToolName, Spec> = {
  reply: fn(
    "reply",
    "Your answer to them. Always end the turn with this unless another tool finishes it.",
    {
      text: { type: "string" },
      articles: { type: "array", items: { type: "string" }, description: "Slugs of the help articles you used" },
      handoff: { type: "boolean", description: "True when you couldn't help and a person from the RoveHQ team should" },
      request: { type: "boolean", description: "True when they asked for new help content (a guide, video, FAQ)" }
    },
    ["text"]
  ),
  search_help: fn("search_help", "Search RoveHQ's help articles (how to use the app, features, settings, problems, plans and pricing).", { query: { type: "string", description: "A few English keywords" } }, ["query"]),
  talk_to_person: fn("talk_to_person", "Pass the chat to a person from the RoveHQ team. Only when they ask for a person."),
  business_records: fn("business_records", "The business's own figures: vehicles (earnings, use, renewals due), current rentals (overdue rent, deposits held), money in and costs for the last 12 months, rent expected over the next 6 months, customers. For any question about their business."),
  add_vehicles: fn("add_vehicles", "Add vehicles to their fleet from what they typed, photos of vehicles or registration books, or a Google Sheet link of vehicles; also who is renting their vehicles right now. Also for follow-ups to the vehicle cards. Shows vehicle cards to check and add."),
  renew_paperwork: fn("renew_paperwork", "Insurance, compulsory insurance, road tax or an inspection renewed: a photo of the policy, tax receipt or certificate, or told in words. Shows cards that update the vehicle's dates and record the cost."),
  record_cost: fn(
    "record_cost",
    "Record money spent: fuel, a repair, a service, insurance, a fine, parts. With a receipt photo set useReceipt: it's read for you, so leave out what's printed on it. Shows a card to check and save.",
    {
      useReceipt: { type: "boolean" },
      amount: { type: "number" },
      date: { type: "string", description: "YYYY-MM-DD, only if said" },
      payee: { type: "string" },
      vehicle: { type: "string", description: "Plate or name, as they said it" },
      category: { type: "string", enum: [...COST_TYPES] },
      notes: { type: "string" }
    }
  ),
  record_payment: fn(
    "record_payment",
    "A customer paid (rent, a deposit, a charge). Finds what they owe and shows a card to check and save.",
    {
      customer: { type: "string", description: "Customer's name as they said it" },
      amount: { type: "number" },
      date: { type: "string", description: "YYYY-MM-DD, only if said" },
      method: { type: "string", enum: Object.keys(PAYMENT_METHODS) }
    }
  ),
  create_booking: fn(
    "create_booking",
    "Make a booking. Without a customer it's a booking link the customer fills in and signs. Call it once you know the start date: everything else can be set on the card.",
    {
      vehicle: { type: "string", description: "Plate or name, as they said it" },
      customerName: { type: "string" },
      customerPhone: { type: "string" },
      startDate: { type: "string", description: "YYYY-MM-DD" },
      endDate: { type: "string", description: "YYYY-MM-DD; leave out for open-ended" },
      period: { type: "string", enum: ["daily", "weekly", "monthly"] },
      rate: { type: "number", description: "Price per period" },
      deposit: { type: "number" }
    },
    ["startDate"]
  ),
  import_sheet: fn("import_sheet", "Bring a whole spreadsheet (a file they sent, or a Google Sheet link) of vehicles, customers, bookings and payment history into RoveHQ, including an export from other rental software (Booqable, HQ Rental Software, RentWorks, Checkfront and others), which it recognises by name.", { sheetUrl: { type: "string" } }),
  contract_upload: fn("contract_upload", "They sent their own rental agreement or contract (PDF or Word) to use for bookings."),
  damage_photos: fn("damage_photos", "Photos of damage, an odometer or a fuel gauge for a rental.")
};

/** The tool list for a role: nothing the role can't use is ever offered. */
export function toolSpecs(tools: ToolName[]) {
  return tools.map((tool) => SPECS[tool]);
}

const reply = (body: string, meta: ChatMeta = {}): ToolResult => ({ done: true, outcome: { type: "reply", body, meta } });

/** A card's words in the reader's language: titles, labels and the fixed choices (vehicle and customer names stay). */
async function translated(action: ProposedAction): Promise<ProposedAction> {
  const fixed = new Set(["type", "method", "pricingModel"]);
  return {
    ...action,
    title: await said(action.title),
    rows: await Promise.all(action.rows.map(async (row) => ({ ...row, label: await said(row.label) }))),
    fields: action.fields
      ? await Promise.all(
          action.fields.map(async (field) => ({
            ...field,
            label: await said(field.label),
            options: field.options ? await Promise.all(field.options.map(async (option) => (fixed.has(field.key) || option.value === "none" ? { ...option, label: await said(option.label) } : option))) : undefined
          }))
        )
      : undefined,
    fullForm: action.fullForm ? { ...action.fullForm, label: await said(action.fullForm.label) } : undefined
  };
}

const pageId = (pathname: string | null, section: "fleet" | "bookings") => String(pathname || "").match(new RegExp(`^/${section}/([0-9a-f-]{36})`, "i"))?.[1] || null;

async function fileBytes(admin: any, file: SupportAttachment) {
  const { data } = await admin.storage.from(SUPPORT_BUCKET).download(file.path);
  return data ? Buffer.from(await data.arrayBuffer()) : null;
}

/** Runs one tool call. Anything the role can't use is refused here too, whatever the model asked for. */
export async function runTool(name: string, args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  const tool = name as ToolName;
  if (!(tool in SPECS) || !mayUseTool(tool, ctx.role)) return { done: false, content: "Not available to this person. Tell them in one sentence who can do it (the business owner), or that it can't be done here." };
  try {
    switch (tool) {
      case "search_help":
        return { done: false, content: await searchHelp(String(args.query || ctx.text), ctx) };
      case "business_records":
        return { done: false, content: await records(ctx) };
      case "talk_to_person":
        return { done: true, outcome: { type: "handoff" } };
      case "add_vehicles":
      case "renew_paperwork":
        return { done: true, outcome: { type: "fleet" } };
      case "record_cost":
        return await recordCost(args, ctx);
      case "record_payment":
        return await recordPayment(args, ctx);
      case "create_booking":
        return await createBooking(args, ctx);
      case "import_sheet":
        return await importSheet(args, ctx);
      case "contract_upload":
        return await contractUpload(ctx);
      case "damage_photos":
        return await damagePhotos(ctx);
      default:
        return { done: false, content: "Unknown tool." };
    }
  } catch (error) {
    console.warn(`[assistant] ${tool}:`, error instanceof Error ? error.message.slice(0, 200) : error);
    return { done: false, content: "That didn't work. Say sorry in one sentence and offer a person (handoff)." };
  }
}

/* ---------------------------------------------------------------- look-ups ---------------------------------------------------------------- */

/** The help articles for a few keywords (the same picker the help centre uses), with the plans when it's about cost. */
async function searchHelp(query: string, ctx: ToolContext) {
  await loadPublishedArticles().catch(() => undefined);
  let found = pickArticles(query, ctx.pathname);
  if (PRICE_WORDS.test(query) || PRICE_WORDS.test(ctx.text)) found = [...found.slice(0, 2), pricingArticle()];
  ctx.state.helpSearched = true;
  for (const article of found) {
    if (ctx.state.articles.some((known) => known.slug === article.slug)) continue;
    ctx.state.articles.push({ slug: article.slug, title: article.title, href: article.slug === PRICING_SLUG ? "/pricing" : `/docs/${article.slug}`, video: article.video, poster: article.poster });
  }
  if (!found.length) return "No help articles matched.";
  return found.map((article) => `--- slug: ${article.slug}\ntitle: ${article.title}${article.video ? " (has video)" : ""}\n${article.description}\n\n${article.body}`).join("\n\n");
}

/** The owner's figures, worked out by the app (the model reads them, it doesn't do the bookkeeping). */
async function records(ctx: ToolContext) {
  const snapshot = await businessSnapshot();
  snapshot.vehicles.forEach((vehicle) => ctx.state.knownIds.add(vehicle.id));
  snapshot.currentRentals.forEach((rental) => ctx.state.knownIds.add(rental.id));
  return JSON.stringify(snapshot).slice(0, 40000);
}

/* ---------------------------------------------------------------- cards ---------------------------------------------------------------- */

async function recordCost(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  const recs = await loadAssistantRecords();
  const onPage = pageId(ctx.pathname, "fleet");
  let vehicle = matchVehicle(recs, args.vehicle) || recs.vehicleRows.find((row) => row.id === onPage) || null;
  let raw: Record<string, unknown> = { amount: args.amount, date: args.date, supplier: args.payee, type: args.category, notes: args.notes };
  let readIt = false;
  let savedBefore = "";
  const file = args.useReceipt === false ? null : ctx.files.find((item) => /^image\/(jpeg|png|webp|gif)$/.test(item.type) || item.type === "application/pdf");
  if (file && file.size <= 12 * 1024 * 1024) {
    const bytes = await fileBytes(ctx.admin, file);
    if (bytes) {
      // The same reader as "Upload a receipt" on /transactions/new (api/ocr/receipt).
      const read = await readReceipt(bytes, file.type);
      if (!read.isReceipt) return { done: false, content: "The file isn't a receipt. Ask them what it is." };
      // A policy or tax receipt renews the vehicle's paperwork: the paperwork cards move its date too.
      if (read.paperwork && mayUseTool("renew_paperwork", ctx.role)) return { done: true, outcome: { type: "fleet" } };
      readIt = true;
      raw = {
        amount: Number(args.amount) > 0 ? args.amount : read.amount,
        date: args.date || read.date,
        supplier: args.payee || read.paidTo,
        type: args.category || read.costType,
        notes: args.notes || read.summary,
        mileage: read.odometer,
        receiptPath: file.path
      };
      if (read.plate) vehicle = matchVehicle(recs, read.plate) || vehicle;
      if (read.reference) {
        const supabase = (await createSupabaseServerClient()) as any;
        const { data } = await supabase.from("documents").select("created_at, extracted_data").eq("organization_id", recs.organizationId).eq("category", "receipt").eq("extracted_data->>reference", read.reference).limit(5);
        const same = ((data || []) as any[]).find((row) => !read.amount || Number(row.extracted_data?.amount) === read.amount);
        if (same) savedBefore = String(same.created_at).slice(0, 10);
      }
    }
  }
  if (!(Number(raw.amount) > 0)) return { done: false, content: readIt ? "The receipt's total couldn't be read. Ask how much it was." : "Ask how much it was." };
  raw.vehicleId = vehicle?.id || (recs.vehicles.length ? "" : "none");
  const checked = checkAction("record_cost", raw, recs);
  if (!checked.ok) return { done: false, content: checked.error };
  const action: ProposedAction = { ...checked.action, fullForm: { label: "Open the full form", href: "/transactions/new", receiptPath: typeof raw.receiptPath === "string" ? raw.receiptPath : undefined } };
  const lines = [readIt ? await said("I've read the receipt. Check it and save.") : await said("Check it and save.")];
  if (!vehicle && recs.vehicles.length) lines.push(await said("Pick the vehicle, or No vehicle for a business cost."));
  if (savedBefore) lines.push(await said(`A receipt with the same number was saved on ${savedBefore}.`));
  return reply(lines.join(" "), { proposal: await translated(action) });
}

async function recordPayment(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  const recs = await loadAssistantRecords({ payments: true });
  const onPage = pageId(ctx.pathname, "bookings");
  const list = paymentsFor(recs, { customer: args.customer, rentalId: args.customer ? null : onPage });
  if (!list.length) {
    const names = [...new Set((recs.payments || []).map((payment) => payment.customer))].slice(0, 12);
    return {
      done: false,
      content: names.length
        ? `No payment due found for "${String(args.customer || "")}". Customers with payments due: ${names.join(", ")}. Ask which one.`
        : "Nobody has a payment due in RoveHQ right now. Say so; other money in can be recorded under Money in & out."
    };
  }
  const customers = [...new Set(list.map((payment) => payment.customer))];
  if (customers.length > 1) return { done: false, content: `Several customers match: ${customers.join(", ")}. Ask which one.` };
  const paid = Number(args.amount) || 0;
  const pick = (paid && list.find((payment) => Math.abs(payment.amount - paid) < 1)) || list[0];
  list.forEach((payment) => ctx.state.knownIds.add(payment.rentalId));
  const checked = checkAction("record_payment", { paymentId: pick.id, amount: paid || null, date: args.date, method: args.method }, recs);
  if (!checked.ok) return { done: false, content: checked.error };
  return reply(await said("Check it and save."), { proposal: await translated(checked.action) });
}

async function createBooking(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  const recs = await loadAssistantRecords();
  if (!recs.vehicles.length) return { done: false, content: "They have no vehicles in RoveHQ yet. Say a vehicle needs adding first, and offer to add it." };
  const onPage = pageId(ctx.pathname, "fleet");
  const vehicle = matchVehicle(recs, args.vehicle) || recs.vehicleRows.find((row) => row.id === onPage) || (recs.vehicleRows.length === 1 ? recs.vehicleRows[0] : null);
  const customer = matchCustomer(recs, args.customerName, args.customerPhone);
  const period = ["daily", "weekly", "monthly"].includes(args.period) ? args.period : args.endDate ? "daily" : "monthly";
  // The vehicle's own price for that period when they didn't say one.
  const rate = Number(args.rate) > 0 ? Number(args.rate) : vehicle ? (period === "monthly" ? vehicle.monthly : period === "weekly" ? vehicle.weekly : vehicle.daily) || null : null;
  const checked = checkAction(
    "create_booking",
    {
      vehicleId: vehicle?.id || "",
      customerId: customer?.id || null,
      customerName: customer ? customer.name : args.customerName,
      customerPhone: args.customerPhone || (customer ? recs.customerPhones[customer.id] : null),
      startDate: args.startDate,
      endDate: args.endDate,
      pricingModel: period,
      rentalRate: rate,
      depositAmount: Number(args.deposit) > 0 ? Number(args.deposit) : vehicle?.deposit || 0
    },
    recs
  );
  if (!checked.ok) return { done: false, content: checked.error };
  const lines = [await said("Check it and save.")];
  if (!vehicle) lines.push(await said("Pick the vehicle on the card."));
  const newName = String(args.customerName || "").slice(0, 60);
  if (!customer && newName && args.customerPhone) lines.push(await said(`${newName} is new: they're added as a customer when you save.`));
  else if (!customer && newName) lines.push(await said(`${newName} is a new customer: add their phone, or clear the name and they fill in their own details from the booking link.`));
  else if (!customer) lines.push(await said("No customer yet: you get a booking link to send, and they fill in their details and sign."));
  return reply(lines.join(" "), { proposal: await translated(checked.action) });
}

/* ---------------------------------------------------------------- screens ---------------------------------------------------------------- */

/**
 * A spreadsheet or Google Sheet: the tabs and rows are counted here (no AI, quick), then the import screen opens with
 * the file handed over. The full preview (column mapping, the cards, problems) needs the import screen: it can take
 * a minute with the AI mapping, too long for a chat turn, and the owner reviews the cards there before anything goes in.
 */
async function importSheet(args: Record<string, any>, ctx: ToolContext): Promise<ToolResult> {
  const file = ctx.files.find((item) => fileKindFromName(item.name, item.type) === "spreadsheet");
  const url = String(args.sheetUrl || ctx.text.match(/https:\/\/docs\.google\.com\/spreadsheets\/[^\s)]+/)?.[0] || "").trim();
  if (!file && !url) return { done: false, content: "Ask them to send the spreadsheet here, or a Google Sheet link." };
  if (!file && !isGoogleSheetsUrl(url)) return { done: false, content: "Only Google Sheets links can be read. Ask for the file or a Google Sheet link." };
  let summary = "";
  // An export from other rental software (Booqable, HQ, RentWorks...): said by name, and the import opens on it.
  let matched: { software: string; text: string } | null = null;
  try {
    const bytes = file ? await fileBytes(ctx.admin, file) : null;
    const tabs = await parseSpreadsheetFile(file && bytes ? { bytes, filename: file.name, type: file.type } : await googleSheetToSpreadsheetInput(url));
    const kept = tabs.filter((tab) => tab.rows.length).slice(0, 6);
    if (kept.length) summary = kept.map((tab) => `${tab.sheetName} (${tab.rows.length})`).join(", ");
    const matches = tabs.flatMap((tab) => {
      const preset = detectPreset(tab);
      return preset ? [{ sheetName: tab.sheetName, software: preset.software, kind: preset.kind, generic: false }] : [];
    });
    if (matches.length) matched = { software: matches[0].software, text: describeMatches(matches) };
  } catch (error) {
    if (!file) return { done: false, content: `The Google Sheet couldn't be opened (${error instanceof Error ? error.message.slice(0, 120) : "error"}). Tell them to set sharing to "Anyone with the link can view" and send it again.` };
  }
  const from = matched ? `from=${matched.software}` : "";
  const action: ChatAction = {
    kind: "spreadsheet",
    href: file ? `/fleet/import${from ? `?${from}` : ""}` : `/fleet/import?sheet=${encodeURIComponent(url)}${from ? `&${from}` : ""}`,
    label: await said("Open the import"),
    paths: file ? [file.path] : [],
    handover: file ? "sheet" : "url"
  };
  const recognised = matched ? ` This is a ${matched.text} export: RoveHQ recognises it and reads it straight away.` : "";
  const body = summary
    ? await said(`Found these tabs and rows: ${summary}.${recognised} Open the import to check what goes in before anything is added.`)
    : await said(`${recognised.trim() ? `${recognised.trim()} ` : ""}Open the import to read it: you check what it found before anything is added.`);
  return reply(body, { action });
}

/** Their own contract: read in side by side under Settings, Rental agreement, where they check where the details go. */
async function contractUpload(ctx: ToolContext): Promise<ToolResult> {
  const file = ctx.files.find((item) => fileKindFromName(item.name, item.type) === "contract" || item.type === "application/pdf") || ctx.files[0];
  if (!file) return { done: false, content: "Ask them to send the contract here (PDF or Word)." };
  return reply(await said("Your contract is read in under Rental agreement, where you check the wording side by side before customers sign it."), {
    action: { kind: "contract", href: `/settings/contracts?file=${encodeURIComponent(file.path)}`, label: await said("Set up this contract"), paths: [file.path], handover: "url" }
  });
}

/** Damage and odometer photos belong with the rental, in its handover or return check. */
async function damagePhotos(ctx: ToolContext): Promise<ToolResult> {
  const booking = pageId(ctx.pathname, "bookings");
  const paths = ctx.files.map((file) => file.path);
  return reply(await said("Damage and odometer photos go in the booking's handover or return check, so they stay with the rental if there's a dispute."), {
    action: booking ? { kind: "damage", href: `/bookings/${booking}`, label: await said("Open this booking"), paths } : { kind: "damage", href: "/bookings", label: await said("Open Bookings"), paths }
  });
}
