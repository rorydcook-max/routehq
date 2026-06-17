import { NextResponse } from "next/server";
import { processCustomerPortalAction } from "@/lib/portal-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const { actionId } = await request.json().catch(() => ({ actionId: null }));
  if (!actionId) {
    return NextResponse.json({ error: "actionId is required" }, { status: 400 });
  }

  try {
    const supabase = createSupabaseAdminClient() as any;
    const result = await processCustomerPortalAction(supabase, actionId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process portal action" }, { status: 500 });
  }
}
