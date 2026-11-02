"use server";

import { revalidatePath } from "next/cache";
import { insertVehicle } from "@/app/actions/vehicles";
import { createChatCompletion, aiTextConfigured } from "@/lib/ai-chat";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { supportedLocaleOptions } from "@/lib/i18n/locales";
import { businessToday } from "@/lib/business-time";
import { settleExistingRental } from "@/lib/existing-rental";
import { activateRental } from "@/lib/rental-activation";
import { ensureOnboardingChecklist, markOnboardingStep } from "@/lib/onboarding";
import { createSupabaseServerClient, getRequestUser } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { googleSheetToSpreadsheetInput, parseSpreadsheetFile } from "@/lib/import/spreadsheet";

/**
 * The fleet assistant (Rory, 2 Nov 2026): an owner tells it about their vehicles in their own words, by typing,
 * talking or sending photos (registration books, the cars themselves, a price list), and it keeps a draft list.
 * Nothing is added until the owner taps Add. Used in setup and anywhere vehicles are added.
 */

export type DraftVehicle = {
  kind: string;
  make: string;
  model: string;
  variant?: string;
  year?: number | null;
  plate?: string;
  colour?: string;
  dailyRate?: number | null;
  weeklyRate?: number | null;
  monthlyRate?: number | null;
  /** Which of the photos sent so far (1 = the first) show this vehicle. */
  photos?: number[];
};

export type AssistantTurn = { role: "user" | "assistant"; text: string };

const MAX_IMAGES_PER_TURN = 4;

function clean(draft: unknown): DraftVehicle[] {
  if (!Array.isArray(draft)) return [];
  return draft
    .map((item: any) => ({
      kind: String(item?.kind || "car").toLowerCase().slice(0, 30),
      make: String(item?.make || "").trim().slice(0, 60),
      model: String(item?.model || "").trim().slice(0, 60),
      variant: String(item?.variant || "").trim().slice(0, 60) || undefined,
      year: Number(item?.year) >= 1950 && Number(item?.year) <= 2100 ? Math.round(Number(item.year)) : null,
      plate: String(item?.plate || "").trim().toUpperCase().slice(0, 20) || undefined,
      colour: String(item?.colour || item?.color || "").trim().slice(0, 30) || undefined,
      dailyRate: Number(item?.dailyRate) > 0 ? Number(item.dailyRate) : null,
      weeklyRate: Number(item?.weeklyRate) > 0 ? Number(item.weeklyRate) : null,
      monthlyRate: Number(item?.monthlyRate) > 0 ? Number(item.monthlyRate) : null,
      photos: Array.isArray(item?.photos) ? item.photos.map(Number).filter((n: number) => Number.isInteger(n) && n > 0).slice(0, 12) : []
    }))
    .filter((item) => item.make || item.model || item.plate)
    .slice(0, 60);
}

/** A rental already running when the business starts with RoveHQ (Rory, 2 Nov 2026): who has which vehicle, what they pay, when next. */
export type DraftRental = {
  /** One of the business's vehicles (an id from the list the assistant was given). */
  vehicleId: string;
  customerName: string;
  customerPhone?: string;
  startDate?: string | null;
  /** When it is due back; empty for open-ended (monthly) rentals. */
  endDate?: string | null;
  rate?: number | null;
  ratePeriod?: "day" | "week" | "month";
  /** The next rent payment, when they pay as they go. */
  nextPaymentDate?: string | null;
  depositHeld?: number | null;
  /** Send the customer the automatic rent-due and return reminders. */
  remind?: boolean;
  /** For showing: the vehicle's name and plate. */
  vehicleName?: string;
};

const isoDay = (value: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);

