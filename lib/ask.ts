import { businessToday } from "@/lib/business-time";
import { aiTextConfigured, createChatCompletion } from "@/lib/ai-chat";
import { getDashboardData } from "@/lib/dashboard";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isRunningCost, moneyInAmount } from "@/lib/transaction-options";
import { ASSISTANT_TOOLS, checkAction, type AssistantRecords, type ProposedAction } from "@/lib/assistant-actions";
import { getVehicleCategories } from "@/lib/organization";

const MODEL = process.env.OPENAI_ASSISTANT_MODEL || "gpt-4o";

export type AskAnswer = { ok: true; answer: string; links: Array<{ label: string; href: string }>; proposal?: ProposedAction } | { ok: false; error: string };
export type AskTurn = { role: "user" | "assistant"; content: string };

/** The records an action is checked against: real vehicles, customers and vehicle types. */
export async function assistantRecords(): Promise<AssistantRecords> {
  const data = await getDashboardData();
  const categories = data.organizationId ? await getVehicleCategories(data.organizationId) : [];
  return {
    today: businessToday(),
    vehicles: data.vehicles.map((vehicle) => ({ id: vehicle.id, name: `${vehicle.make} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}`, plate: vehicle.plate })),
    customers: data.customers.map((customer) => ({ id: customer.id, name: customer.name })),
    categories
  };
}

const PAGE_LABELS: Record<string, string> = {
  "/reports": "Open reports",
  "/transactions": "See transactions",
  "/tasks": "Open to-do list",
  "/fleet": "See your fleet",
  "/bookings": "See bookings",
  "/calendar": "Open calendar"
};

function monthKey(iso: string) {
  return String(iso || "").slice(0, 7);
}

