import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveMembership } from "@/lib/auth/active-organization-server";

/**
 * A handover or return form's signature as an image. The signature is stored as text (a data URL) on the
 * form; sending it inside the booking page added ~15 KB per form to every load and every save. Served here,
 * the browser fetches it once and keeps it (a signed form never changes).
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication is required." }, { status: 401 });

  const { data: membership } = await getActiveMembership(supabase, user.id);
  if (!membership?.organization_id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const { data: inspection } = await supabase
    .from("inspections")
    .select("customer_signature")
    .eq("id", id)
    .eq("organization_id", membership.organization_id)
    .maybeSingle();
  const match = String(inspection?.customer_signature || "").match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return new NextResponse(Buffer.from(match[2], "base64"), {
    headers: {
      "Cache-Control": "private, max-age=31536000, immutable",
      "Content-Type": match[1]
    }
  });
}
