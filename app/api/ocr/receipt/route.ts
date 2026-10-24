import { said } from "@/lib/i18n/server-text";
import { NextResponse } from "next/server";
import { visionProvider } from "@/lib/ai-vision";
import { getCurrentMembership } from "@/lib/auth/roles";
import { readReceipt } from "@/lib/receipt-reading";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Staff snap a receipt: the amount, date, who was paid and what for come back to fill in the cost. */
export async function POST(request: Request) {
  try {
    // Staff only: each call costs money.
    const membership = await getCurrentMembership();
    if (!membership) return NextResponse.json({ error: await said("Sign in first.") }, { status: 401 });
    if (!visionProvider(false)) return NextResponse.json({ error: await said("Photo reading is not set up.") }, { status: 400 });

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: await said("Choose a receipt photo.") }, { status: 400 });
    if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: await said("That file is too large. Use a photo under 12 MB.") }, { status: 400 });

    const read = await readReceipt(Buffer.from(await file.arrayBuffer()), file.type);
    // The same receipt saved before (same receipt number, same amount): say when, so it isn't counted twice.
    let savedBefore: string | null = null;
    if (read.reference) {
      const supabase = await createSupabaseServerClient();
      const { data } = await supabase
        .from("documents")
        .select("created_at, extracted_data")
        .eq("organization_id", membership.organizationId)
        .eq("category", "receipt")
        .eq("extracted_data->>reference", read.reference)
        .limit(5);
      const same = (data || []).find((row: { extracted_data?: { amount?: number } }) => !read.amount || Number(row.extracted_data?.amount) === read.amount);
      savedBefore = same ? String((same as { created_at: string }).created_at).slice(0, 10) : null;
    }
    return NextResponse.json({ ...read, savedBefore });
  } catch (error) {
    console.error("[ocr/receipt]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: await said("The receipt could not be read. Fill it in by hand.") }, { status: 502 });
  }
}
