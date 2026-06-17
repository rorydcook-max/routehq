import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { make, model, year, trim } = body as {
      make: string;
      model: string;
      year: string;
      trim: string;
    };

    if (!make || !model || !year) {
      return NextResponse.json({ error: "make, model, and year are required" }, { status: 400 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        insurance_annual: 35000,
        porbor_annual: 1800,
        tax_annual: 3500,
        maintenance_annual: 24000,
        depreciation_annual: 60000,
        reliability_score: 72
      });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const vehicleLabel = [make, model, year, trim].filter(Boolean).join(" ");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: `You are a vehicle cost analyst specialising in the Thai rental market. Estimate annual costs in THB for the following vehicle used for rental in Thailand. Return ONLY a JSON object with these exact keys: insurance_annual (Type 1 comprehensive), porbor_annual (compulsory insurance), tax_annual (annual vehicle tax), maintenance_annual (routine servicing and wear items), depreciation_annual (value lost per year), reliability_score (0-100, higher is more reliable). Vehicle: ${vehicleLabel}. Use Thai market pricing.`
        }
      ]
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return NextResponse.json({
      insurance_annual: Number(parsed.insurance_annual) || 35000,
      porbor_annual: Number(parsed.porbor_annual) || 1800,
      tax_annual: Number(parsed.tax_annual) || 3500,
      maintenance_annual: Number(parsed.maintenance_annual) || 24000,
      depreciation_annual: Number(parsed.depreciation_annual) || 60000,
      reliability_score: Number(parsed.reliability_score) || 72
    });
  } catch {
    return NextResponse.json({ error: "Failed to estimate costs" }, { status: 500 });
  }
}
