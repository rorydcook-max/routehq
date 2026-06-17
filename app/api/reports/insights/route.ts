import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { data } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ insights: [] }, { status: 200 });
    }

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const summary = {
      period: data.dateRange?.label,
      revenue: data.totalRevenue,
      expenses: data.totalExpenses,
      profit: data.netProfit,
      revenueChange: data.revenueChange,
      profitChange: data.profitChange,
      topVehicles: (data.vehicleMetrics || []).slice(0, 5).map((v: any) => ({
        name: v.label,
        profit: v.profit,
        utilization: v.utilizationRate,
        roi: v.roi
      })),
      expensesByType: (data.expensesByType || []).slice(0, 5),
      outstandingCount: (data.outstandingBalances || []).length,
      outstandingTotal: (data.outstandingBalances || []).reduce((sum: number, b: any) => sum + b.totalBalance, 0)
    };

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [
        {
          role: "system",
          content:
            "You are a fleet business analyst. Generate 3-5 concise, actionable insights for a vehicle rental operator in Thailand based on their financial data. Return JSON only: an array of objects with fields: title (short), insight (1-2 sentences), action (specific next step). Focus on profitability improvement, cost reduction, and revenue growth."
        },
        {
          role: "user",
          content: `Fleet financial data for ${summary.period}:\n${JSON.stringify(summary, null, 2)}\n\nGenerate 3-5 actionable insights as a JSON array.`
        }
      ],
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);
    const insights = Array.isArray(parsed.insights) ? parsed.insights : Array.isArray(parsed) ? parsed : [];

    return NextResponse.json({ insights });
  } catch {
    return NextResponse.json({ insights: [] }, { status: 200 });
  }
}