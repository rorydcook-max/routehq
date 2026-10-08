import { NextRequest, NextResponse } from "next/server";
import { said } from "@/lib/i18n/server-text";
import { getCurrentMembership } from "@/lib/auth/roles";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { businessPlace, researchAvailable } from "@/lib/ai-research";
import { valueVehicle } from "@/lib/vehicle-valuation";

export const maxDuration = 120;

/**
 * Estimates what one vehicle would sell for today and keeps it with the vehicle.
 * The owner's own "worth now" figure is never replaced: only an empty one, or one
 * that is still the last estimate, follows the new estimate.
 */
export async function POST(request: NextRequest) {
  const membership = await getCurrentMembership();
  if (!membership) return NextResponse.json({ error: await said("Sign in first.") }, { status: 401 });
  if (membership.role !== "owner") return NextResponse.json({ error: await said("Only the owner can do that.") }, { status: 403 });
  if (!researchAvailable()) return NextResponse.json({ valuation: null, unavailable: true });

  const body = (await request.json().catch(() => ({}))) as { vehicleId?: string };
  const organization = await getDefaultOrganization();
  const admin = createSupabaseAdminClient() as any;
  const { data: vehicle } = await admin
    .from("vehicles")
    .select("id, make, model, trim, year, mileage, estimated_value, metadata, vehicle_categories(code)")
    .eq("id", String(body.vehicleId || ""))
    .eq("organization_id", organization.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!vehicle) return NextResponse.json({ error: await said("That vehicle could not be found.") }, { status: 404 });

  const { country, area, currency } = businessPlace(organization);
  const valuation = await valueVehicle(admin, {
    category: String(vehicle.vehicle_categories?.code || "car"),
    make: vehicle.make,
    model: vehicle.model,
    trim: vehicle.trim,
    year: vehicle.year,
    mileage: vehicle.mileage,
    country,
    area,
    currency
  });
  if (!valuation) return NextResponse.json({ valuation: null });

  const metadata = (vehicle.metadata || {}) as Record<string, any>;
  const previous = Number(metadata.valuation?.typical || 0);
  const current = vehicle.estimated_value == null ? null : Number(vehicle.estimated_value);
  const follows = current == null || current === 0 || (previous > 0 && current === previous);
  const estimatedValue = follows ? valuation.typical : current;
  await admin
    .from("vehicles")
    .update({ metadata: { ...metadata, valuation }, ...(follows ? { estimated_value: valuation.typical } : {}) })
    .eq("id", vehicle.id)
    .eq("organization_id", organization.id);

  return NextResponse.json({ valuation, estimatedValue, ownFigure: !follows });
}