function cleanRentals(rentals: unknown, vehicleIds: Set<string>): DraftRental[] {
  if (!Array.isArray(rentals)) return [];
  return rentals
    .map((item: any) => ({
      vehicleId: String(item?.vehicleId || ""),
      customerName: String(item?.customerName || "").trim().slice(0, 80),
      customerPhone: String(item?.customerPhone || "").trim().slice(0, 30) || undefined,
      startDate: isoDay(item?.startDate),
      endDate: isoDay(item?.endDate),
      rate: Number(item?.rate) > 0 ? Number(item.rate) : null,
      ratePeriod: (["day", "week", "month"].includes(item?.ratePeriod) ? item.ratePeriod : "month") as "day" | "week" | "month",
      nextPaymentDate: isoDay(item?.nextPaymentDate),
      depositHeld: Number(item?.depositHeld) > 0 ? Number(item.depositHeld) : null,
      remind: item?.remind !== false
    }))
    .filter((item) => vehicleIds.has(item.vehicleId) && item.customerName)
    .slice(0, 60);
}

export async function askFleetAssistant(input: {
  turns: AssistantTurn[];
  /** Photos sent with this message, small JPEG data URLs, numbered after the ones sent before. */
  images: string[];
  photosBefore: number;
  draft: DraftVehicle[];
  rentals?: DraftRental[];
  locale: string;
}): Promise<{ ok: true; reply: string; draft: DraftVehicle[]; rentals: DraftRental[] } | { ok: false; error: string }> {
  if (!aiTextConfigured()) return { ok: false, error: "unavailable" };
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const [categories, { data: fleet }, { data: running }] = await Promise.all([
    getVehicleCategories(organization.id).catch(() => []),
    supabase.from("vehicles").select("id, make, model, registration_number, color").eq("organization_id", organization.id).is("deleted_at", null).order("created_at").limit(120),
    supabase.from("rentals").select("vehicle_id").eq("organization_id", organization.id).is("deleted_at", null).in("status", ["active", "due_soon", "overdue", "extended"])
  ]);
  const rentedNow = new Set(((running || []) as Array<{ vehicle_id: string }>).map((row) => row.vehicle_id));
  const fleetList = ((fleet || []) as any[]).map((row) => ({ id: row.id, name: [row.make, row.model, row.color, row.registration_number].filter(Boolean).join(" "), rentedInRoveHQ: rentedNow.has(row.id) }));
  const kinds = categories.map((category) => category.code).join(", ") || "car, scooter, motorcycle";
  const language = supportedLocaleOptions.find((option) => option.code === input.locale)?.english || "English";
  const currency = organization.currency || "THB";

  const system = [
    "You help the owner of a small vehicle rental business get their business into RoveHQ: first their vehicles, then who is renting them right now.",
    `Reply in ${language}, in one or two short, friendly sentences. Plain words, no lists, no markdown. Today is ${businessToday()}.`,
    "VEHICLES: from what they type, say or send (photos of registration books, of the vehicles, of price lists or spreadsheets), keep a list of new vehicles.",
    `Each vehicle: kind (one of: ${kinds}), make, model, and if known: variant, year, plate (exactly as written; never invent one), colour, and rental prices in ${currency} per day, week or month.`,
    "Photos are numbered in the order they were sent (Photo 1, Photo 2...). Put the numbers of the photos that show a vehicle in its photos list. A registration book photo belongs to the vehicle it describes.",
    "If someone says they have several of the same vehicle, add one entry per vehicle (plates can come later). Only make and model are needed.",
    `Prices said "a month", "monthly" or "/mo" go in monthlyRate; "a day" in dailyRate; "a week" in weeklyRate. Numbers only, in ${currency}. A price said for a group applies to each.`,
    "When the new-vehicle list looks complete, tell them to tap Add to put them in their fleet.",
    "You can read Google Sheets: when a sheet's contents are included below, take the vehicles (and, once those are in the fleet, the rentals) from it. If it says a sheet could not be opened, tell them how to share it. Past payments and expenses are not added here: say that \"Bring in a list\" (Fleet, Import) brings in payment history and costs from the same sheet link, after the vehicles are in.",
    `RENTALS: vehicles already in their fleet are listed below with ids. Once there are some, ask whether any are rented out right now. For each one rented: the customer's name and phone (needed to remind them), when it started, the price and whether per day, week or month, and either the next payment date (monthly renters) or when it is due back (short rentals), and any deposit they hold.`,
    "Turn relative dates into YYYY-MM-DD (\"the 5th\" = the next 5th from today; \"back on Friday\" = the coming Friday).",
    "Then ask if they want RoveHQ to remind each customer automatically before the rent is due (or before the return); set remind true unless they say no.",
    "When several identical vehicles match and they haven't said which, don't ask: pick one not already rented and say which (by plate if it has one).",
    "A rental's vehicleId must be one of the ids listed. Never put a vehicle in rentals that is only in the new-vehicle list; ask them to tap Add first. Nothing is saved until they tap the Add button under the list, so never say you have added or recorded anything; say it's ready to add. Ask one short question at a time.",
    'Return JSON only, exactly this shape: {"reply": "...", "vehicles": [{"kind": "car", "make": "Toyota", "model": "Yaris", "variant": "", "year": 2021, "plate": "", "colour": "white", "dailyRate": null, "weeklyRate": null, "monthlyRate": 15000, "photos": []}], "rentals": [{"vehicleId": "<id>", "customerName": "John Smith", "customerPhone": "+66812345678", "startDate": "2026-10-05", "endDate": null, "rate": 15000, "ratePeriod": "month", "nextPaymentDate": "2026-11-05", "depositHeld": 10000, "remind": true}]}. Always return both whole lists so far, updated (an empty list when there are none).'
  ].join(" ");

  const images = input.images.filter((url) => /^data:image\/(jpeg|png|webp);base64,/.test(url)).slice(0, MAX_IMAGES_PER_TURN);
  const history = input.turns.slice(-16);
  const last = history.pop();
  // Google Sheets links in the message are opened and read (Rory, 2 Nov 2026: it said it couldn't read them).
  const sheets = await readSheetLinks(last?.text || "");
  const lastText = [
    last?.text || "",
    sheets,
    images.length ? `(${images.map((_, index) => `Photo ${input.photosBefore + index + 1}`).join(", ")} attached.)` : "",
    `Vehicles already in the fleet (never put these in the draft again): ${JSON.stringify(fleetList)}`,
    `New vehicles so far: ${JSON.stringify(input.draft)}`,
    `Rentals so far: ${JSON.stringify(input.rentals || [])}`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createChatCompletion(
      {
        model: process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.2,
        // A whole spreadsheet of vehicles and rentals comes back as one list: room for it.
        max_tokens: sheets ? 12000 : 3000,
        messages: [
          { role: "system", content: system },
          ...history.map((turn) => ({ role: turn.role, content: turn.text }) as const),
          {
            role: "user",
            content: [{ type: "text", text: lastText }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } }))]
          }
        ]
      },
      { timeout: sheets ? 110_000 : 45_000 }
    );
    const text = String(completion.choices?.[0]?.message?.content || "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : {};
    const ids = new Set(fleetList.map((vehicle) => vehicle.id));
    return {
      ok: true,
      reply: String(parsed.reply || "").slice(0, 600),
      draft: clean(parsed.vehicles ?? input.draft),
      rentals: cleanRentals(parsed.rentals ?? input.rentals ?? [], ids)
        .filter((rental) => !rentedNow.has(rental.vehicleId))
        .map((rental) => ({ ...rental, vehicleName: fleetList.find((vehicle) => vehicle.id === rental.vehicleId)?.name || "" }))
    };
  } catch (error) {
    console.warn("[fleet-assistant]", error instanceof Error ? error.message.slice(0, 200) : error);
    return { ok: false, error: "failed" };
  }
}

