import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ClipboardCheck, RotateCcw } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { Badge, Card, SectionHeader } from "@/components/ui";
import { getCurrentUserEmail } from "@/lib/auth/session";
import { getDefaultOrganization } from "@/lib/organization";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Open";
  }
  return new Intl.DateTimeFormat("en-TH", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

export default async function StartInspectionPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  if (!["delivery", "return"].includes(type)) {
    notFound();
  }

  const [userEmail, organization] = await Promise.all([getCurrentUserEmail(), getDefaultOrganization()]);
  const supabase = (await createSupabaseServerClient()) as any;
  const statuses = type === "delivery" ? ["booked"] : ["active", "due_soon", "overdue", "extended"];
  const { data, error } = await supabase
    .from("rentals")
    .select("id, start_date, end_date, status, customers!rentals_customer_id_fkey(full_name, phone), vehicles!rentals_vehicle_id_fkey(make, model, registration_number)")
    .eq("organization_id", organization.id)
    .in("status", statuses)
    .is("deleted_at", null)
    .order("start_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  const Icon = type === "delivery" ? ClipboardCheck : RotateCcw;
  const title = type === "delivery" ? "Start delivery inspection" : "Start return inspection";
  const empty = type === "delivery" ? "No booked rentals are waiting for delivery." : "No active rentals are waiting for return.";

  return (
    <AppShell userEmail={userEmail}>
      <div className="mx-auto max-w-3xl space-y-4">
        <Card>
          <div className="flex items-start gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#e6fffb] text-[#0f766e]">
              <Icon />
            </span>
            <div>
              <SectionHeader eyebrow="Inspection selector" title={title} />
              <p className="mt-2 text-sm text-[#667085]">Choose the rental you are handing over or collecting.</p>
            </div>
          </div>
        </Card>

        <div className="space-y-3">
          {(data || []).length === 0 ? (
            <Card>
              <p className="text-sm font-semibold text-[#667085]">{empty}</p>
              <Link className="mt-4 inline-flex rounded-lg bg-[#0f766e] px-4 py-3 text-sm font-bold text-white" href="/fleet">
                Back to Fleet
              </Link>
            </Card>
          ) : (
            (data || []).map((rental: any) => {
              const vehicle = rental.vehicles;
              const customer = rental.customers;
              return (
                <Link
                  className="pressable block rounded-lg border border-[#d6e5e2] bg-white p-4 shadow-[0_10px_24px_rgba(25,63,72,0.06)] hover:border-[#0f766e]"
                  href={`/inspections/${type}/${rental.id}` as Route}
                  key={rental.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-black text-[#10252b]">
                        {vehicle?.make} {vehicle?.model}
                      </p>
                      <p className="text-sm font-bold text-[#667085]">{vehicle?.registration_number}</p>
                      <p className="mt-2 text-sm text-[#475467]">{customer?.full_name || "Unknown customer"} · {customer?.phone || "No phone"}</p>
                      <p className="mt-1 text-sm text-[#667085]">{formatDate(rental.start_date)} → {formatDate(rental.end_date)}</p>
                    </div>
                    <Badge tone={type === "delivery" ? "blue" : "green"}>{rental.status}</Badge>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </div>
    </AppShell>
  );
}
