"use server";

import { revalidatePath } from "next/cache";
import { getCurrentMembership } from "@/lib/auth/roles";
import { OWNER_ONLY_MESSAGE } from "@/lib/auth/role-types";
import { businessToday } from "@/lib/business-time";
import { notifyOperator } from "@/lib/notify-operator";
import { getPublicCatalog, publicBookingSettings } from "@/lib/public-catalog";
import { daysBetween, estimateRental } from "@/lib/rental-estimate";
import { overlaps } from "@/lib/rental-conflicts";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };

const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

function shortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** A customer asks for a vehicle from the public booking page. No sign-in. */
export async function submitBookingRequest(formData: FormData): Promise<Result<{ holdHours: number }>> {
  const slug = String(formData.get("slug") || "").trim();
  const vehicleId = String(formData.get("vehicleId") || "").trim();
  const startDate = String(formData.get("startDate") || "").trim();
  const endDate = String(formData.get("endDate") || "").trim() || null;
  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const phone = String(formData.get("phone") || "").trim().slice(0, 40);
  const message = String(formData.get("message") || "").trim().slice(0, 600) || null;

  // Bots fill every field; people never see this one.
  if (String(formData.get("website") || "").trim()) return { ok: true, holdHours: 24 };

  if (name.length < 2) return { ok: false, error: "Please tell us your name." };
  if (phone.replace(/\D/g, "").length < 7) return { ok: false, error: "Please add a phone or WhatsApp number we can reach you on." };
  if (!isDate(startDate) || startDate < businessToday()) return { ok: false, error: "Please choose a start date from today onwards." };
  if (endDate && (!isDate(endDate) || endDate <= startDate)) return { ok: false, error: "The return date must be after the start date." };

  const catalog = await getPublicCatalog(slug);
  if (!catalog || !catalog.enabled) return { ok: false, error: "Online booking isn't available for this business right now." };
  const vehicle = catalog.vehicles.find((item) => item.id === vehicleId);
  if (!vehicle) return { ok: false, error: "That vehicle is no longer available. Please choose another." };
  if (vehicle.busy.some((period) => overlaps(startDate, endDate, period))) {
    return { ok: false, error: "Someone has just taken those dates. Please choose other dates or another vehicle." };
  }

  const admin = createSupabaseAdminClient() as any;
  const { count } = await admin
    .from("booking_requests")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", catalog.organizationId)
    .eq("status", "pending")
    .eq("phone", phone);
  if ((count || 0) >= 3) return { ok: false, error: "You already have requests waiting for an answer. The business will be in touch soon." };

  const estimate = endDate ? estimateRental(vehicle, daysBetween(startDate, endDate)) : null;
  const { error } = await admin.from("booking_requests").insert({
    organization_id: catalog.organizationId,
    vehicle_id: vehicle.id,
    start_date: startDate,
    end_date: endDate,
    customer_name: name,
    phone,
    message,
    estimated_total: estimate,
    hold_until: new Date(Date.now() + catalog.holdHours * 3_600_000).toISOString()
  });
  if (error) return { ok: false, error: "We couldn't send your request. Please try again." };

  const when = endDate ? `${shortDate(startDate)} to ${shortDate(endDate)}` : `from ${shortDate(startDate)}, no end date`;
  notifyOperator(catalog.organizationId, `🚗 New booking request: ${name} wants the ${vehicle.name} ${when}. Open Bookings to answer.`, "booking_request").catch(() => null);
  revalidatePath("/bookings");
  revalidatePath("/");
  revalidatePath(`/rent/${slug}`);
  return { ok: true, holdHours: catalog.holdHours };
}