/**
 * The contents of any Google Sheets links in a message, every tab as rows of "heading: value", for the model to read.
 * A sheet that can't be opened says so, so the assistant can tell the owner how to share it.
 */
async function readSheetLinks(text: string) {
  const links = Array.from(new Set(text.match(/https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9-_]+[^\s)]*/g) || [])).slice(0, 3);
  if (!links.length) return "";
  const parts: string[] = [];
  for (const link of links) {
    try {
      const tabs = await parseSpreadsheetFile(await googleSheetToSpreadsheetInput(link));
      const body = tabs
        .map((tab) => {
          const rows = tab.rows.slice(0, 300).map((row) => tab.headers.map((header) => (row[header] ? `${header}: ${row[header]}` : "")).filter(Boolean).join(" | "));
          return `Tab "${tab.sheetName}" (${tab.rows.length} rows):\n${rows.join("\n")}`;
        })
        .join("\n\n");
      parts.push(`Contents of the Google Sheet ${link}:\n${body.slice(0, 60000)}`);
    } catch (error) {
      console.warn("[fleet-assistant] sheet:", error instanceof Error ? error.stack?.slice(0, 400) : error);
      parts.push(`The Google Sheet ${link} could not be opened (${error instanceof Error ? error.message : "error"}). Tell them to set sharing to "Anyone with the link can view" and send it again, or download it and use Bring in a list.`);
    }
  }
  return parts.join("\n\n");
}

