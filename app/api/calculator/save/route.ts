import { NextRequest, NextResponse } from "next/server";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const organization = await getDefaultOrganization();
    const supabase = (await createSupabaseServerClient()) as any;

    const { error } = await supabase.from("calculator_results").insert({
      organisation_id: organization.id,
      vehicle_make: body.vehicle_make ?? null,
      vehicle_model: body.vehicle_model ?? null,
      vehicle_year: body.vehicle_year ?? null,
      vehicle_trim: body.vehicle_trim ?? null,
      purchase_price: body.purchase_price ?? null,
      inputs: body.inputs ?? {},
      ai_estimates: body.ai_estimates ?? {},
      results: body.results ?? {},
      recommendation: body.recommendation ?? null,
      confidence_score: body.confidence_score ?? null
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to save calculation" }, { status: 500 });
  }
}