function addMonths(isoMonth: string, count: number) {
  const date = new Date(Date.UTC(Number(isoMonth.slice(0, 4)), Number(isoMonth.slice(5, 7)) - 1 + count, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Everything the assistant is allowed to know, worked out by the app rather
 * than by the model: the model reads figures, it doesn't do the bookkeeping.
 */
async function businessSnapshot() {
  const data = await getDashboardData();
  const today = businessToday();
  const thisMonth = monthKey(today);
  const supabase = (await createSupabaseServerClient()) as any;

  // Rent already scheduled for the months ahead.
  const horizon = `${addMonths(thisMonth, 6)}-01`;
  const { data: upcoming } = data.organizationId
    ? await supabase
        .from("rental_payments")
        .select("rental_id, amount, due_date, status, voided, metadata")
        .eq("organization_id", data.organizationId)
        .is("deleted_at", null)
        .in("status", ["scheduled", "pending", "overdue"])
        .lt("due_date", horizon)
    : { data: [] };
  const scheduledByMonth = new Map<string, number>();
  const scheduledRentalMonths = new Set<string>();
  for (const payment of upcoming || []) {
    if (payment.voided || payment.metadata?.voided) continue;
    // Anything still unpaid from earlier months is owed now, so it counts in this month.
    const key = monthKey(payment.due_date) < thisMonth ? thisMonth : monthKey(payment.due_date);
    scheduledByMonth.set(key, (scheduledByMonth.get(key) || 0) + Number(payment.amount || 0));
    scheduledRentalMonths.add(`${payment.rental_id}|${key}`);
  }

  // An open-ended rental may have no payment scheduled for a later month. Where
  // it doesn't, the month is filled in at its current rate and kept apart as an
  // assumption, so nothing is counted twice.
  const openEnded = data.rentals.filter((rental) => rental.end === "Indefinite" && rental.status !== "Booked");
  const projection = Array.from({ length: 6 }, (_, index) => {
    const month = addMonths(thisMonth, index);
    const scheduled = Math.round(scheduledByMonth.get(month) || 0);
    const assumed = index === 0 ? 0 : Math.round(openEnded.filter((rental) => !scheduledRentalMonths.has(`${rental.id}|${month}`)).reduce((sum, rental) => sum + Number(rental.rentalRate || 0), 0));
    return { month, scheduled, assumedIfOpenEndedRentalsContinue: assumed, total: scheduled + assumed };
  });

  const incomeByMonth = new Map<string, number>();
  const costsByMonth = new Map<string, number>();
  for (const transaction of data.transactions) {
    const key = monthKey(transaction.date);
    const type = transaction.rawType || transaction.type;
    const moneyIn = moneyInAmount({ amount: transaction.amount, isDeposit: transaction.isDeposit, type });
    if (moneyIn !== 0) incomeByMonth.set(key, (incomeByMonth.get(key) || 0) + moneyIn);
    else if (isRunningCost({ isDeposit: transaction.isDeposit, type })) costsByMonth.set(key, (costsByMonth.get(key) || 0) + Math.abs(transaction.amount));
  }
  const history = Array.from({ length: 12 }, (_, index) => {
    const month = addMonths(thisMonth, index - 11);
    const income = Math.round(incomeByMonth.get(month) || 0);
    const costs = Math.round(costsByMonth.get(month) || 0);
    return { month, income, costs, profit: income - costs };
  });

  return {
    today,
    currency: "THB",
    vehicles: data.vehicles.map((vehicle) => ({
      id: vehicle.id,
      name: `${vehicle.make} ${vehicle.model}${vehicle.year ? ` ${vehicle.year}` : ""}`,
      plate: vehicle.plate,
      colour: vehicle.color || undefined,
      status: vehicle.status,
      monthlyRate: vehicle.monthlyRate || null,
      incomeToDate: Math.round(vehicle.revenue),
      profitToDate: Math.round(vehicle.profit),
      percentOfLast12MonthsRented: vehicle.utilization,
      purchasePrice: vehicle.purchasePrice || null,
      upcomingRenewals: (vehicle.compliance || []).map((item) => ({ what: item.label, date: item.date, daysFromToday: item.daysLeft }))
    })),
    currentRentals: data.rentals.map((rental) => ({
      id: rental.id,
      customer: rental.customer,
      vehicle: rental.vehicle,
      status: rental.status,
      from: rental.start,
      until: rental.end === "Indefinite" ? "open-ended" : rental.end,
      rate: rental.rentalRate,
      overdueNow: Math.round(rental.overdue || 0),
      depositHeld: Math.round(rental.depositHeld || 0)
    })),
    last12Months: history,
    next6MonthsRent: projection,
    // Added up here so the total is never left to the model's arithmetic.
    next6MonthsRentTotal: projection.reduce((sum, month) => sum + month.total, 0),
    overdueIncludedInFirstMonth: Math.round(data.rentals.reduce((sum, rental) => sum + (rental.overdue || 0), 0)),
    customers: data.customers.map((customer) => ({ id: customer.id, name: customer.name })),
    vehicleTypes: data.organizationId ? await getVehicleCategories(data.organizationId) : [],
    totals: { depositsHeld: Math.round(data.metrics.depositsHeld || 0), customers: data.customers.length }
  };
}

/** Answers a plain-language question about the business from its own records. */
export async function answerQuestion(question: string, language = "English", history: AskTurn[] = []): Promise<AskAnswer> {
  const asked = String(question || "").trim().slice(0, 500);
  // A question gets an answer, never a "save this" card: the change tools are offered only when the message asks
  // for a change. (Gemini in particular would otherwise turn "which vehicle earned most?" into a cost to record.)
  // "Can you add a car…?" is a request, not a question: a change word means the tools are offered (the model still
  // only calls one when the message really asks for that change, and nothing is saved until the owner confirms).
  const asksForChange =
    /\b(add|record|log|create|register|mark|renew|renewed|book)\b/i.test(asked) || /(เพิ่ม|บันทึก|สร้าง|จอง|ต่ออายุ)/.test(asked);
  const isQuestion = !asksForChange && (
    /[?？]\s*$/.test(asked) ||
    /^(what|which|who|when|where|how|why|is|are|was|were|do|does|did|can|could|should|will|would|show|list|tell|give me|compare|explain)\b/i.test(asked) ||
    /(ไหม|มั้ย|อะไร|เท่าไร|เท่าไหร่|ที่ไหน|เมื่อไร|เมื่อไหร่|ใคร|ยังไง|อย่างไร|หรือเปล่า)\s*$/.test(asked));
  if (asked.length < 3) return { ok: false, error: "Type a question first." };
  if (!aiTextConfigured()) return { ok: false, error: "The assistant isn't switched on for this account yet." };

  let snapshot: Awaited<ReturnType<typeof businessSnapshot>>;
  try {
    snapshot = await businessSnapshot();
  } catch {
    return { ok: false, error: "Couldn't read your records just now. Try again in a moment." };
  }

  try {
    const completion = await createChatCompletion({
      model: MODEL,
      max_tokens: 600,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "You answer questions for the owner of a small vehicle rental business in Thailand, using only the JSON records below. They are not an accountant: answer like a sharp, friendly assistant would, in plain words.",
            `Answer in ${language}. Lead with the answer itself. Keep it to a few short sentences, or a short list when comparing several things. Write amounts like ฿12,500. Write dates like 14 Oct 2026.`,
            "Use only the figures given. Never invent a vehicle, customer, amount or date. If the records can't answer the question, say what's missing in one sentence and suggest where to add it.",
            "For income forecasts: use next6MonthsRent. Give each month's total, then next6MonthsRentTotal as the six-month sum (never add figures up yourself; use totals given in the records). Mention how much of the first month is already overdue. If any month includes an assumed amount, say how much of the total assumes open-ended rentals continue. Say it's a projection from current bookings, not a promise.",
            "Never show field names from the records (like profitToDate); describe them in everyday words.",
            "For 'worst' or 'best' vehicles, judge by profitToDate and percentOfLast12MonthsRented, and say which measure you used. A vehicle with no rentals yet is 'not earning yet', not 'worst'.",
            "For upcoming costs or renewals, use upcomingRenewals: negative daysFromToday means it is already overdue. If any are overdue, say how many first, then give the next ones coming up.",
            "You can also make four kinds of change for the owner, by calling a function: add a vehicle, record a payment or cost, create a booking link, and mark paperwork (tax, insurance, service) as renewed. Call the function only when the owner asks for that change and has given what it needs; match vehicles and customers to the records by name, plate or colour and use their ids. IMPORTANT: when the owner's message contains every required parameter of a function, call it immediately in this same reply. Do not ask them to confirm, and do not ask about optional parameters (the customer, the date, notes, colour, an end date): leave those out or use today. The app shows them a card to check and confirm. Ask a question only if a required parameter is truly missing or two records match equally well. The owner confirms before anything is saved, so don't say it is done.",
            "Work out dates from today's date in the records: 'Oct 14th' means the next 14 October, and 'renewed for 1 year' means one year from today.",
            "For anything else that changes data (deleting, editing, cancelling, sending messages), say you can't do that from here yet and name the page where they can.",
            'Reply as JSON: {"answer": string, "links": [{"label": string, "href": string}]}. In "answer", use plain text with line breaks; start list lines with "• ". "links" holds up to 3 pages worth opening, chosen only from: /fleet/{vehicle id}, /bookings/{rental id}, /reports, /transactions, /tasks, /fleet, /bookings, /calendar. Use ids exactly as given.',
            `Records: ${JSON.stringify(snapshot)}`
          ].join("\n")
        },
        ...history.slice(-6).map((turn) => ({ role: turn.role, content: String(turn.content || "").slice(0, 1500) })),
        { role: "user", content: asked }
      ],
      ...(isQuestion ? {} : { tools: ASSISTANT_TOOLS, tool_choice: "auto" as const })
    });

    // The model asked to make a change: check it against the real records and
    // hand it back as a proposal. Nothing is saved here.
    const call = completion.choices[0]?.message?.tool_calls?.[0];
    if (call && call.type === "function") {
      let raw: Record<string, unknown> = {};
      try {
        raw = JSON.parse(call.function.arguments || "{}");
      } catch {
        raw = {};
      }
      const records: AssistantRecords = {
        today: snapshot.today,
        vehicles: snapshot.vehicles.map((vehicle) => ({ id: vehicle.id, name: vehicle.name, plate: vehicle.plate })),
        customers: snapshot.customers,
        categories: snapshot.vehicleTypes
      };
      const checked = checkAction(call.function.name, raw, records);
      if (!checked.ok) return { ok: true, answer: checked.error, links: [] };
      return { ok: true, answer: "Here's what I'll save. Check it and confirm.", links: [], proposal: checked.action };
    }

    // Gemini sometimes wraps the JSON in ``` fences or adds a line around it; a reply that isn't JSON at all is
    // still an answer, shown as it is rather than as "couldn't reach the assistant".
    const content = String(completion.choices[0]?.message?.content || "").trim();
    let parsed: any = {};
    try {
      parsed = JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, "") || "{}");
    } catch {
      const inner = content.match(/\{[\s\S]*\}/)?.[0];
      try {
        parsed = inner ? JSON.parse(inner) : { answer: content };
      } catch {
        parsed = { answer: content };
      }
    }
    const answer = typeof parsed.answer === "string" ? parsed.answer.trim() : "";
    if (!answer) return { ok: false, error: "Couldn't work out an answer to that. Try asking it another way." };

    // Only links to real pages and real records are passed on.
    const vehicleIds = new Set(snapshot.vehicles.map((vehicle) => vehicle.id));
    const rentalIds = new Set(snapshot.currentRentals.map((rental) => rental.id));
    const plain = new Set(["/reports", "/transactions", "/tasks", "/fleet", "/bookings", "/calendar"]);
    const links = (Array.isArray(parsed.links) ? parsed.links : [])
      .filter((link: any) => {
        const href = String(link?.href || "");
        if (plain.has(href)) return true;
        const match = href.match(/^\/(fleet|bookings)\/([0-9a-f-]{36})$/);
        return Boolean(match && (match[1] === "fleet" ? vehicleIds.has(match[2]) : rentalIds.has(match[2])));
      })
      .slice(0, 3)
      .map((link: any) => {
        const href = String(link.href);
        const id = href.split("/")[2];
        const vehicle = href.startsWith("/fleet/") ? snapshot.vehicles.find((entry) => entry.id === id) : null;
        const rental = href.startsWith("/bookings/") ? snapshot.currentRentals.find((entry) => entry.id === id) : null;
        const label = vehicle ? vehicle.name : rental ? `${rental.customer}'s booking` : PAGE_LABELS[href] || "Open";
        return { label, href };
      });

    return { ok: true, answer, links };
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error);
    console.warn("[ask] failed:", why.slice(0, 300));
    // Out of credit won't fix itself in a moment, so it says so rather than "try again".
    if (/no credits|insufficient_quota|exceeded your current quota|billing/i.test(why)) {
      return { ok: false, error: "The assistant's AI service is out of credit, so it can't answer right now. Everything else in RouteHQ works as normal." };
    }
    return { ok: false, error: "Couldn't reach the assistant just now. Try again in a moment." };
  }
}