function addPeriod(iso: string, period: "day" | "week" | "month", times: number) {
  const date = new Date(`${iso}T00:00:00Z`);
  if (period === "month") date.setUTCMonth(date.getUTCMonth() + times);
  else date.setUTCDate(date.getUTCDate() + (period === "week" ? 7 : 1) * times);
  return date.toISOString().slice(0, 10);
}

/**
 * Records the rentals already running, the same way as an existing rental entered by hand: the rent schedule starts at
 * the next payment (earlier rent is settled), a deposit already held is recorded, the vehicle shows as out, and the
 * customer gets the automatic reminders unless the owner said no. The dashboard then has money due and returns to show.
 */
export async function addAssistantRentals(rentals: DraftRental[]): Promise<{ ok: boolean; added: number; failed: string[] }> {
  const organization = await getDefaultOrganization();
  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, added: 0, failed: ["signed out"] };
  const { data: fleet } = await supabase.from("vehicles").select("id").eq("organization_id", organization.id).is("deleted_at", null);
  const ids = new Set(((fleet || []) as Array<{ id: string }>).map((row) => row.id));
  const currency = organization.currency || "THB";
  const today = businessToday();
  const failed: string[] = [];
  let added = 0;

  for (const rental of cleanRentals(rentals, ids)) {
    const period = rental.ratePeriod || "month";
    const pricing = period === "day" ? "daily" : period === "week" ? "weekly" : "monthly";
    // When it started, if they didn't say: one period before the next payment, else today.
    const startDate = rental.startDate || (rental.nextPaymentDate ? addPeriod(rental.nextPaymentDate, period, -1) : today);
    const customerId = await findOrCreateCustomer(supabase, organization.id, user.id, rental.customerName, rental.customerPhone || "");
    if (!customerId) {
      failed.push(rental.customerName);
      continue;
    }
    const { data: created, error } = await supabase
      .from("rentals")
      .insert({
        organization_id: organization.id,
        customer_id: customerId,
        vehicle_id: rental.vehicleId,
        start_date: startDate,
        end_date: rental.endDate || null,
        is_indefinite: !rental.endDate,
        pricing_model: pricing,
        billing_interval: pricing,
        recurring_billing: period === "month" && !rental.endDate,
        rental_rate: rental.rate || 0,
        deposit_amount: rental.depositHeld || 0,
        currency,
        status: startDate > today ? "booked" : "active",
        entered_by_operator: true,
        customer_reminders: rental.remind !== false,
        created_by: user.id
      })
      .select("id")
      .single();
    if (error || !created) {
      failed.push(`${rental.customerName}: ${/no_double_booking|exclusion/.test(error?.message || "") ? "already rented for these dates" : error?.message || "not saved"}`);
      continue;
    }
    added += 1;
    if (startDate <= today) {
      await supabase
        .from("vehicles")
        .update({ status: "rented", availability_status: "rented", current_rental_id: created.id, current_customer_id: customerId })
        .eq("id", rental.vehicleId)
        .eq("organization_id", organization.id);
      if (rental.rate) {
        // Rent up to the next payment is treated as settled: the schedule starts there. A short rental with a return
        // date and no payment to come is paid in full.
        const billFrom = rental.nextPaymentDate || (rental.endDate ? null : addPeriod(startDate, period, 1));
        await activateRental(created.id, supabase, { billFrom }).catch(() => null);
        const paidBefore = rental.endDate && !rental.nextPaymentDate ? addPeriod(rental.endDate, "day", 1) : null;
        await settleExistingRental(supabase, {
          rental: { id: created.id, vehicle_id: rental.vehicleId, customer_id: customerId, start_date: startDate },
          organizationId: organization.id,
          userId: user.id,
          paidBefore,
          depositHeld: rental.depositHeld || 0,
          currency,
          recordMoney: false
        }).catch(() => null);
      } else if (rental.depositHeld) {
        await settleExistingRental(supabase, {
          rental: { id: created.id, vehicle_id: rental.vehicleId, customer_id: customerId, start_date: startDate },
          organizationId: organization.id,
          userId: user.id,
          paidBefore: null,
          depositHeld: rental.depositHeld,
          currency,
          recordMoney: false
        }).catch(() => null);
      }
    }
  }
  if (added) {
    await ensureOnboardingChecklist(supabase, organization.id);
    await markOnboardingStep(supabase, organization.id, "current_rentals");
  }
  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath("/fleet");
  return { ok: failed.length === 0, added, failed };
}