async function loadRequestForMember(requestId: string) {
  const membership = await getCurrentMembership();
  if (!membership) return { error: "Please sign in again." } as const;
  const admin = createSupabaseAdminClient() as any;
  const { data: request } = await admin
    .from("booking_requests")
    .select("*")
    .eq("id", String(requestId || ""))
    .eq("organization_id", membership.organizationId)
    .maybeSingle();
  if (!request) return { error: "This request could not be found." } as const;
  if (request.status !== "pending") return { error: "This request has already been answered." } as const;
  return { membership, admin, request } as const;
}

/**
 * Accepts a request: the person becomes a customer (matched by phone if they
 * already are one) and the booking form opens filled in, ready to send them
 * their booking link.
 */
export async function approveBookingRequest(requestId: string): Promise<Result<{ href: string }>> {
  const loaded = await loadRequestForMember(requestId);
  if ("error" in loaded) return { ok: false, error: loaded.error as string };
  const { membership, admin, request } = loaded;

  const { data: existing } = await admin
    .from("customers")
    .select("id")
    .eq("organization_id", membership.organizationId)
    .eq("phone", request.phone)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();

  let customerId = existing?.id as string | undefined;
  if (!customerId) {
    const { data: created, error } = await admin
      .from("customers")
      .insert({
        organization_id: membership.organizationId,
        full_name: request.customer_name,
        phone: request.phone,
        notes: request.message ? `From their booking request: ${request.message}` : null,
        created_by: membership.userId
      })
      .select("id")
      .single();
    if (error || !created) return { ok: false, error: "Couldn't add this person as a customer. Please try again." };
    customerId = created.id;
  }

  const { error: updateError } = await admin
    .from("booking_requests")
    .update({ status: "approved", customer_id: customerId, handled_by: membership.userId, handled_at: new Date().toISOString() })
    .eq("id", request.id);
  if (updateError) return { ok: false, error: "Couldn't update this request. Please try again." };

  revalidatePath("/bookings");
  revalidatePath("/");
  const params = new URLSearchParams({ vehicleId: request.vehicle_id, customerId: customerId as string, startDate: String(request.start_date).slice(0, 10) });
  if (request.end_date) params.set("endDate", String(request.end_date).slice(0, 10));
  return { ok: true, href: `/bookings/new?${params.toString()}` };
}

export async function declineBookingRequest(requestId: string): Promise<Result> {
  const loaded = await loadRequestForMember(requestId);
  if ("error" in loaded) return { ok: false, error: loaded.error as string };
  const { membership, admin, request } = loaded;
  const { error } = await admin
    .from("booking_requests")
    .update({ status: "declined", handled_by: membership.userId, handled_at: new Date().toISOString() })
    .eq("id", request.id);
  if (error) return { ok: false, error: "Couldn't update this request. Please try again." };
  revalidatePath("/bookings");
  revalidatePath("/");
  return { ok: true };
}

/** Turns the public booking page on or off, and sets how long a request holds a vehicle. */
export async function savePublicBookingSettings(input: { enabled: boolean; holdHours: number }): Promise<Result> {
  const membership = await getCurrentMembership();
  if (!membership) return { ok: false, error: "Please sign in again." };
  if (membership.role !== "owner") return { ok: false, error: OWNER_ONLY_MESSAGE };

  const admin = createSupabaseAdminClient() as any;
  const { data: organization } = await admin.from("organizations").select("settings, slug").eq("id", membership.organizationId).maybeSingle();
  if (!organization) return { ok: false, error: "Business not found." };
  const settings = organization.settings && typeof organization.settings === "object" ? organization.settings : {};
  const holdHours = [6, 12, 24, 48, 72].includes(Number(input.holdHours)) ? Number(input.holdHours) : publicBookingSettings(settings).holdHours;
  const { error } = await admin
    .from("organizations")
    .update({ settings: { ...settings, public_booking: { enabled: !!input.enabled, hold_hours: holdHours } } })
    .eq("id", membership.organizationId);
  if (error) return { ok: false, error: "Couldn't save. Please try again." };
  revalidatePath("/settings");
  revalidatePath(`/rent/${organization.slug}`);
  return { ok: true };
}
