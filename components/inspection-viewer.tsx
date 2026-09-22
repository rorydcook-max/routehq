import { Camera, FileVideo, Fuel, Gauge, PenLine, ShieldAlert } from "lucide-react";
import { getLocale } from "next-intl/server";
import { TranslatedText } from "@/components/translated-text";
import { Badge } from "@/components/ui";
import { getCurrentMembership } from "@/lib/auth/roles";
import { translateForReader } from "@/lib/content-translation";

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "Not set";
  }
  return new Intl.DateTimeFormat("en-TH", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function photoUrl(photo: any) {
  return photo?.signed_url || photo?.url || photo?.thumbnail_url || "";
}

export function FuelGaugeView({ value }: { value: number | null | undefined }) {
  const safeValue = Math.max(0, Math.min(100, Number(value || 0)));

  return (
    <div className="rounded-lg border border-[#d6e5e2] bg-white p-3">
      <div className="mb-2 flex items-center justify-between text-sm font-bold text-[#344054]">
        <span>Fuel level</span>
        <span>{safeValue}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-[#eef2f6]">
        <div className="h-full rounded-full bg-[#0f766e]" style={{ width: `${safeValue}%` }} />
      </div>
    </div>
  );
}

export async function InspectionViewer({ inspection }: { inspection: any }) {
  const type = inspection.type || inspection.inspection_type;
  const photos = Array.isArray(inspection.photos) ? inspection.photos : [];
  const damageItems = Array.isArray(inspection.damage_items) ? inspection.damage_items : [];
  const videoUrl = inspection.signed_video_url || inspection.video_url || "";

  // Notes and damage descriptions are shown in the reader's language when they
  // were written in another, with the original always available. The stored
  // and signed text is never changed.
  const locale = await getLocale();
  const organizationId = inspection.organization_id || (await getCurrentMembership())?.organizationId;
  const [notes, ...descriptions] = await translateForReader(
    organizationId,
    [inspection.notes, ...damageItems.map((item: any) => item.description)],
    locale
  );

  return (
    <article className="rounded-lg border border-[#d6e5e2] bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Badge tone={type === "return" ? "red" : type === "condition_report" ? "amber" : "green"}>
            {type === "condition_report" ? "CONDITION REPORT" : String(type || "inspection").toUpperCase()}
          </Badge>
          <p className="mt-2 text-sm font-semibold text-[#667085]">{formatDate(inspection.submitted_at || inspection.inspected_at || inspection.created_at)}</p>
          {inspection.customers?.full_name ? <p className="mt-1 font-black text-[#10252b]">{inspection.customers.full_name}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-2 text-right">
          <div className="rounded-lg bg-[#eef8f6] px-3 py-2">
            <Gauge className="ml-auto text-[#0f766e]" size={16} />
            <p className="font-mono-data mt-1 text-sm font-black text-[#10252b]">{Number(inspection.odometer_reading || inspection.mileage || 0).toLocaleString()} km</p>
          </div>
          <div className="rounded-lg bg-[#eef8f6] px-3 py-2">
            <Fuel className="ml-auto text-[#0f766e]" size={16} />
            <p className="font-mono-data mt-1 text-sm font-black text-[#10252b]">{inspection.fuel_level_label || `${Number(inspection.fuel_level || 0)}%`}</p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <FuelGaugeView value={inspection.fuel_level} />
      </div>

      {videoUrl ? (
        <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#10252b]">
            <FileVideo size={17} className="text-[#0f766e]" />
            Walkaround video
          </div>
          <video className="max-h-80 w-full rounded-lg bg-black" controls src={videoUrl} />
        </div>
      ) : null}

      {photos.length > 0 ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#10252b]">
            <Camera size={17} className="text-[#0f766e]" />
            Photos
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {photos.map((photo: any) => {
              const url = photoUrl(photo);
              return (
                <a className="block overflow-hidden rounded-lg border border-[#d6e5e2] bg-[#eef2f6]" href={url || "#"} key={photo.id} target="_blank">
                  {url ? <img alt={photo.type || "Inspection photo"} className="h-28 w-full object-cover" src={url} /> : <div className="h-28" />}
                  <p className="px-2 py-1 text-xs font-bold text-[#475467]">{String(photo.type || "photo").replace(/_/g, " ")}</p>
                </a>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#10252b]">
          <ShieldAlert size={17} className="text-[#0f766e]" />
          Damage
        </div>
        {damageItems.length === 0 ? (
          <p className="rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3 text-sm font-semibold text-[#667085]">No damage items recorded.</p>
        ) : (
          <div className="space-y-2">
            {damageItems.map((item: any, index: number) => (
              <div className="rounded-lg border border-[#d6e5e2] bg-[#f8fffd] p-3" key={item.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-[#10252b]">
                      {String(item.location || "vehicle").replace(/_/g, " ")} · {item.severity}
                    </p>
                    <TranslatedText className="mt-1 text-sm text-[#667085]" value={descriptions[index]} />
                    <Badge tone={item.is_pre_existing ? "neutral" : "red"}>{item.is_pre_existing ? "Pre-existing" : "New damage"}</Badge>
                  </div>
                  {item.photo_url ? (
                    <a className="text-sm font-bold text-[#0f766e]" href={item.photo_url} target="_blank">
                      Photo
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {inspection.customer_signature ? (
        <div className="mt-4 rounded-lg border border-[#d6e5e2] bg-white p-3">
          <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#10252b]">
            <PenLine size={17} className="text-[#0f766e]" />
            Customer signature
          </div>
          <img alt="Customer signature" className="max-h-40 rounded-lg border border-[#d6e5e2] bg-[#f8fffd]" src={inspection.customer_signature} />
          <p className="mt-2 text-sm text-[#667085]">
            Signed by {inspection.customer_signed_name || "customer"} · {formatDate(inspection.customer_signed_at)}
          </p>
        </div>
      ) : null}

      {notes.original ? <TranslatedText className="mt-4 rounded-lg bg-[#f8fffd] p-3 text-sm text-[#475467]" value={notes} /> : null}
    </article>
  );
}