/** The same person already in the business (by phone, then name), or a new customer. */
async function findOrCreateCustomer(supabase: any, organizationId: string, userId: string, name: string, phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length >= 6) {
    const { data } = await supabase.from("customers").select("id, phone").eq("organization_id", organizationId).is("deleted_at", null).ilike("phone", `%${digits.slice(-8)}%`).limit(1).maybeSingle();
    if (data?.id) return data.id as string;
  }
  const { data: byName } = await supabase
    .from("customers")
    .select("id")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .ilike("full_name", name.replace(/[\\%_]/g, (character) => `\\${character}`))
    .limit(1)
    .maybeSingle();
  if (byName?.id) return byName.id as string;
  const international = digits ? (phone.trim().startsWith("+") ? `+${digits}` : digits.startsWith("0") ? `+66${digits.slice(1)}` : `+${digits}`) : null;
  const { data: created } = await supabase
    .from("customers")
    .insert({ organization_id: organizationId, full_name: name, phone: international, created_by: userId })
    .select("id")
    .single();
  return (created?.id as string) || null;
}

/** Adds the vehicles the owner confirmed. Returns each new vehicle's id, in the same order, for its photos to follow. */
export async function addAssistantVehicles(draft: DraftVehicle[]): Promise<{ ok: true; ids: string[] } | { ok: false; error: string; ids: string[] }> {
  const organization = await getDefaultOrganization();
  const categories = await getVehicleCategories(organization.id);
  const byCode = new Map(categories.map((category) => [category.code, category.id]));
  const fallback = byCode.get("car") || categories[0]?.id || "";
  const ids: string[] = [];
  for (const vehicle of clean(draft)) {
    if (!vehicle.make || !vehicle.model) continue;
    const form = new FormData();
    form.set("organizationId", organization.id);
    form.set("categoryId", byCode.get(vehicle.kind) || (vehicle.kind.includes("bike") ? byCode.get("motorcycle") || byCode.get("scooter") : null) || fallback);
    form.set("make", vehicle.make);
    form.set("model", vehicle.model);
    if (vehicle.variant) form.set("trim", vehicle.variant);
    if (vehicle.year) form.set("year", String(vehicle.year));
    form.set("registrationNumber", vehicle.plate || "");
    if (vehicle.colour) form.set("color", vehicle.colour);
    if (vehicle.dailyRate) form.set("dailyRate", String(vehicle.dailyRate));
    if (vehicle.weeklyRate) form.set("weeklyRate", String(vehicle.weeklyRate));
    if (vehicle.monthlyRate) form.set("monthlyRate", String(vehicle.monthlyRate));
    try {
      const created = await insertVehicle(form);
      ids.push(created.id);
    } catch (error) {
      console.warn("[fleet-assistant] add:", error instanceof Error ? error.message : error);
      return { ok: false, error: "add_failed", ids };
    }
  }
  revalidatePath("/fleet");
  revalidatePath("/");
  return { ok: true, ids };
}

