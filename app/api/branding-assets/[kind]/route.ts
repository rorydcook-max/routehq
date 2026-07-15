import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const allowedKinds = new Set(["logo", "signature"]);

function contentTypeForPath(path: string | null) {
  if (path?.toLowerCase().endsWith(".webp")) return "image/webp";
  if (path?.toLowerCase().endsWith(".jpg") || path?.toLowerCase().endsWith(".jpeg")) return "image/jpeg";
  return "image/png";
}

function isOrganizationBrandingPath(organizationId: string, bucket: string | null, path: string | null) {
  if (bucket !== "branding" || !path) return false;
  if (path.toLowerCase().endsWith(".svg")) return false;
  return path.startsWith(`${organizationId}/branding/`) && !path.includes("..") && !path.includes("//") && !path.includes("\\");
}

export async function GET(_request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!allowedKinds.has(kind)) {
    return NextResponse.json({ error: "Unknown branding asset." }, { status: 404 });
  }

  const supabase = (await createSupabaseServerClient()) as any;
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return NextResponse.json({ error: "Authentication is required." }, { status: 401 });
  }

  const { data: membership, error: membershipError } = await supabase
    .from("organization_members")
    .select("organization_id, role, is_active")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (membershipError || !membership?.organization_id) {
    return NextResponse.json({ error: membershipError?.message || "Organization membership was not found." }, { status: 403 });
  }

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select("business_logo_storage_bucket, business_logo_storage_path, authorised_signature_storage_bucket, authorised_signature_storage_path")
    .eq("id", membership.organization_id)
    .is("deleted_at", null)
    .maybeSingle();
  if (organizationError || !organization) {
    return NextResponse.json({ error: organizationError?.message || "Organization was not found." }, { status: 404 });
  }

  const bucket = kind === "logo" ? organization.business_logo_storage_bucket : organization.authorised_signature_storage_bucket;
  const path = kind === "logo" ? organization.business_logo_storage_path : organization.authorised_signature_storage_path;

  if (!isOrganizationBrandingPath(membership.organization_id, bucket, path)) {
    return NextResponse.json({ error: "Branding asset was not found." }, { status: 404 });
  }

  const { data, error } = await supabase.storage.from(bucket).download(path);
  if (error || !data) {
    return NextResponse.json({ error: error?.message || "Unable to load branding asset." }, { status: 404 });
  }

  return new NextResponse(data, {
    headers: {
      "Cache-Control": "private, max-age=300",
      "Content-Type": contentTypeForPath(path)
    }
  });
}
