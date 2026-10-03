import OpenAI from "openai";
import { businessToday } from "@/lib/business-time";
import { BLOCKING_RENTAL_STATUSES } from "@/lib/rental-conflicts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o";

type Draft = { ok: true; text: string } | { ok: false; error: string };

/**
 * Drafts a reply to the customer's latest message, using only what the
 * business actually has on record: its vehicles and rates, what is free, and
 * this customer's bookings. Staff read it and press send; it never sends itself.
 */
export async function draftReply(input: { organizationId: string; conversationId: string; customerId?: string | null }): Promise<Draft> {
  if (!process.env.OPENAI_API_KEY) return { ok: false, error: "Suggested replies aren't switched on for this account yet." };

  const supabase = createSupabaseAdminClient() as any;
  const today = businessToday();
  const [{ data: organization }, { data: messages }, { data: vehicles }, { data: rentals }, { data: liveRentals }] = await Promise.all([
    supabase.from("organizations").select("name, trading_name, currency, promptpay_id, bank_name").eq("id", input.organizationId).maybeSingle(),
    supabase.from("conversation_messages").select("direction, body, created_at").eq("conversation_id", input.conversationId).order("created_at", { ascending: false }).limit(14),
    supabase.from("vehicles").select("id, make, model, year, status, daily_rate, weekly_rate, monthly_rate, vehicle_categories(name)").eq("organization_id", input.organizationId).is("deleted_at", null).limit(60),
    input.customerId
      ? supabase
          .from("rentals")
          .select("status, start_date, end_date, rental_rate, pricing_model, balance_due, vehicles(make, model, registration_number)")
          .eq("organization_id", input.organizationId)
          .eq("customer_id", input.customerId)
          .order("start_date", { ascending: false })
          .limit(5)
      : Promise.resolve({ data: [] }),
    // Every rental that holds a vehicle now or later, so the draft can speak about future dates.
    supabase.from("rentals").select("vehicle_id, start_date, end_date").eq("organization_id", input.organizationId).in("status", BLOCKING_RENTAL_STATUSES as unknown as string[])
  ]);

  const bookedByVehicle = new Map<string, string[]>();
  for (const rental of liveRentals || []) {
    if (!rental.vehicle_id || (rental.end_date && rental.end_date < today)) continue;
    const period = `${rental.start_date} to ${rental.end_date || "open-ended"}`;
    bookedByVehicle.set(rental.vehicle_id, [...(bookedByVehicle.get(rental.vehicle_id) || []), period]);
  }

  const thread = [...(messages || [])].reverse();
  if (!thread.some((message: any) => message.direction === "in")) return { ok: false, error: "There's no customer message to reply to yet." };

  const context = {
    today,
    business: organization?.trading_name || organization?.name || "the rental business",
    currency: organization?.currency || "THB",
    acceptsPromptPay: Boolean(organization?.promptpay_id),
    acceptsBankTransfer: Boolean(organization?.bank_name),
    vehicles: (vehicles || []).map((vehicle: any) => ({
      name: [vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(" "),
      type: vehicle.vehicle_categories?.name || undefined,
      inWorkshop: vehicle.status === "maintenance" || undefined,
      // Dates it is already taken; free on any dates outside these.
      bookedPeriods: bookedByVehicle.get(vehicle.id) || [],
      perDay: Number(vehicle.daily_rate || 0) || undefined,
      perWeek: Number(vehicle.weekly_rate || 0) || undefined,
      perMonth: Number(vehicle.monthly_rate || 0) || undefined
    })),
    thisCustomersBookings: (rentals || []).map((rental: any) => ({
      vehicle: [rental.vehicles?.make, rental.vehicles?.model].filter(Boolean).join(" "),
      status: rental.status,
      from: rental.start_date,
      until: rental.end_date || "open-ended",
      rate: `${Number(rental.rental_rate || 0)} per ${rental.pricing_model === "daily" ? "day" : rental.pricing_model === "weekly" ? "week" : "month"}`,
      owedNow: Number(rental.balance_due || 0)
    }))
  };

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: MODEL,
      max_tokens: 350,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: [
            `You draft chat replies for staff at ${context.business}, a vehicle rental business in Thailand. A staff member will read your draft and decide whether to send it.`,
            "Write the reply only: no preamble, no quotation marks, no sign-off name.",
            "Reply in the language the customer wrote in. Keep it short and warm, like a helpful person texting: one to four sentences.",
            "Use only the facts in the JSON below. Never invent a price, a vehicle, availability, a discount or a policy. If the facts don't cover the question, say you'll check and come back, or ask the one question you need answered (usually dates or which vehicle).",
            "A vehicle is free for the dates asked about only if they don't overlap its bookedPeriods and it isn't in the workshop. If the customer gave no dates, ask for them before saying what is free.",
            "Quote prices with the currency. If a vehicle has no rate listed, don't state a price for it.",
            "Don't promise a booking is confirmed; staff confirm bookings.",
            `Facts: ${JSON.stringify(context)}`
          ].join("\n")
        },
        ...thread.map((message: any) => ({
          role: (message.direction === "in" ? "user" : "assistant") as "user" | "assistant",
          content: String(message.body || "")
        }))
      ]
    });
    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return { ok: false, error: "Couldn't come up with a suggestion this time. Try again." };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "Couldn't reach the assistant just now. Try again in a moment." };
  }
}
