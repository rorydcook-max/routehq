"use server";

import { revalidatePath } from "next/cache";
import { insertVehicle } from "@/app/actions/vehicles";
import { createChatCompletion, aiTextConfigured } from "@/lib/ai-chat";
import { getDefaultOrganization, getVehicleCategories } from "@/lib/organization";
import { supportedLocaleOptions } from "@/lib/i18n/locales";

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

export async function askFleetAssistant(input: {
  turns: AssistantTurn[];
  /** Photos sent with this message, small JPEG data URLs, numbered after the ones sent before. */
  images: string[];
  photosBefore: number;
  draft: DraftVehicle[];
  locale: string;
}): Promise<{ ok: true; reply: string; draft: DraftVehicle[] } | { ok: false; error: string }> {
  if (!aiTextConfigured()) return { ok: false, error: "unavailable" };
  const organization = await getDefaultOrganization();
  const categories = await getVehicleCategories(organization.id).catch(() => []);
  const kinds = categories.map((category) => category.code).join(", ") || "car, scooter, motorcycle";
  const language = supportedLocaleOptions.find((option) => option.code === input.locale)?.english || "English";
  const currency = organization.currency || "THB";

  const system = [
    "You help the owner of a small vehicle rental business add their vehicles to RoveHQ.",
    `Reply in ${language}, in one or two short, friendly sentences. Plain words, no lists, no markdown.`,
    "From what they type, say or send (photos of registration books, of the vehicles, of price lists or spreadsheets), keep a list of their vehicles.",
    `Each vehicle: kind (one of: ${kinds}), make, model, and if known: variant, year, plate (exactly as written; never invent one), colour, and rental prices in ${currency} per day, week or month.`,
    "Photos are numbered in the order they were sent (Photo 1, Photo 2...). Put the numbers of the photos that show a vehicle in its photos list. A registration book photo belongs to the vehicle it describes.",
    "If someone says they have several of the same car, add one entry per vehicle (plates can come later).",
    "Only make and model are needed. When something important is unclear, ask one short question. When the list looks complete, say they can tap Add to put them in their fleet.",
    `Prices said "a month", "monthly" or "/mo" go in monthlyRate; "a day" or "daily" in dailyRate; "a week" in weeklyRate. Numbers only, in ${currency}. A price said for a group ("two scooters at 3000 a month") applies to each of them.`,
    'Return JSON only, exactly this shape: {"reply": "...", "vehicles": [{"kind": "car", "make": "Toyota", "model": "Yaris", "variant": "", "year": 2021, "plate": "", "colour": "white", "dailyRate": null, "weeklyRate": null, "monthlyRate": 15000, "photos": []}]}. Always return the whole list so far, updated.'
  ].join(" ");

  const images = input.images.filter((url) => /^data:image\/(jpeg|png|webp);base64,/.test(url)).slice(0, MAX_IMAGES_PER_TURN);
  const history = input.turns.slice(-16);
  const last = history.pop();
  const lastText = [
    last?.text || "",
    images.length ? `(${images.map((_, index) => `Photo ${input.photosBefore + index + 1}`).join(", ")} attached.)` : "",
    `Current list: ${JSON.stringify(input.draft)}`
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const completion = await createChatCompletion(
      {
        model: process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o-mini",
        response_format: { type: "json_object" },
        temperature: 0.2,
        max_tokens: 1800,
        messages: [
          { role: "system", content: system },
          ...history.map((turn) => ({ role: turn.role, content: turn.text }) as const),
          {
            role: "user",
            content: [{ type: "text", text: lastText }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url, detail: "high" as const } }))]
          }
        ]
      },
      { timeout: 45_000 }
    );
    const text = String(completion.choices?.[0]?.message?.content || "");
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    const parsed = start >= 0 && end > start ? JSON.parse(text.slice(start, end + 1)) : {};
    return { ok: true, reply: String(parsed.reply || "").slice(0, 600), draft: clean(parsed.vehicles ?? input.draft) };
  } catch (error) {
    console.warn("[fleet-assistant]", error instanceof Error ? error.message.slice(0, 200) : error);
    return { ok: false, error: "failed" };
  }
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