export type ShownTurn = AssistantTurn & { links?: boolean };
export type SavedConversation = { id: string; title: string; shown: ShownTurn[]; turns: AssistantTurn[]; draft: DraftVehicle[]; rentals: DraftRental[]; updatedAt: string };

/**
 * Keeps an assistant chat (Rory, 2 Nov 2026: a reload lost the conversation, and earlier chats couldn't be found).
 * Text only: photos aren't kept. Returns the chat's id, made on the first save.
 */
export async function saveAssistantConversation(input: { id?: string | null; shown: ShownTurn[]; turns: AssistantTurn[]; draft: DraftVehicle[]; rentals: DraftRental[] }): Promise<{ id: string | null }> {
  const [organization, user] = await Promise.all([getDefaultOrganization(), getRequestUser()]);
  if (!user) return { id: null };
  const admin = createSupabaseAdminClient() as any;
  const shown = (input.shown || []).slice(-200).map((turn) => ({ role: turn.role === "user" ? "user" : "assistant", text: String(turn.text || "").slice(0, 4000), ...(turn.links ? { links: true } : {}) }));
  const firstUser = shown.find((turn) => turn.role === "user")?.text || "";
  const row = {
    organization_id: organization.id,
    user_id: user.id,
    kind: "fleet",
    title: firstUser.replace(/\s+/g, " ").slice(0, 80) || null,
    shown,
    turns: (input.turns || []).slice(-40).map((turn) => ({ role: turn.role, text: String(turn.text || "").slice(0, 8000) })),
    draft: clean(input.draft),
    rentals: Array.isArray(input.rentals) ? input.rentals.slice(0, 60) : [],
    updated_at: new Date().toISOString()
  };
  if (input.id) {
    const { data } = await admin.from("assistant_conversations").update(row).eq("id", input.id).eq("organization_id", organization.id).eq("user_id", user.id).select("id").maybeSingle();
    if (data?.id) return { id: data.id };
  }
  const { data } = await admin.from("assistant_conversations").insert(row).select("id").single();
  return { id: data?.id || null };
}

/** The person's recent assistant chats in this business, newest first. */
export async function listAssistantConversations(limit = 20): Promise<Array<{ id: string; title: string; updatedAt: string }>> {
  const [organization, user] = await Promise.all([getDefaultOrganization(), getRequestUser()]);
  if (!user) return [];
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin
    .from("assistant_conversations")
    .select("id, title, updated_at")
    .eq("organization_id", organization.id)
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(limit);
  return ((data || []) as any[]).map((row) => ({ id: row.id, title: row.title || "", updatedAt: row.updated_at }));
}

/** One of the person's chats, to carry on with. */
export async function loadAssistantConversation(id: string): Promise<SavedConversation | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return null;
  const [organization, user] = await Promise.all([getDefaultOrganization(), getRequestUser()]);
  if (!user) return null;
  const admin = createSupabaseAdminClient() as any;
  const { data } = await admin.from("assistant_conversations").select("*").eq("id", id).eq("organization_id", organization.id).eq("user_id", user.id).maybeSingle();
  if (!data) return null;
  return { id: data.id, title: data.title || "", shown: data.shown || [], turns: data.turns || [], draft: data.draft || [], rentals: data.rentals || [], updatedAt: data.updated_at };
}
