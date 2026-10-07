import { NextRequest, NextResponse } from "next/server";
import { getRequestUser } from "@/lib/supabase/server";
import { getDefaultOrganization } from "@/lib/organization";
import { businessPlace, languageName, researchAvailable, researchJson } from "@/lib/ai-research";

export const maxDuration = 180;

/** Where vehicles are publicly advertised, by country. Anywhere else, the model is asked for the main local sites. */
const CHANNELS: Record<string, string> = {
  Thailand:
    "one2car.com, kaidee.com, Facebook Marketplace, bahtsold.com, taladrod.com, carsome.co.th, cars24, roddonjai.com, Toyota Sure, Honda Certified Used Car, Mazda CPO, dealer promotions for new vehicles, and for two-wheelers also mocyc.com and local motorcycle shops"
};

const key = (url: string) => url.replace(/^https?:\/\/(www\.|m\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();

/**
 * Searches public adverts for other vehicles the same money could buy, each
 * with the figures needed to work out what it would earn. The calculator runs
 * the same sums on each and ranks them.
 */
export async function POST(request: NextRequest) {
  const user = await getRequestUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!researchAvailable()) return NextResponse.json({ listings: [], unavailable: true });

  const body = (await request.json().catch(() => ({}))) as Record<string, any>;
  const budget = Number(body.budget) || 0;
  if (budget <= 0) return NextResponse.json({ error: "What is the budget?" }, { status: 400 });

  const organization = await getDefaultOrganization();
  const { country, area, currency } = businessPlace(organization);
  const category = String(body.category || "car");
  const considering = String(body.considering || "").slice(0, 120);
  const style = body.style === "daily" ? "by the day to visitors" : body.style === "mix" ? "both by the day and by the month" : "by the month to long-stay customers";
  const channels = CHANNELS[country] || `the main public classified sites, marketplaces, certified used programmes and dealer promotions in ${country}`;
  const thisYear = new Date().getFullYear();
  // The figures already used for the vehicle being considered, so the others are judged by the same yardstick.
  const ref = body.reference && typeof body.reference === "object" ? body.reference : null;
  const pick = (name: string) => (Number(ref?.[name]) > 0 ? `${name} ${Number(ref[name])}` : "");
  const yardstick = ref
    ? ["rent_month_typical", "rent_day_typical", "occupancy_long", "occupancy_short", "insurance_year", "maintenance_year", "tax_year", "compulsory_year", "buying_costs"].map(pick).filter(Boolean).join(", ")
    : "";

  const prompt = `You are a vehicle rental business analyst. A rental operator in ${area}, ${country} has about ${budget} ${currency} to buy one ${category} to rent out ${style}.${considering ? ` They are considering a ${considering}.` : ""}

Use web search to find vehicles that are advertised for sale right now in ${country} (ideally near ${area}) for between ${Math.round(budget * 0.6)} and ${Math.round(budget * 1.1)} ${currency}, on: ${channels}.

Pick up to 6 that would make the most profit as rental vehicles over the years they are kept: strong rental demand in ${area}, cheap to run and repair, and holding their value. Prefer different models over several adverts for the same one.${considering ? ` Do not include the ${considering} itself.` : ""} Include nearly-new and new options if a promotion brings them into budget.

Reply with one JSON object and nothing else:
{
  "listings": [
    {
      "title": "advert title as shown",
      "make": "", "model": "", "year": number, "trim": "",
      "price": number,
      "mileage_km": number or null,
      "location": "where it is",
      "source": "site name",
      "url": "the exact address of the advert page you opened, or null if you only saw it in a list",
      "why": "one short sentence, in ${languageName(String(body.locale || "en"))}, on why it suits renting here",
      "rent_month_typical": number, "rent_day_typical": number,
      "occupancy_long": number, "occupancy_short": number,
      "insurance_year": number, "compulsory_year": number, "tax_year": number,
      "maintenance_year": number, "maintenance_growth_pct": number,
      "buying_costs": number,
      "resale_pct_by_year": [10 numbers],
      "rent_fade_from_age": number, "rent_fade_pct": number, "max_rental_age": number
    }
  ]
}

Field meanings: all money in ${currency}, whole numbers. The operator is a small independent business competing with other small local rental shops, so rent_month_typical is what small local operators in ${area} charge a long-stay customer for a month and rent_day_typical what they charge per day - never the prices of Hertz, Avis, Sixt, Budget, Europcar or other chains, or of booking aggregators, and never a monthly rate worked out by multiplying a day rate. occupancy_* are % of days out on rent in a year by the month / by the day. insurance_year is comprehensive cover for rental use. maintenance_year is servicing, tyres and ordinary repairs in the first year owned given its age (the current year is ${thisYear}); maintenance_growth_pct how much more each following year. buying_costs are one-off transfer and registration costs. resale_pct_by_year is what it would sell for after 1..10 years of ownership from today as a % of the advertised price, at rental mileage. rent_fade_* is the age from which customers pay less and by how much a year. max_rental_age is the age after which customers or insurers stop accepting it.

${yardstick && considering ? `For the ${considering} these figures are already being used: ${yardstick}. Judge every vehicle by the same yardstick: same area, same kind of customer, and the same occupancy unless you found a real reason that model rents better or worse. A vehicle should only come out ahead because of its price, its rent, its costs or how it holds value.\n\n` : ""}Rules: percentages are whole numbers (85, not 0.85). Only real adverts you found in this search, with the price as advertised. Never invent an advert or an address. If you found fewer than 6, return fewer. Raw JSON only, no markdown, no comments.`;

  try {
    const { data, sources } = await researchJson(prompt);
    const opened = new Set(sources.map((source) => key(source.url)));
    const listings = (Array.isArray(data.listings) ? data.listings : [])
      .filter((item: any) => item && Number(item.price) > 0 && item.make && item.model)
      .slice(0, 6)
      .map((item: any) => {
        // Only link straight to an advert the search really opened; otherwise the calculator offers a search for it instead.
        const url = typeof item.url === "string" && /^https?:\/\//.test(item.url) && opened.has(key(item.url)) ? item.url : null;
        return { ...item, url };
      });
    return NextResponse.json({ listings, place: area });
  } catch (error) {
    console.error("calculator alternatives failed", error);
    return NextResponse.json({ listings: [], failed: true });
  }
}
